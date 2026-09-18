/**
 * Dependency-free Upstash Redis REST rate limiter.
 *
 * Why no package: the Upstash REST API is a plain HTTPS endpoint, so one `fetch`
 * is enough. No dependency is added, and the whole limiter is injectable
 * (`fetchImpl`, `config`, `now`, `environment`) so it can be unit tested without a
 * network or a live Redis.
 *
 * Atomicity: the counter is incremented by a Lua script executed *inside Redis* via
 * `EVAL`. `INCR` + first-write expiry + `PTTL` therefore happen as one atomic step
 * per key — two concurrent requests for the same subject can never both create the
 * window or lose an increment. This is a fixed-window counter (the cheapest correct
 * primitive for abuse/AI-spend guardrails).
 *
 * Per-user keys: the caller supplies a subject (a server-verified user id). It is
 * SHA-256 hashed before it becomes part of the Redis key, so raw user ids are never
 * stored in Redis. The key is namespaced `auramint:rl:<scope>:<hash>`.
 *
 * Fail-closed: in production a missing configuration or any provider failure DENIES
 * the request. Outside production the limiter degrades to fail-open (with a warning)
 * so local development works without Upstash. The production behaviour is explicit
 * via `environment`, never implicit — a test can assert both modes.
 *
 * NOT a "use server" module: it has no directive and exports non-async helpers, so
 * it must never live in a "use server" file.
 */

import { createHash } from "node:crypto";

/** Env NAMES only — values are read from the process env at call time, never logged. */
export const UPSTASH_URL_ENV = "UPSTASH_REDIS_REST_URL";
export const UPSTASH_TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN";

/** Upstash REST tokens are long-lived secrets; a short value is a placeholder, not a token. */
export const MIN_RATE_LIMIT_TOKEN_LENGTH = 16;

/** Bound the provider call so a slow Redis cannot hang a Server Action / route. */
export const DEFAULT_RATE_LIMIT_TIMEOUT_MS = 2_000;

/**
 * Redis-side atomic counter.
 *
 * KEYS[1] = limiter key, ARGV[1] = window length in milliseconds.
 * Returns `{ currentCount, ttlMs }` so the caller can compute remaining/reset without
 * a second round-trip.
 */
const INCR_WITH_TTL_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {current, ttl}",
].join("\n");

export type UpstashConfig = { url: string; token: string };

export type RateLimitPolicy = { limit: number; windowSeconds: number };

/**
 * Server-owned policies. `limit` is the number of actions allowed per
 * `windowSeconds` per user. Call sites pass these rather than literals so the
 * budgets have a single source of truth.
 */
