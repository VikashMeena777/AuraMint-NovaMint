/**
 * Final-pass regression tests for the work added in this pass (Node 24 native TS
 * type-stripping + the shared `_audit/loader.mjs` resolve hook).
 *
 * Run:  node --test _audit/backend-finalpass-tests.mjs
 *
 * Covers real application code, not copies:
 *  - `src/lib/rate-limit.ts`        — config reading, atomic EVAL payload, fail-closed
 *  - `src/lib/actions/feed-aggregates.ts` — reaction counts / viewer indexes
 *  - `src/lib/actions/payment-repair.ts`  — crash-window entitlement repair
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

register(pathToFileURL(path.join(here, "loader.mjs")).href);

const load = (relative) => import(pathToFileURL(path.join(root, relative)).href);

const rateLimit = await load("src/lib/rate-limit.ts");
const feedAggregates = await load("src/lib/actions/feed-aggregates.ts");
const paymentRepair = await load("src/lib/actions/payment-repair.ts");

const VALID_CONFIG = { url: "https://example.upstash.io", token: "t".repeat(32) };
const NOW = 1_700_000_000_000;

/** Minimal injected fetch that records the request and returns a canned payload. */
function fakeFetch(response, requests = []) {
  return async (url, init) => {
    requests.push({ url, init });
    if (response instanceof Error) throw response;
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      async json() {
        if (response.body instanceof Error) throw response.body;
        return response.body;
      },
    };
  };
}

function evalResult(current, ttl) {
  return { body: { result: [current, ttl] } };
}

// ─────────────────────────────────────────────────────────────
// 1. Rate-limit config + key derivation
// ─────────────────────────────────────────────────────────────

test("rate-limit: key is namespaced, deterministic and does not expose the subject", () => {
  const a = rateLimit.buildRateLimitKey("ai.submit_event", "user-abc");
  const b = rateLimit.buildRateLimitKey("ai.submit_event", "user-abc");
  const c = rateLimit.buildRateLimitKey("ai.submit_event", "user-xyz");
  const d = rateLimit.buildRateLimitKey("payment.create_order", "user-abc");

  assert.equal(a, b);
  assert.notEqual(a, c, "different subjects must not share a bucket");
  assert.notEqual(a, d, "different scopes must not share a bucket");
  assert.match(a, /^auramint:rl:ai\.submit_event:[0-9a-f]{32}$/);
  assert.equal(a.includes("user-abc"), false, "raw subject must not be part of the key");
});

