/**
 * Cashfree webhook processing core.
 *
 * Deliberately dependency-injected and framework-free so the security-critical
 * decisions (signature verification, amount/currency verification, owner resolution,
 * idempotency) can be regression-tested without a live database or provider.
 *
 * Ordering that matters here:
 *  1. verify signature over `${timestamp}${rawBody}` (constant time)
 *  2. parse + validate the payload
 *  3. resolve the order from OUR database (never trust the payload's identifiers)
 *  4. verify exact amount and currency
 *  5. claim and grant in one purchase-idempotent database transaction
 */

import { createHmac } from "node:crypto";
import { z } from "zod";
import { isValidOrderId, timingSafeEquals } from "./safety";
import {
  paymentVerificationLogAction,
  paymentVerificationMessage,
  verifyProviderAmountAndCurrency,
} from "./payment-verification";

export type WebhookOrderRow = {
  id: string;
  user_id: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
};

export type WebhookDeps = {
  /** Loads the order from our DB. Service-role client only. */
  getOrder(
    orderId: string
  ): Promise<{ order: WebhookOrderRow | null; error?: string }>;
  fulfillOrder(orderId: string, userId: string): Promise<
    | { ok: true; applied: boolean; recovered: boolean }
    | { ok: false; error: string }
  >;
  markOrderFailed(orderId: string): Promise<{ ok: boolean; updated: boolean; error?: string }>;
  logEvent(userId: string, action: string, metadata: Record<string, unknown>): Promise<void>;
};

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

const amountLike = z.union([z.number(), z.string().max(32)]);

export const cashfreeWebhookPayloadSchema = z.object({
  type: z.string().min(1).max(64).optional(),
  data: z
    .object({
      order: z
        .object({
          order_id: z.string().min(1).max(120).optional(),
          order_amount: amountLike.optional(),
          order_currency: z.string().max(8).optional(),
          order_status: z.string().max(32).optional(),
        })
        .optional(),
      payment: z
        .object({
          payment_amount: amountLike.optional(),
          payment_status: z.string().max(32).optional(),
        })
        .optional(),
    })
    .optional(),
});

export type CashfreeWebhookPayload = z.infer<typeof cashfreeWebhookPayloadSchema>;

/**
 * HMAC-SHA256 of `timestamp + rawBody`, base64-encoded, compared in constant time.
 * `secret`, `timestamp` and `signature` must all be present or verification fails.
 */
