/**
 * Pure, fail-closed comparison of a provider-reported payment against the order row
 * this application wrote itself.
 *
 * Both payment paths — the Cashfree webhook core (`payment-webhook.ts`) and the
 * user-return fallback (`verifyPayment` in `payment-actions.ts`) — must make the same
 * decision, so it lives here once and is regression-tested directly.
 *
 * Contract:
 *   - `orders.amount` is stored by us in MINOR units (paise, e.g. 9900).
 *   - Cashfree reports `order_amount` / `payment_amount` in MAJOR units (rupees, e.g. 99).
 *
 * Fail closed means: a missing, malformed, non-positive, non-finite or mismatched
 * value on EITHER side refuses the grant. Absence of evidence is never treated as
 * evidence of payment — in particular, an order row with no usable stored amount or
 * currency must NOT skip the comparison and fall through to the entitlement grant.
 *
 * This module is deliberately dependency-free and has no "use server" directive: a
 * "use server" file turns every export into a publicly callable endpoint, and these
 * helpers must never be callable from a client.
 */

import { amountsMatch } from "@/lib/actions/safety";
import { PLAN_CURRENCY } from "@/lib/actions/premium";

/** Why a provider payment could not be verified against the stored order. */
export type PaymentVerificationFailure =
  | "stored_amount_invalid"
  | "stored_currency_invalid"
  | "provider_amount_invalid"
  | "provider_currency_invalid"
  | "amount_mismatch"
  | "currency_mismatch"
  | "plan_currency_mismatch";

export type StoredPaymentClaim = {
  /** `orders.amount` — minor units. May be anything the DB returned. */
  amountMinor: unknown;
  /** `orders.currency` — ISO 4217 code we wrote (e.g. "INR"). */
  currency: unknown;
};

export type ProviderPaymentReport = {
  /** Cashfree `order_amount` / `payment_amount` — major units. */
  amountMajor: unknown;
  /** Cashfree `order_currency`. */
  currency: unknown;
};

export type PaymentVerificationResult =
  | { ok: true; amountMinor: number; currency: string }
  | { ok: false; reason: PaymentVerificationFailure };

const MAX_AMOUNT_TEXT_LENGTH = 32;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3,8}$/;

/**
 * Normalises the amount we stored on the order. Accepts a positive finite number, or
 * a numeric string (some PostgREST/numeric column shapes round-trip as text). Anything
 * else — null, undefined, "", non-numeric text, NaN, Infinity, 0, negatives, booleans,
 * objects — is invalid and makes the caller refuse the grant.
 */
export function normalizeStoredAmountMinor(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_AMOUNT_TEXT_LENGTH) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/**
 * Normalises a currency code from either side. Only a trimmed, 3–8 letter,
 * case-normalised ISO-style code is usable; an empty/absent/numeric/symbolic value is
 * invalid and makes the caller refuse rather than skip the comparison.
 */
export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return CURRENCY_CODE_PATTERN.test(code) ? code : null;
}

/**
 * Normalises the provider-reported amount (major units): a positive finite number or
 * numeric string. Zero, negatives and non-numeric text are invalid.
 */
export function normalizeProviderAmountMajor(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_AMOUNT_TEXT_LENGTH) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/**
 * The single fail-closed decision shared by the webhook and the verify fallback.
 *
 * Check order: our own stored data first (a broken order row is an operational
 * problem), then the provider's report, then the actual comparisons. The first
 * failure is returned so the caller can log a precise reason.
 */
export function verifyProviderAmountAndCurrency(
  stored: StoredPaymentClaim,
  provider: ProviderPaymentReport
): PaymentVerificationResult {
  const storedAmount = normalizeStoredAmountMinor(stored.amountMinor);
  if (storedAmount === null) return { ok: false, reason: "stored_amount_invalid" };

  const storedCurrency = normalizeCurrencyCode(stored.currency);
  if (storedCurrency === null) return { ok: false, reason: "stored_currency_invalid" };

  const providerAmount = normalizeProviderAmountMajor(provider.amountMajor);
  if (providerAmount === null) return { ok: false, reason: "provider_amount_invalid" };

  const providerCurrency = normalizeCurrencyCode(provider.currency);
  if (providerCurrency === null) return { ok: false, reason: "provider_currency_invalid" };

  if (!amountsMatch(providerAmount, storedAmount)) {
    return { ok: false, reason: "amount_mismatch" };
  }

  if (storedCurrency !== providerCurrency) {
    return { ok: false, reason: "currency_mismatch" };
  }

  // Plan pin: this application only sells AuraMint+ in PLAN_CURRENCY. A matching
  // pair of non-plan currencies (e.g. both USD) is still a refusal, not a pass —
  // otherwise a tampered or wrong-product order could verify itself.
  if (storedCurrency !== PLAN_CURRENCY) {
    return { ok: false, reason: "plan_currency_mismatch" };
  }

  return { ok: true, amountMinor: storedAmount, currency: storedCurrency };
}

/**
 * Maps a failure onto the activity-log action both payment paths already use, so
 * dashboards keep working and new failure classes are distinguishable:
 *   - `payment.amount_mismatch` / `payment.currency_mismatch` — values present and different.
 *   - `payment.amount_unverifiable` / `payment.currency_unverifiable` — a value was
 *     missing or malformed on either side (the previously permissive cases).
 */
export function paymentVerificationLogAction(reason: PaymentVerificationFailure): string {
  switch (reason) {
    case "amount_mismatch":
      return "payment.amount_mismatch";
    case "currency_mismatch":
      return "payment.currency_mismatch";
    case "plan_currency_mismatch":
      return "payment.currency_mismatch";
    case "stored_amount_invalid":
    case "provider_amount_invalid":
      return "payment.amount_unverifiable";
    case "stored_currency_invalid":
    case "provider_currency_invalid":
      return "payment.currency_unverifiable";
  }
}

/** Short, non-sensitive label used in the webhook response body. */
export function paymentVerificationMessage(reason: PaymentVerificationFailure): string {
  switch (reason) {
    case "amount_mismatch":
      return "Amount mismatch";
    case "currency_mismatch":
      return "Currency mismatch";
    case "plan_currency_mismatch":
      return "Currency not supported";
    case "stored_amount_invalid":
    case "provider_amount_invalid":
      return "Amount unverifiable";
    case "stored_currency_invalid":
    case "provider_currency_invalid":
      return "Currency unverifiable";
  }
}
