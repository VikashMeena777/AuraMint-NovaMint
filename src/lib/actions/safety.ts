/**
 * Shared server-side safety helpers.
 *
 * This module is intentionally dependency-free (node builtins only) so it can be
 * unit tested outside the Next.js bundler.
 *
 * It is NOT a Server Action module — it has no "use server" directive and must never
 * live in one, because a "use server" file turns every export into a publicly
 * callable endpoint.
 */

import { timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

/**
 * Constant-time string comparison. Returns false for empty/unequal-length/absent
 * inputs, so a missing secret can never satisfy a comparison.
 */
export function timingSafeEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;

  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}

/** Minimum accepted length for CRON_SECRET / webhook secrets (guards against `x`). */
export const MIN_SECRET_LENGTH = 16;

export type CronAuthResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "bad_format" | "bad_secret" };

/**
 * Fail-closed cron authorization check.
 *
 * - Missing / too-short CRON_SECRET ⇒ never authorized (no `Bearer undefined` bypass).
 * - Requires exactly `Bearer <secret>`, compared in constant time.
 */
export function checkCronAuthorization(
  authorizationHeader: string | null | undefined,
  cronSecret: string | null | undefined
): CronAuthResult {
  if (typeof cronSecret !== "string" || cronSecret.length < MIN_SECRET_LENGTH) {
    return { ok: false, reason: "not_configured" };
  }

  if (typeof authorizationHeader !== "string" || authorizationHeader.length === 0) {
    return { ok: false, reason: "bad_format" };
  }

  const match = parseBearerToken(authorizationHeader);
  if (!match) return { ok: false, reason: "bad_format" };

  return timingSafeEquals(match, cronSecret) ? { ok: true } : { ok: false, reason: "bad_secret" };
}

/**
 * Extracts the token from an exactly-formed `Bearer <token>` header.
 *
 * Accepts one or more literal spaces after `Bearer` (never tabs, matching the
 * documented format) and a single non-space token; anything else is `null`.
 * Hand-parsed so authorization decisions don't route through a regex engine or
 * any shell-adjacent API.
 */
function parseBearerToken(authorizationHeader: string): string | null {
  const prefix = "Bearer";
  if (!authorizationHeader.startsWith(prefix)) return null;
  const rest = authorizationHeader.slice(prefix.length);
  if (rest.charAt(0) !== " ") return null;
  const token = rest.trim();
  if (token.length === 0) return null;
  for (const ch of token) {
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v") {
      return null;
    }
  }
  return token;
}

// ─────────────────────────────────────────────────────────────
// Text hygiene
// ─────────────────────────────────────────────────────────────

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes a value for safe interpolation into HTML (email templates, etc.). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/** True when the string contains C0/C1 control characters (incl. CR/LF and NUL). */
export function hasControlChars(value: unknown): boolean {
  if (typeof value !== "string") return false;
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Strips C0 control characters but preserves tab/newline/space (for free text). */
export function stripControlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) {
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Normalises untrusted text for storage / display: strips HTML tags and control
 * characters, collapses whitespace, trims, then truncates to `maxLength` characters.
 */
export function sanitizePlainText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const out = stripControlChars(withoutTags).replace(/\s+/g, " ").trim();
  return out.length <= maxLength ? out : out.slice(0, maxLength).trim();
}

/** Keeps at most `maxLength` code points (safe for emoji / astral characters). */
export function truncateCodePoints(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return Array.from(value).slice(0, maxLength).join("");
}

/**
 * Validates an opaque resource id coming from the client. Rejects control
 * characters, path separators and anything longer than 128 characters, without
 * assuming the id format (uuid / serial / slug all pass).
 */
export function isSafeId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 128) return false;
  if (hasControlChars(value)) return false;
  return !value.includes("/") && !value.includes("\\");
}

// ─────────────────────────────────────────────────────────────
// Redirects
// ─────────────────────────────────────────────────────────────

export const DEFAULT_REDIRECT_PATH = "/dashboard";