export const RATE_LIMITS = {
  /** Aura submissions are the only user-triggered AI spend in the product. */
  submitEvent: { limit: 30, windowSeconds: 3600 },
  /** Order creation writes rows and calls the payment provider. */
  createPremiumOrder: { limit: 10, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitDecision =
  | { allowed: true; remaining: number; resetAtMs: number; degraded?: true }
  | { allowed: false; reason: "limited"; retryAfterSeconds: number; resetAtMs: number }
  | { allowed: false; reason: "misconfigured" | "provider_error" };

/** Structural fetch type so tests can inject a fake without a real Response. */
export type RateLimitFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type ConsumeRateLimitOptions = {
  /** Namespaced action name, e.g. "ai.submit_event". */
  scope: string;
  /** Server-verified identity the budget applies to (a user id). */
  subject: string;
  limit: number;
  windowSeconds: number;
  /**
   * Redis config. Omit to read it from the environment. Pass `null` explicitly to
   * force the "not configured" path (used by tests).
   */
  config?: UpstashConfig | null;
  fetchImpl?: RateLimitFetch;
  now?: () => number;
  /** `production` fails closed; anything else degrades to fail-open. */
  environment?: string;
  timeoutMs?: number;
};

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isValidScope(scope: unknown): scope is string {
  return typeof scope === "string" && /^[a-z0-9._-]{1,64}$/i.test(scope);
}

/** Hashes the subject so raw user ids are not stored as Redis keys. */
export function hashRateLimitSubject(subject: string): string {
  return createHash("sha256").update(subject, "utf8").digest("hex").slice(0, 32);
}

export function buildRateLimitKey(scope: string, subject: string): string {
  return `auramint:rl:${scope}:${hashRateLimitSubject(subject)}`;
}

/**
 * Reads the Upstash REST config from the environment.
 *
 * Returns `null` when the URL or token is absent/blank/short or the URL is not a
 * parseable http(s) URL. Never throws and never returns the token in an error.
 */
export function readUpstashConfig(
  env: Record<string, string | undefined> = process.env
): UpstashConfig | null {
  const url = env[UPSTASH_URL_ENV]?.trim() ?? "";
  const token = env[UPSTASH_TOKEN_ENV]?.trim() ?? "";
  if (url.length === 0 || token.length < MIN_RATE_LIMIT_TOKEN_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  // Normalise the trailing slash so the command URL is well-formed either way.
  return { url: parsed.origin + parsed.pathname.replace(/\/+$/, ""), token };
}

function isAcceptableUrl(rawUrl: string, requireHttps: boolean): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (requireHttps) return parsed.protocol === "https:";
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Consumes one unit of the subject's budget for `scope`.
 *
 * Denies (`allowed: false`) when the count exceeds the limit, and — in production —
 * whenever the limiter cannot make a trustworthy decision (missing config, non-2xx,
 * malformed response, timeout). Outside production those cases return
 * `{ allowed: true, degraded: true }` so the app stays usable with a loud warning.
 */
export async function consumeRateLimit(
  options: ConsumeRateLimitOptions
): Promise<RateLimitDecision> {
  const {
    scope,
    subject,
    limit,
    windowSeconds,
    fetchImpl,
    now = Date.now,
    environment = process.env.NODE_ENV ?? "development",
    timeoutMs = DEFAULT_RATE_LIMIT_TIMEOUT_MS,
  } = options;

  const failClosed = environment === "production";
  const fallbackWindowMs = isPositiveInt(windowSeconds) ? windowSeconds * 1000 : 60_000;

  /** Provider/config failure policy: deny in production, degrade elsewhere. */
  const unavailable = (reason: "misconfigured" | "provider_error"): RateLimitDecision =>
    failClosed
      ? { allowed: false, reason }
      : { allowed: true, remaining: 0, resetAtMs: now() + fallbackWindowMs, degraded: true };

  if (!isValidScope(scope) || typeof subject !== "string" || subject.length === 0) {
    console.error("[rate-limit] Invalid limiter scope/subject");
    return unavailable("misconfigured");
  }
  if (!isPositiveInt(limit) || !isPositiveInt(windowSeconds)) {
    console.error("[rate-limit] Invalid limiter budget", { scope });
    return unavailable("misconfigured");
  }

  const config = options.config === undefined ? readUpstashConfig() : options.config;
  if (!config) {
    console.error(
      `[rate-limit] ${UPSTASH_URL_ENV}/${UPSTASH_TOKEN_ENV} are not configured`,
      { scope }
    );
    return unavailable("misconfigured");
  }
  if (!isAcceptableUrl(config.url, failClosed)) {
    console.error("[rate-limit] Configured Upstash URL is not acceptable", { scope });
    return unavailable("misconfigured");
  }

  const key = buildRateLimitKey(scope, subject);
  const windowMs = Math.round(windowSeconds * 1000);
  const startedAt = now();

  const doFetch: RateLimitFetch = fetchImpl ?? ((url, init) => fetch(url, init));

  try {
    const response = await doFetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      // Upstash REST: any Redis command as a JSON array on the base URL.
      body: JSON.stringify(["EVAL", INCR_WITH_TTL_SCRIPT, "1", key, String(windowMs)]),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      // Never include the token or request body in the log line.
      console.error("[rate-limit] Upstash returned a non-OK status", { scope, status: response.status });
      return unavailable("provider_error");
    }

    const payload = await response.json().catch(() => null);
    if (typeof payload !== "object" || payload === null) {
      console.error("[rate-limit] Upstash response was not a JSON object", { scope });
      return unavailable("provider_error");
    }
    if ("error" in payload && (payload as { error?: unknown }).error) {
      console.error("[rate-limit] Upstash returned an error result", { scope });
      return unavailable("provider_error");
    }

    const result = (payload as { result?: unknown }).result;
    if (!Array.isArray(result) || result.length < 2) {
      console.error("[rate-limit] Upstash EVAL returned an unexpected shape", { scope });
      return unavailable("provider_error");
    }

    const current = Number(result[0]);
    const ttlRaw = Number(result[1]);
    if (!Number.isFinite(current) || current < 1) {
      console.error("[rate-limit] Upstash EVAL returned a non-numeric count", { scope });
      return unavailable("provider_error");
    }

    // ttl is -1/-2 only if the script's own PEXPIRE did not apply; fall back to the window.
    const ttlMs = Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : windowMs;
    const resetAtMs = startedAt + ttlMs;

    if (current > limit) {
      return {
        allowed: false,
        reason: "limited",
        retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
        resetAtMs,
      };
    }

    return { allowed: true, remaining: Math.max(0, limit - current), resetAtMs };
  } catch (err) {
    // Log only the error class — never the token, URL, or request body.
    console.error("[rate-limit] Upstash request failed", {
      scope,
      kind: err instanceof Error ? err.name : "unknown",
    });
    return unavailable("provider_error");
  }
}

/** User-facing message for a denied decision (never leaks the limiter internals). */
export function rateLimitUserMessage(decision: RateLimitDecision): string {
  if (decision.allowed) return "";
  if (decision.reason === "limited") {
    return `Whoa, slow down. Please try again in ${decision.retryAfterSeconds}s.`;
  }
  return "Service temporarily unavailable. Please try again shortly.";
}