export function verifyCashfreeSignature(
  rawBody: string,
  timestamp: string | null | undefined,
  signature: string | null | undefined,
  secret: string | null | undefined
): boolean {
  if (typeof secret !== "string" || secret.length === 0) return false;
  if (typeof timestamp !== "string" || timestamp.length === 0 || timestamp.length > 32) return false;
  if (typeof signature !== "string" || signature.length === 0 || signature.length > 256) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}${rawBody}`)
    .digest("base64");

  return timingSafeEquals(signature, expected);
}

/**
 * Processes one verified webhook delivery.
 *
 * Response codes: 2xx = handled/ignored (no retry wanted), 4xx = bad request,
 * 5xx = transient failure (the provider should retry).
 */
export async function handleCashfreeWebhookEvent(input: {
  rawBody: string;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  secret: string | null | undefined;
  deps: WebhookDeps;
}): Promise<WebhookOutcome> {
  const { rawBody, timestamp, signature, secret, deps } = input;

  if (typeof secret !== "string" || secret.length === 0) {
    console.error("[Cashfree Webhook] CRITICAL: CASHFREE_WEBHOOK_SECRET not configured");
    return { status: 503, body: { message: "Server misconfigured" } };
  }

  if (typeof timestamp !== "string" || timestamp.length === 0) {
    // Without the signed timestamp the signature cannot be reconstructed safely.
    console.error("[Cashfree Webhook] Missing x-webhook-timestamp header");
    return { status: 401, body: { message: "Missing timestamp" } };
  }

  if (!verifyCashfreeSignature(rawBody, timestamp, signature, secret)) {
    console.error("[Cashfree Webhook] Invalid signature — delivery rejected");
    return { status: 401, body: { message: "Invalid signature" } };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    console.error("[Cashfree Webhook] Body is not valid JSON");
    return { status: 400, body: { message: "Invalid payload" } };
  }

  const parsed = cashfreeWebhookPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error("[Cashfree Webhook] Payload failed validation");
    return { status: 400, body: { message: "Invalid payload" } };
  }

  const payload = parsed.data;
  const orderData = payload.data?.order;
  const orderId = orderData?.order_id;

  if (!orderId) {
    return { status: 200, body: { message: "No order_id" } };
  }

  if (!isValidOrderId(orderId)) {
    console.error("[Cashfree Webhook] Rejected unexpected order id format");
    return { status: 200, body: { message: "Ignored" } };
  }

  const eventType = payload.type;
  const orderStatus = orderData?.order_status;
  const isSuccess = eventType === "PAYMENT_SUCCESS_WEBHOOK" || orderStatus === "PAID";
  const isFailure = eventType === "PAYMENT_FAILED_WEBHOOK" || orderStatus === "FAILED";

  if (!isSuccess && !isFailure) {
    return { status: 200, body: { message: "Ignored" } };
  }

  const { order, error: orderError } = await deps.getOrder(orderId);
  if (orderError) {
    console.error("[Cashfree Webhook] Failed to load order:", orderError);
    return { status: 500, body: { message: "Lookup failed" } };
  }
  if (!order) {
    console.error("[Cashfree Webhook] Order not found:", orderId);
    return { status: 200, body: { message: "Order not found" } };
  }

  // ── Failure path ─────────────────────────────────────────────
  if (!isSuccess) {
    const result = await deps.markOrderFailed(orderId);
    if (!result.ok) {
      console.error("[Cashfree Webhook] Failed to mark order FAILED:", result.error);
      return { status: 500, body: { message: "Processing failed" } };
    }
    if (!result.updated) {
      const latest = await deps.getOrder(orderId);
      if (latest.error || !latest.order || !["PAID", "FAILED", "REFUNDED"].includes(latest.order.status ?? "")) {
        return { status: 500, body: { message: "Failure transition unverified" } };
      }
      return { status: 200, body: { message: "Already processed" } };
    }
    console.log("[Cashfree Webhook] Payment failed:", orderId);
    return { status: 200, body: { message: "OK" } };
  }

  // ── Success path ─────────────────────────────────────────────
  const userId = order.user_id;
  if (typeof userId !== "string" || userId.length === 0) {
    console.error("[Cashfree Webhook] CRITICAL: order has no owner:", orderId);
    return { status: 200, body: { message: "Order has no owner" } };
  }

  // Amount / currency verification — fail closed.
  //
  // Previously a null stored amount (or a null stored/provider currency) silently
  // skipped the comparison and fell through to the entitlement grant. Every value is
  // now required to be present, well-formed and equal; absence is a refusal, not a
  // pass. See `payment-verification.ts` for the shared decision and its unit tests.
  const providerAmount =
    orderData?.order_amount !== undefined
      ? orderData.order_amount
      : payload.data?.payment?.payment_amount;
  const providerCurrency = orderData?.order_currency;

  const verification = verifyProviderAmountAndCurrency(
    { amountMinor: order.amount, currency: order.currency },
    { amountMajor: providerAmount, currency: providerCurrency }
  );

  if (!verification.ok) {
    console.error("[Cashfree Webhook] CRITICAL: refusing to grant premium", {
      orderId,
      reason: verification.reason,
      providerAmount: providerAmount ?? null,
      storedAmount: order.amount ?? null,
      providerCurrency: providerCurrency ?? null,
      storedCurrency: order.currency ?? null,
    });
    await deps.logEvent(userId, paymentVerificationLogAction(verification.reason), {
      order_id: orderId,
      reason: verification.reason,
      provider_amount: providerAmount ?? null,
      stored_amount: order.amount ?? null,
      provider_currency: providerCurrency ?? null,
      stored_currency: order.currency ?? null,
    });
    // 2xx: a retry cannot fix a mismatched or unverifiable stored order. The refusal is
    // recorded in the audit trail for manual reconciliation (documented as a blocker).
    return { status: 200, body: { message: paymentVerificationMessage(verification.reason) } };
  }

  const fulfilled = await deps.fulfillOrder(orderId, userId);
  if (!fulfilled.ok) {
    console.error("[Cashfree Webhook] Atomic fulfillment failed:", fulfilled.error);
    return { status: 500, body: { message: "Processing failed" } };
  }
  if (!fulfilled.applied && !fulfilled.recovered) {
    return { status: 200, body: { message: "Already processed" } };
  }
  await deps.logEvent(userId, fulfilled.recovered ? "payment.webhook.recovered" : "payment.webhook.success", {
    order_id: orderId,
  });
  return { status: 200, body: { message: fulfilled.recovered ? "Recovered" : "OK" } };
}