/**
 * Returns a same-origin relative path that is safe to redirect to.
 *
 * Rejects (falling back to `fallback`): absolute URLs, protocol-relative `//host`,
 * backslash tricks (`/\evil.com`), CR/LF header injection, encoded control chars,
 * and inputs longer than 512 characters.
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT_PATH
): string {
  if (typeof candidate !== "string") return fallback;

  const value = candidate.trim();
  if (value.length === 0 || value.length > 512) return fallback;
  if (hasControlChars(value)) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (hasControlChars(decoded)) return fallback;

  // Must be a path, not an absolute or protocol-relative URL.
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // …and the percent-decoded form must not smuggle one either.
  if (decoded.startsWith("//")) return fallback;

  // Browsers normalise `\` to `/`, which would turn `/\evil.com` into `//evil.com`.
  if (value.includes("\\") || decoded.includes("\\")) return fallback;

  // Reject scheme smuggling in the first path segment (`/javascript:`).
  const firstSegment = decoded.slice(1).split("/")[0];
  if (firstSegment.includes(":")) return fallback;

  return value;
}

/**
 * Resolves the trusted origin for redirects / links.
 *
 * `x-forwarded-host` is attacker-controllable when the app is not behind a proxy
 * that always overwrites it, so it is deliberately NOT used here. Prefer the
 * configured public app URL, then fall back to the request's own origin.
 */
export function resolveTrustedOrigin(
  appUrl: string | null | undefined,
  requestOrigin: string
): string {
  if (typeof appUrl === "string" && appUrl.trim().length > 0) {
    try {
      const parsed = new URL(appUrl.trim());
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.origin;
      }
    } catch {
      // fall through to the request origin
    }
  }

  try {
    return new URL(requestOrigin).origin;
  } catch {
    return "http://localhost:3000";
  }
}

// ─────────────────────────────────────────────────────────────
// Numbers / enums
// ─────────────────────────────────────────────────────────────

/** Clamps an AI-produced aura score into the documented range and rejects NaN. */
export function clampAuraPoints(value: unknown, min = -10000, max = 10000): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(min, Math.min(max, Math.round(num)));
}

/** Coerces an untrusted pagination value into a bounded integer. */
export function boundedInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(num)));
}

export const VOTE_VALUES = [1, -1] as const;
export type VoteValue = (typeof VOTE_VALUES)[number];

export const REACTION_TYPES = ["crown", "skull", "fire", "yikes", "iconic", "npc"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export function isVoteValue(value: unknown): value is VoteValue {
  return value === 1 || value === -1;
}

export function isReactionType(value: unknown): value is ReactionType {
  return typeof value === "string" && (REACTION_TYPES as readonly string[]).includes(value);
}

/** Allows only uppercase status tokens coming from a payment provider. */
export function safeStatusToken(value: unknown, fallback = "error"): string {
  if (typeof value !== "string") return fallback;
  const token = value.trim().toUpperCase();
  return /^[A-Z_]{1,20}$/.test(token) ? token : fallback;
}

// ─────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────

const ORDER_ID_PATTERN = /^auramint_[A-Za-z0-9_-]{1,80}$/;

/** Order ids are generated by `createPremiumOrder`; anything else is rejected. */
export function isValidOrderId(value: unknown): value is string {
  return typeof value === "string" && ORDER_ID_PATTERN.test(value);
}

/**
 * Compares a provider-reported amount (major currency units, e.g. rupees) with the
 * amount stored in our `orders` row (minor units, i.e. paise).
 */
export function amountsMatch(
  providerAmountMajor: unknown,
  storedAmountMinor: unknown,
  toleranceMinor = 0
): boolean {
  const provider =
    typeof providerAmountMajor === "number" ? providerAmountMajor : Number(providerAmountMajor);
  const stored = typeof storedAmountMinor === "number" ? storedAmountMinor : Number(storedAmountMinor);
  if (!Number.isFinite(provider) || !Number.isFinite(stored)) return false;
  if (provider <= 0 || stored <= 0) return false;
  return Math.abs(Math.round(provider * 100) - Math.round(stored)) <= toleranceMinor;
}

// ─────────────────────────────────────────────────────────────
// Email
// ─────────────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[^\s@<>,;"'\\]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,}$/;

/** Validates a single recipient address (no display names, no CR/LF, bounded length). */
export function isValidEmailAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 254) return false;
  if (hasControlChars(value)) return false;
  return EMAIL_PATTERN.test(value);
}