test("rate-limit: readUpstashConfig is conservative about missing/short/bad config", () => {
  assert.equal(rateLimit.readUpstashConfig({}), null);
  assert.equal(rateLimit.readUpstashConfig({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io" }), null);
  assert.equal(rateLimit.readUpstashConfig({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "short" }), null);
  assert.equal(rateLimit.readUpstashConfig({ UPSTASH_REDIS_REST_URL: "not a url", UPSTASH_REDIS_REST_TOKEN: "t".repeat(32) }), null);
  assert.equal(rateLimit.readUpstashConfig({ UPSTASH_REDIS_REST_URL: "ftp://x/y", UPSTASH_REDIS_REST_TOKEN: "t".repeat(32) }), null);

  const parsed = rateLimit.readUpstashConfig({
    UPSTASH_REDIS_REST_URL: "  https://example.upstash.io/  ",
    UPSTASH_REDIS_REST_TOKEN: ` ${"t".repeat(32)} `,
  });
  assert.deepEqual(parsed, { url: "https://example.upstash.io", token: "t".repeat(32) });
});

// ─────────────────────────────────────────────────────────────
// 2. Atomic consumption / decision logic
// ─────────────────────────────────────────────────────────────

test("rate-limit: sends one atomic EVAL with the namespaced key and window", async () => {
  const requests = [];
  const decision = await rateLimit.consumeRateLimit({
    scope: "ai.submit_event",
    subject: "user-abc",
    limit: 30,
    windowSeconds: 3600,
    config: VALID_CONFIG,
    fetchImpl: fakeFetch(evalResult(1, 3_600_000), requests),
    now: () => NOW,
    environment: "production",
  });

  assert.equal(requests.length, 1);
  const body = JSON.parse(requests[0].init.body);
  assert.equal(body[0], "EVAL");
  assert.equal(body[1].includes("redis.call('INCR'"), true);
  assert.equal(body[1].includes("PEXPIRE"), true);
  assert.equal(body[2], "1", "numkeys must be 1");
  assert.equal(body[3], rateLimit.buildRateLimitKey("ai.submit_event", "user-abc"));
  assert.equal(body[4], "3600000");
  assert.equal(requests[0].init.headers.Authorization, `Bearer ${VALID_CONFIG.token}`);
  assert.ok(requests[0].init.signal instanceof AbortSignal, "provider call must be timeout-bounded");

  assert.equal(decision.allowed, true);
  assert.equal(decision.remaining, 29);
  assert.equal(decision.resetAtMs, NOW + 3_600_000);
});

test("rate-limit: allows at the limit and denies above it", async () => {
  const atLimit = await rateLimit.consumeRateLimit({
    scope: "ai.submit_event",
    subject: "u",
    limit: 30,
    windowSeconds: 3600,
    config: VALID_CONFIG,
    fetchImpl: fakeFetch(evalResult(30, 60_000)),
    now: () => NOW,
    environment: "production",
  });
  assert.equal(atLimit.allowed, true);
  assert.equal(atLimit.remaining, 0);

  const over = await rateLimit.consumeRateLimit({
    scope: "ai.submit_event",
    subject: "u",
    limit: 30,
    windowSeconds: 3600,
    config: VALID_CONFIG,
    fetchImpl: fakeFetch(evalResult(31, 30_000)),
    now: () => NOW,
    environment: "production",
  });
  assert.equal(over.allowed, false);
  assert.equal(over.reason, "limited");
  assert.equal(over.retryAfterSeconds, 30);
  assert.equal(over.resetAtMs, NOW + 30_000);
});

test("rate-limit: production fails closed on missing config, other envs degrade", async () => {
  const prod = await rateLimit.consumeRateLimit({
    scope: "ai.submit_event",
    subject: "u",
    limit: 30,
    windowSeconds: 3600,
    config: null,
    now: () => NOW,
    environment: "production",
  });
  assert.equal(prod.allowed, false);
  assert.equal(prod.reason, "misconfigured");

  const dev = await rateLimit.consumeRateLimit({
    scope: "ai.submit_event",
    subject: "u",
    limit: 30,
    windowSeconds: 3600,
    config: null,
    now: () => NOW,
    environment: "development",
  });
  assert.equal(dev.allowed, true);
  assert.equal(dev.degraded, true);
});

test("rate-limit: production fails closed on provider failures", async () => {
  const base = {
    scope: "payment.create_order",
    subject: "u",
    limit: 10,
    windowSeconds: 3600,
    config: VALID_CONFIG,
    now: () => NOW,
    environment: "production",
  };

  const nonOk = await rateLimit.consumeRateLimit({
    ...base,
    fetchImpl: fakeFetch({ ok: false, status: 502, body: {} }),
  });
  assert.equal(nonOk.allowed, false);
  assert.equal(nonOk.reason, "provider_error");

  const thrown = await rateLimit.consumeRateLimit({
    ...base,
    fetchImpl: fakeFetch(new Error("timeout")),
  });
  assert.equal(thrown.allowed, false);
  assert.equal(thrown.reason, "provider_error");

  const unparseable = await rateLimit.consumeRateLimit({
    ...base,
    fetchImpl: fakeFetch({ body: new Error("not json") }),
  });
  assert.equal(unparseable.allowed, false);
  assert.equal(unparseable.reason, "provider_error");

  const upstashError = await rateLimit.consumeRateLimit({
    ...base,
    fetchImpl: fakeFetch({ body: { error: "ERR unknown command 'EVAL'" } }),
  });
  assert.equal(upstashError.allowed, false);
  assert.equal(upstashError.reason, "provider_error");

  const badShape = await rateLimit.consumeRateLimit({
    ...base,
    fetchImpl: fakeFetch({ body: { result: "nope" } }),
  });
  assert.equal(badShape.allowed, false);
  assert.equal(badShape.reason, "provider_error");

  const nanCount = await rateLimit.consumeRateLimit({
    ...base,
    fetchImpl: fakeFetch({ body: { result: ["abc", 1000] } }),
  });
  assert.equal(nanCount.allowed, false);
  assert.equal(nanCount.reason, "provider_error");
});

test("rate-limit: production rejects a non-HTTPS Upstash URL", async () => {
  const decision = await rateLimit.consumeRateLimit({
    scope: "ai.submit_event",
    subject: "u",
    limit: 30,
    windowSeconds: 3600,
    config: { url: "http://example.upstash.io", token: "t".repeat(32) },
    fetchImpl: fakeFetch(evalResult(1, 1000)),
    environment: "production",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "misconfigured");
});

test("rate-limit: invalid budgets/scopes fail closed and never call the provider", async () => {
  const requests = [];
  for (const options of [
    { scope: "bad scope!", subject: "u", limit: 5, windowSeconds: 60 },
    { scope: "ok.scope", subject: "", limit: 5, windowSeconds: 60 },
    { scope: "ok.scope", subject: "u", limit: 0, windowSeconds: 60 },
    { scope: "ok.scope", subject: "u", limit: 5, windowSeconds: 0 },
    { scope: "ok.scope", subject: "u", limit: 1.5, windowSeconds: 60 },
  ]) {
    const decision = await rateLimit.consumeRateLimit({
      ...options,
      config: VALID_CONFIG,
      fetchImpl: fakeFetch(evalResult(1, 1000), requests),
      environment: "production",
    });
    assert.equal(decision.allowed, false, JSON.stringify(options));
    assert.equal(decision.reason, "misconfigured");
  }
  assert.equal(requests.length, 0);
});

test("rate-limit: a missing TTL falls back to the configured window", async () => {
  const decision = await rateLimit.consumeRateLimit({
    scope: "ai.submit_event",
    subject: "u",
    limit: 30,
    windowSeconds: 3600,
    config: VALID_CONFIG,
    fetchImpl: fakeFetch(evalResult(1, -1)),
    now: () => NOW,
    environment: "production",
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.resetAtMs, NOW + 3_600_000);
});

test("rate-limit: user messages never leak internals or the token", async () => {
  const limited = { allowed: false, reason: "limited", retryAfterSeconds: 42, resetAtMs: NOW };
  assert.match(rateLimit.rateLimitUserMessage(limited), /42s/);

  const down = { allowed: false, reason: "provider_error" };
  const message = rateLimit.rateLimitUserMessage(down);
  assert.equal(message.includes("upstash"), false);
  assert.equal(message.includes(VALID_CONFIG.token), false);
  assert.equal(message.length > 0, true);

  assert.equal(rateLimit.rateLimitUserMessage({ allowed: true, remaining: 1, resetAtMs: NOW }), "");
});

// ─────────────────────────────────────────────────────────────
// 3. Feed aggregates
// ─────────────────────────────────────────────────────────────

test("feed-aggregates: counts only allowlisted reaction types", () => {
  const rows = [
    { event_id: "e1", type: "crown" },
    { event_id: "e1", type: "crown" },
    { event_id: "e1", type: "fire" },
    { event_id: "e1", type: "<script>" },
    { event_id: "e2", type: "npc" },
    { event_id: "e2", type: "not_a_reaction" },
    { type: "crown" },
    { event_id: "", type: "crown" },
    null,
    "junk",
  ];

  const counts = feedAggregates.aggregateReactionCounts(rows);
  assert.deepEqual(counts.get("e1"), { crown: 2, fire: 1 });
  assert.deepEqual(counts.get("e2"), { npc: 1 });
  assert.equal(counts.has(""), false);
  assert.equal(feedAggregates.aggregateReactionCounts(null).size, 0);
  assert.equal(feedAggregates.aggregateReactionCounts("x").size, 0);
});

test("feed-aggregates: indexes the viewer's own vote and reaction only when valid", () => {
  const votes = feedAggregates.indexViewerVotes([
    { event_id: "e1", value: 1 },
    { event_id: "e2", value: -1 },
    { event_id: "e3", value: 7 },
    { event_id: "e4", value: "1" },
    { value: 1 },
    { event_id: "e5", value: null },
  ]);
  assert.equal(votes.get("e1"), 1);
  assert.equal(votes.get("e2"), -1);
  assert.equal(votes.has("e3"), false);
  assert.equal(votes.has("e4"), false);
  assert.equal(votes.has("e5"), false);

  const reactions = feedAggregates.indexViewerReactions([
    { event_id: "e1", type: "skull" },
    { event_id: "e2", type: "yikes" },
    { event_id: "e3", type: "bogus" },
    { type: "fire" },
  ]);
  assert.equal(reactions.get("e1"), "skull");
  assert.equal(reactions.get("e2"), "yikes");
  assert.equal(reactions.has("e3"), false);
});

// ─────────────────────────────────────────────────────────────
// 4. Payment crash-window repair
// ─────────────────────────────────────────────────────────────

test("payment-repair: decision table is fail-closed on unreadable state", () => {
  assert.equal(paymentRepair.decidePaidOrderRecovery(null), "unverified");
  assert.equal(paymentRepair.decidePaidOrderRecovery(undefined), "unverified");
  assert.equal(paymentRepair.decidePaidOrderRecovery({ found: false, isPremium: false }), "unverified");
  assert.equal(paymentRepair.decidePaidOrderRecovery({ found: true, isPremium: true }), "already_entitled");
  assert.equal(paymentRepair.decidePaidOrderRecovery({ found: true, isPremium: false }), "needs_grant");
  assert.equal(paymentRepair.decidePaidOrderRecovery({ found: true, isPremium: null }), "needs_grant");
});

function recoveryDeps(snapshot, { loadError, grantError } = {}) {
  const calls = { granted: [], logged: [] };
  return {
    calls,
    deps: {
      async loadEntitlement() {
        if (loadError) return { snapshot: null, error: "db down" };
        return { snapshot };
      },
      async grantPremium(userId) {
        calls.granted.push(userId);
        if (grantError) return { ok: false, error: "rls blocked" };
        return { ok: true };
      },
      async logEvent(userId, action, metadata) {
        calls.logged.push({ userId, action, metadata });
      },
    },
  };
}

test("payment-repair: already-premium orders are left untouched (no boost reset)", async () => {
  const { deps, calls } = recoveryDeps({ found: true, isPremium: true });
  const result = await paymentRepair.recoverPaidOrderEntitlement(deps, "user-1", "order-1");

  assert.deepEqual(result, { ok: true, recovered: false });
  assert.deepEqual(calls.granted, []);
  assert.deepEqual(calls.logged, []);
});

test("payment-repair: grants exactly once when premium is missing", async () => {
  const { deps, calls } = recoveryDeps({ found: true, isPremium: false });
  const result = await paymentRepair.recoverPaidOrderEntitlement(deps, "user-1", "order-1");

  assert.deepEqual(result, { ok: true, recovered: true });
  assert.deepEqual(calls.granted, ["user-1"]);
  assert.deepEqual(calls.logged, [
    { userId: "user-1", action: "payment.entitlement.recovered", metadata: { order_id: "order-1" } },
  ]);
});

test("payment-repair: never reports success when state is unreadable or grant fails", async () => {
  const unreadable = recoveryDeps({ found: true, isPremium: false }, { loadError: true });
  const r1 = await paymentRepair.recoverPaidOrderEntitlement(unreadable.deps, "user-1", "order-1");
  assert.equal(r1.ok, false);
  assert.deepEqual(unreadable.calls.granted, []);

  const missingProfile = recoveryDeps({ found: false, isPremium: null });
  const r2 = await paymentRepair.recoverPaidOrderEntitlement(missingProfile.deps, "user-1", "order-1");
  assert.equal(r2.ok, false);
  assert.deepEqual(missingProfile.calls.granted, []);

  const failedGrant = recoveryDeps({ found: true, isPremium: false }, { grantError: true });
  const r3 = await paymentRepair.recoverPaidOrderEntitlement(failedGrant.deps, "user-1", "order-1");
  assert.equal(r3.ok, false);
  assert.deepEqual(failedGrant.calls.logged, [], "no recovery is logged when the grant fails");

  const noUser = recoveryDeps({ found: true, isPremium: false });
  const r4 = await paymentRepair.recoverPaidOrderEntitlement(noUser.deps, "", "order-1");
  assert.equal(r4.ok, false);
  assert.deepEqual(noUser.calls.granted, []);
});
