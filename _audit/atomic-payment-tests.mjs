/**
 * Atomic payment fulfillment regressions.
 *
 * Run:  node --test _audit/atomic-payment-tests.mjs
 *
 * Everything below exercises real application code (Node 24 native TS type-stripping
 * + the shared `_audit/loader.mjs` resolve hook) with injected/stubbed transports —
 * no live database, provider, or network calls.
 *
 *  1. `payment-fulfillment.ts` — the service-only wrapper: exact RPC name and bound
 *     parameters, result passthrough, and fail-closed handling of error results,
 *     thrown transports, null and malformed payloads, and missing/invalid identities.
 *  2. `payment-fulfillment.ts` — `reconcilePremiumEntitlements`: exact RPC + bounds.
 *  3. `payment-webhook.ts`      — the atomic success contract: after amount/currency
 *     verification, one `fulfillOrder(orderId, userId)` decides the outcome.
 *  4. `payment-webhook.ts`      — failure path terminal states (REFUNDED preserved).
 *  5. `premium.ts`              — `markOrderFailed` only moves PENDING → FAILED,
 *     located by `cashfree_order_id`; PAID/FAILED/REFUNDED rows are untouched.
 *  6. Source wiring guards      — no production caller of the legacy claim/grant/
 *     recovery helpers; routes and payment-actions use the atomic surface.
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

register(pathToFileURL(path.join(here, "loader.mjs")).href);

const load = (relative) => import(pathToFileURL(path.join(root, relative)).href);

const fulfillment = await load("src/lib/actions/payment-fulfillment.ts");
const premium = await load("src/lib/actions/premium.ts");
const webhook = await load("src/lib/actions/payment-webhook.ts");

const ORDER_ID = "auramint_1234abcd_1712345678901";
const USER_ID = "3f1b0c5a-1d2e-4f5a-9b8c-7d6e5f4a3b2c";

// ─────────────────────────────────────────────────────────────
// 0. Product constants the wrapper binds into the RPC
// ─────────────────────────────────────────────────────────────

test("plan constants are pinned (₹99 in paise, INR, 5 boosts)", () => {
  assert.equal(premium.PLAN_PRICE_PAISE, 9900);
  assert.equal(premium.PLAN_CURRENCY, "INR");
  assert.equal(premium.PREMIUM_BOOSTS_GRANT, 5);
});

// ─────────────────────────────────────────────────────────────
// 1. fulfillPremiumOrder — exact RPC contract
// ─────────────────────────────────────────────────────────────

/** Minimal stand-in for the Supabase client's `.rpc()` surface. */
function rpcStub(handler) {
  const calls = [];
  return {
    calls,
    client: {
      async rpc(name, params) {
        calls.push({ name, params });
        return handler(name, params);
      },
    },
  };
}

test("fulfillment: calls fulfill_premium_order with exactly the bound parameters", async () => {
  const { client, calls } = rpcStub(async () => ({
    data: { applied: true, recovered: false },
    error: null,
  }));

  const result = await fulfillment.fulfillPremiumOrder(client, ORDER_ID, USER_ID);

  assert.deepEqual(result, { ok: true, applied: true, recovered: false });
  assert.equal(calls.length, 1, "exactly one RPC call per fulfillment");
  assert.equal(calls[0].name, "fulfill_premium_order");
  assert.deepEqual(calls[0].params, {
    p_order_id: ORDER_ID,
    p_user_id: USER_ID,
    p_amount_minor: 9900,
    p_currency: "INR",
  });
  // Exact key set: no extra/renamed parameters the SQL function would reject.
  assert.deepEqual(Object.keys(calls[0].params).sort(), [
    "p_amount_minor",
    "p_currency",
    "p_order_id",
    "p_user_id",
  ]);
});

test("fulfillment: every applied/recovered combination passes through unchanged", async () => {
  const cases = [
    { applied: true, recovered: false },
    { applied: true, recovered: true },
    { applied: false, recovered: true },
    { applied: false, recovered: false },
  ];
  for (const data of cases) {
    const { client } = rpcStub(async () => ({ data, error: null }));
    const result = await fulfillment.fulfillPremiumOrder(client, ORDER_ID, USER_ID);
    assert.deepEqual(result, { ok: true, ...data }, JSON.stringify(data));
  }
});

test("fulfillment: a database error is surfaced verbatim and never reported ok", async () => {
  const { client, calls } = rpcStub(async () => ({
    data: null,
    error: { message: 'function public.fulfill_premium_order(text, uuid, numeric, text) does not exist' },
  }));

  const result = await fulfillment.fulfillPremiumOrder(client, ORDER_ID, USER_ID);

  assert.equal(result.ok, false);
  assert.equal(
    result.error,
    'function public.fulfill_premium_order(text, uuid, numeric, text) does not exist'
  );
  assert.equal(calls.length, 1);
});

test("fulfillment: a thrown transport fails closed without leaking the thrown message", async () => {
  const { client } = rpcStub(async () => {
    throw new Error("connection terminated: postgres://user:pw@host/db");
  });

  const result = await fulfillment.fulfillPremiumOrder(client, ORDER_ID, USER_ID);

  assert.deepEqual(result, { ok: false, error: "Fulfillment unavailable" });
  assert.equal(JSON.stringify(result).includes("postgres://"), false);
});

test("fulfillment: null and malformed RPC payloads are refused, never treated as applied", async () => {
  const malformed = [
    null,
    undefined,
    {},
    { applied: true },
    { recovered: false },
    { applied: "true", recovered: "false" },
    { applied: 1, recovered: 0 },
    { applied: true, recovered: null },
    { applied: null, recovered: false },
    [true, false],
    "ok",
    42,
    true,
  ];

  for (const data of malformed) {
    const { client } = rpcStub(async () => ({ data, error: null }));
    const result = await fulfillment.fulfillPremiumOrder(client, ORDER_ID, USER_ID);
    assert.equal(result.ok, false, `expected refusal for ${JSON.stringify(data)}`);
    assert.equal(result.error, "Unverified fulfillment result");
    assert.equal("applied" in result, false, "no unverified applied flag may escape");
  }
});

test("fulfillment: missing or malformed identities never reach the RPC", async () => {
  const badOrderIds = [
    "",
    "   ",
    null,
    undefined,
    42,
    {},
    [],
    "CF_ORDER_123",
    "auramint_../../admin",
    "AURAMINT_1234abcd_1712345678901",
    `auramint_${"a".repeat(81)}`,
    `${ORDER_ID} `,
  ];
  const badUserIds = [
    "",
    "   ",
    null,
    undefined,
    42,
    {},
    [],
    "user-1",
    "3f1b0c5a-1d2e-4f5a-9b8c-7d6e5f4a3b2",
    "3f1b0c5a-1d2e-4f5a-9b8c-7d6e5f4a3b2c ",
  ];

  for (const orderId of badOrderIds) {
    const { client, calls } = rpcStub(async () => ({ data: { applied: true, recovered: false }, error: null }));
    const result = await fulfillment.fulfillPremiumOrder(client, orderId, USER_ID);
    assert.deepEqual(result, { ok: false, error: "Invalid fulfillment identity" }, `order ${JSON.stringify(orderId)}`);
    assert.equal(calls.length, 0, "a rejected identity must not reach the RPC");
  }

  for (const userId of badUserIds) {
    const { client, calls } = rpcStub(async () => ({ data: { applied: true, recovered: false }, error: null }));
    const result = await fulfillment.fulfillPremiumOrder(client, ORDER_ID, userId);
    assert.deepEqual(result, { ok: false, error: "Invalid fulfillment identity" }, `user ${JSON.stringify(userId)}`);
    assert.equal(calls.length, 0, "a rejected identity must not reach the RPC");
  }

  // A canonical UUID (any case) is a valid identity.
  const upper = rpcStub(async () => ({ data: { applied: true, recovered: false }, error: null }));
  const accepted = await fulfillment.fulfillPremiumOrder(
    upper.client,
    ORDER_ID,
    USER_ID.toUpperCase()
  );
  assert.deepEqual(accepted, { ok: true, applied: true, recovered: false });
});

// ─────────────────────────────────────────────────────────────
// 2. reconcilePremiumEntitlements — exact RPC + bounds
// ─────────────────────────────────────────────────────────────

test("reconcile: calls reconcile_premium_entitlements with a bounded limit", async () => {
  const { client, calls } = rpcStub(async () => ({
    data: { attempted: 5, repaired: 2, failed: 1 },
    error: null,
  }));

  const result = await fulfillment.reconcilePremiumEntitlements(client);

  assert.deepEqual(result, { ok: true, attempted: 5, repaired: 2, failed: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "reconcile_premium_entitlements");
  assert.deepEqual(calls[0].params, { p_limit: 100 });
  assert.deepEqual(Object.keys(calls[0].params), ["p_limit"]);
});

test("reconcile: zero counts and the boundary value 100 are accepted", async () => {
  const zero = rpcStub(async () => ({ data: { attempted: 0, repaired: 0, failed: 0 }, error: null }));
  assert.deepEqual(await fulfillment.reconcilePremiumEntitlements(zero.client), {
    ok: true,
    attempted: 0,
    repaired: 0,
    failed: 0,
  });

  const boundary = rpcStub(async () => ({ data: { attempted: 100, repaired: 40, failed: 60 }, error: null }));
  assert.deepEqual(await fulfillment.reconcilePremiumEntitlements(boundary.client), {
    ok: true,
    attempted: 100,
    repaired: 40,
    failed: 60,
  });
});

test("reconcile: impossible or out-of-bounds counts are refused", async () => {
  const invalid = [
    { attempted: 1, repaired: 1, failed: 1 }, // repaired + failed > attempted
    { attempted: 0, repaired: 0, failed: 1 },
    { attempted: 101, repaired: 0, failed: 0 },
    { attempted: 5, repaired: -1, failed: 0 },
    { attempted: 5, repaired: 5.5, failed: 0 },
    { attempted: "5", repaired: 1, failed: 1 },
    { attempted: Number.NaN, repaired: 0, failed: 0 },
    { attempted: true, repaired: 0, failed: 0 },
    { attempted: 5, repaired: 1 },
    {},
    null,
    undefined,
    [],
    "ok",
  ];

  for (const data of invalid) {
    const { client } = rpcStub(async () => ({ data, error: null }));
    const result = await fulfillment.reconcilePremiumEntitlements(client);
    assert.equal(result.ok, false, `expected refusal for ${JSON.stringify(data)}`);
    assert.equal(result.error, "Unverified reconciliation result");
    assert.equal("attempted" in result, false);
  }
});

test("reconcile: errors and thrown transports fail closed", async () => {
  const errored = rpcStub(async () => ({ data: null, error: { message: "permission denied for function" } }));
  assert.deepEqual(await fulfillment.reconcilePremiumEntitlements(errored.client), {
    ok: false,
    error: "permission denied for function",
  });

  const thrown = rpcStub(async () => {
    throw new Error("connection terminated unexpectedly");
  });
  const result = await fulfillment.reconcilePremiumEntitlements(thrown.client);
  assert.deepEqual(result, { ok: false, error: "Reconciliation unavailable" });
  assert.equal(JSON.stringify(result).includes("connection terminated"), false);
});

// ─────────────────────────────────────────────────────────────
// 3. Webhook atomic success path (dependency-injected core)
// ─────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = "webhook_secret_0123456789";

function sign(body, timestamp, secret = WEBHOOK_SECRET) {
  return createHmac("sha256", secret).update(`${timestamp}${body}`).digest("base64");
}

const DEFAULT_ORDER = {
  id: USER_ID, // the UUID primary key
  cashfree_order_id: ORDER_ID,
  user_id: "user-1",
  status: "PENDING",
  amount: 9900,
  currency: "INR",
};

function makeDeps(overrides = {}) {
  const calls = { fulfilled: [], failed: 0, logged: [], reads: 0 };
  const order = "order" in overrides ? overrides.order : DEFAULT_ORDER;

  const deps = {
    async getOrder(orderId) {
      calls.reads += 1;
      if (overrides.getOrderError) return { order: null, error: "db down" };
      if (!order || orderId !== order.cashfree_order_id) return { order: null };
      return { order };
    },
    async fulfillOrder(orderId, userId) {
      calls.fulfilled.push([orderId, userId]);
      if (overrides.fulfillError) return { ok: false, error: overrides.fulfillError };
      return {
        ok: true,
        applied: overrides.applied ?? true,
        recovered: overrides.recovered ?? false,
      };
    },
    async markOrderFailed() {
      calls.failed += 1;
      if (overrides.markError) return { ok: false, error: "db down" };
      return { ok: true, updated: overrides.failedUpdated ?? true };
    },
    async logEvent(userId, action, metadata) {
      calls.logged.push({ userId, action, metadata });
    },
  };

  return { deps, calls };
}

function successBody({ order = {}, payment = {}, omitOrder = [], omitPayment = [] } = {}) {
  const orderPayload = {
    order_id: ORDER_ID,
    order_amount: 99,
    order_currency: "INR",
    order_status: "PAID",
    ...order,
  };
  const paymentPayload = { payment_amount: 99, payment_status: "SUCCESS", ...payment };
  for (const key of omitOrder) delete orderPayload[key];
  for (const key of omitPayment) delete paymentPayload[key];

  return JSON.stringify({
    type: "PAYMENT_SUCCESS_WEBHOOK",
    data: { order: orderPayload, payment: paymentPayload },
  });
}

async function handle(body, { deps, timestamp = "1712345678", secret = WEBHOOK_SECRET } = {}) {
  return webhook.handleCashfreeWebhookEvent({
    rawBody: body,
    timestamp,
    signature: sign(body, timestamp, secret),
    secret,
    deps,
  });
}

test("webhook: a verified delivery fulfills atomically exactly once and reports OK", async () => {
  const { deps, calls } = makeDeps();
  const result = await handle(successBody(), { deps });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, "OK");
  assert.deepEqual(calls.fulfilled, [[ORDER_ID, "user-1"]], "one fulfillOrder(orderId, userId) call");
  assert.equal(
    calls.logged.some((l) => l.action === "payment.webhook.success" && l.metadata?.order_id === ORDER_ID),
    true
  );
});

test("webhook: an RPC that applied nothing and recovered nothing reports Already processed", async () => {
  const { deps, calls } = makeDeps({ applied: false, recovered: false });
  const result = await handle(successBody(), { deps });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, "Already processed");
  assert.equal(calls.fulfilled.length, 1, "the atomic RPC is the idempotency decision point");
  assert.equal(calls.logged.some((l) => l.action === "payment.webhook.success"), false);
  assert.equal(calls.logged.some((l) => l.action === "payment.webhook.recovered"), false);
});

test("webhook: an RPC that recovered a missing entitlement reports Recovered", async () => {
  const { deps, calls } = makeDeps({ applied: false, recovered: true });
  const result = await handle(successBody(), { deps });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, "Recovered");
  assert.equal(calls.fulfilled.length, 1);
  assert.equal(
    calls.logged.some((l) => l.action === "payment.webhook.recovered" && l.metadata?.order_id === ORDER_ID),
    true
  );
});

test("webhook: recovered takes precedence in the response when both flags are set", async () => {
  // The landed contract maps the response from `recovered`; pin it so a future
  // refactor cannot silently turn a repair back into a plain "OK".
  const { deps } = makeDeps({ applied: true, recovered: true });
  const result = await handle(successBody(), { deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.message, "Recovered");
});

test("webhook: a pre-existing PAID row is still decided by the atomic RPC, not an app-level CAS", async () => {
  const { deps, calls } = makeDeps({
    order: { ...DEFAULT_ORDER, status: "PAID" },
    applied: false,
    recovered: false,
  });
  const result = await handle(successBody(), { deps });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, "Already processed");
  assert.deepEqual(calls.fulfilled, [[ORDER_ID, "user-1"]]);
});

test("webhook: fulfillment failure asks for a retry (500) and never reports success", async () => {
  const { deps, calls } = makeDeps({ fulfillError: "rpc failed: serialization failure" });
  const result = await handle(successBody(), { deps });

  assert.equal(result.status, 500);
  assert.equal(calls.fulfilled.length, 1, "no retry loop inside one delivery");
  assert.equal(calls.logged.some((l) => l.action === "payment.webhook.success"), false);
  assert.equal(calls.logged.some((l) => l.action === "payment.webhook.recovered"), false);
});

test("webhook: signature and configuration failures never reach fulfillment", async () => {
  const body = successBody();

  const forged = makeDeps();
  const forgedResult = await webhook.handleCashfreeWebhookEvent({
    rawBody: body,
    timestamp: "1712345678",
    signature: sign(body, "1712345678", "wrong_secret"),
    secret: WEBHOOK_SECRET,
    deps: forged.deps,
  });
  assert.equal(forgedResult.status, 401);
  assert.deepEqual(forged.calls.fulfilled, []);

  const wrongTimestamp = makeDeps();
  const wrongTimestampResult = await webhook.handleCashfreeWebhookEvent({
    rawBody: body,
    timestamp: "9999999999",
    signature: sign(body, "1712345678"),
    secret: WEBHOOK_SECRET,
    deps: wrongTimestamp.deps,
  });
  assert.equal(wrongTimestampResult.status, 401);
  assert.deepEqual(wrongTimestamp.calls.fulfilled, []);

  const noTimestamp = makeDeps();
  const noTimestampResult = await webhook.handleCashfreeWebhookEvent({
    rawBody: body,
    timestamp: null,
    signature: "whatever",
    secret: WEBHOOK_SECRET,
    deps: noTimestamp.deps,
  });
  assert.equal(noTimestampResult.status, 401);
  assert.deepEqual(noTimestamp.calls.fulfilled, []);

  const noSecret = makeDeps();
  const noSecretResult = await webhook.handleCashfreeWebhookEvent({
    rawBody: body,
    timestamp: "1712345678",
    signature: "whatever",
    secret: undefined,
    deps: noSecret.deps,
  });
  assert.equal(noSecretResult.status, 503);
  assert.deepEqual(noSecret.calls.fulfilled, []);

  const badJson = makeDeps();
  assert.equal((await handle("{not json", { deps: badJson.deps })).status, 400);
  assert.deepEqual(badJson.calls.fulfilled, []);
});

test("webhook: amount and currency refusals never reach fulfillment", async () => {
  const mismatchedAmount = makeDeps();
  const amountResult = await handle(successBody({ order: { order_amount: 1 } }), {
    deps: mismatchedAmount.deps,
  });
  assert.equal(amountResult.status, 200);
  assert.equal(amountResult.body.message, "Amount mismatch");
  assert.deepEqual(mismatchedAmount.calls.fulfilled, []);
  assert.equal(
    mismatchedAmount.calls.logged.some((l) => l.action === "payment.amount_mismatch"),
    true
  );

  const mismatchedCurrency = makeDeps();
  const currencyResult = await handle(successBody({ order: { order_currency: "USD" } }), {
    deps: mismatchedCurrency.deps,
  });
  assert.equal(currencyResult.status, 200);
  assert.equal(currencyResult.body.message, "Currency mismatch");
  assert.deepEqual(mismatchedCurrency.calls.fulfilled, []);

  const nonPlan = makeDeps({ order: { ...DEFAULT_ORDER, currency: "USD" } });
  const nonPlanResult = await handle(successBody({ order: { order_currency: "USD" } }), {
    deps: nonPlan.deps,
  });
  assert.equal(nonPlanResult.body.message, "Currency not supported");
  assert.deepEqual(nonPlan.calls.fulfilled, []);

  for (const amount of [null, undefined, 0, -9900, Number.NaN, "abc", ""]) {
    const { deps, calls } = makeDeps({ order: { ...DEFAULT_ORDER, amount } });
    const result = await handle(successBody(), { deps });
    assert.equal(result.body.message, "Amount unverifiable", JSON.stringify(amount));
    assert.deepEqual(calls.fulfilled, []);
  }

  for (const currency of [null, undefined, "", "  ", "US", 123]) {
    const { deps, calls } = makeDeps({ order: { ...DEFAULT_ORDER, currency } });
    const result = await handle(successBody(), { deps });
    assert.equal(result.body.message, "Currency unverifiable", JSON.stringify(currency));
    assert.deepEqual(calls.fulfilled, []);
  }

  const missingProviderAmount = makeDeps();
  const missingResult = await handle(
    successBody({ omitOrder: ["order_amount"], omitPayment: ["payment_amount"] }),
    { deps: missingProviderAmount.deps }
  );
  assert.equal(missingResult.body.message, "Amount unverifiable");
  assert.deepEqual(missingProviderAmount.calls.fulfilled, []);
});

test("webhook: unknown orders, orphan orders and lookup errors never reach fulfillment", async () => {
  const unknown = makeDeps();
  const unknownResult = await handle(successBody({ order: { order_id: "auramint_unknown_1" } }), {
    deps: unknown.deps,
  });
  assert.equal(unknownResult.status, 200);
  assert.deepEqual(unknown.calls.fulfilled, []);

  const traversal = makeDeps();
  const traversalResult = await handle(successBody({ order: { order_id: "auramint_../../admin" } }), {
    deps: traversal.deps,
  });
  assert.equal(traversalResult.status, 200);
  assert.equal(traversalResult.body.message, "Ignored");
  assert.deepEqual(traversal.calls.fulfilled, []);

  const orphan = makeDeps({ order: { ...DEFAULT_ORDER, user_id: null } });
  const orphanResult = await handle(successBody(), { deps: orphan.deps });
  assert.equal(orphanResult.status, 200);
  assert.equal(orphanResult.body.message, "Order has no owner");
  assert.deepEqual(orphan.calls.fulfilled, []);

  const lookupError = makeDeps({ getOrderError: true });
  const lookupResult = await handle(successBody(), { deps: lookupError.deps });
  assert.equal(lookupResult.status, 500);
  assert.deepEqual(lookupError.calls.fulfilled, []);
});

// ─────────────────────────────────────────────────────────────
// 4. Webhook failure path — terminal states include REFUNDED
// ─────────────────────────────────────────────────────────────

const FAILED_BODY = JSON.stringify({
  type: "PAYMENT_FAILED_WEBHOOK",
  data: { order: { order_id: ORDER_ID, order_status: "FAILED" } },
});

test("webhook: a failure event only marks the order and never fulfills", async () => {
  const { deps, calls } = makeDeps();
  const result = await handle(FAILED_BODY, { deps });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, "OK");
  assert.equal(calls.failed, 1);
  assert.deepEqual(calls.fulfilled, []);
});

test("webhook: a zero-row failure update acknowledges confirmed terminal states (PAID/FAILED/REFUNDED)", async () => {
  for (const status of ["PAID", "FAILED", "REFUNDED"]) {
    const { deps, calls } = makeDeps({
      order: { ...DEFAULT_ORDER, status },
      failedUpdated: false,
    });
    const result = await handle(FAILED_BODY, { deps });
    assert.equal(result.status, 200, `status ${status}`);
    assert.equal(result.body.message, "Already processed", `status ${status}`);
    assert.deepEqual(calls.fulfilled, []);
  }
});

test("webhook: a REFUNDED row is preserved on a late failure event (no PENDING→FAILED match)", async () => {
  // The row reads back REFUNDED; the webhook must neither reclassify it nor report
  // the failure transition as verified for a non-terminal, non-refunded state.
  const { deps, calls } = makeDeps({
    order: { ...DEFAULT_ORDER, status: "REFUNDED" },
    failedUpdated: false,
  });
  assert.equal((await handle(FAILED_BODY, { deps })).status, 200);
  assert.deepEqual(calls.fulfilled, []);
});

test("webhook: a still-PENDING zero-row failure is unverified and asks for a retry", async () => {
  const pending = makeDeps({ order: { ...DEFAULT_ORDER, status: "PENDING" }, failedUpdated: false });
  const pendingResult = await handle(FAILED_BODY, { deps: pending.deps });
  assert.equal(pendingResult.status, 500);
  assert.equal(pendingResult.body.message, "Failure transition unverified");

  let reads = 0;
  const readbackError = makeDeps({ failedUpdated: false });
  const originalGetOrder = readbackError.deps.getOrder;
  readbackError.deps.getOrder = async (orderId) => {
    reads += 1;
    if (reads === 1) return originalGetOrder(orderId);
    return { order: null, error: "db down" };
  };
  assert.equal((await handle(FAILED_BODY, { deps: readbackError.deps })).status, 500);

  const markError = makeDeps({ markError: true });
  const markErrorResult = await handle(FAILED_BODY, { deps: markError.deps });
  assert.equal(markErrorResult.status, 500);
  assert.equal(markErrorResult.body.message, "Processing failed");
});

test("webhook: an empty payload with no order id is acknowledged without any state change", async () => {
  const { deps, calls } = makeDeps();
  const result = await handle(JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: {} }), { deps });
  assert.equal(result.status, 200);
  assert.equal(result.body.message, "No order_id");
  assert.deepEqual(calls.fulfilled, []);
});

// ─────────────────────────────────────────────────────────────
// 5. markOrderFailed — PENDING → FAILED, located by cashfree_order_id
// ─────────────────────────────────────────────────────────────

/** Minimal chainable stand-in for the PostgREST builder used by premium.ts. */
function ordersStub({ rows = [], error = null } = {}) {
  const calls = { from: null, update: null, eq: [], neq: [], select: null };
  const result = error ? { data: null, error } : { data: rows, error: null };

  const builder = {
    update(payload) {
      calls.update = payload;
      return builder;
    },
    eq(column, value) {
      calls.eq.push([column, value]);
      return builder;
    },
    neq(column, value) {
      calls.neq.push([column, value]);
      return builder;
    },
    select(columns) {
      calls.select = columns;
      return Promise.resolve(result);
    },
  };

  return {
    calls,
    client: {
      from(table) {
        calls.from = table;
        return builder;
      },
    },
  };
}

test("premium: markOrderFailed only moves PENDING rows, located by cashfree_order_id", async () => {
  const { client, calls } = ordersStub({ rows: [{ id: USER_ID }] });
  const result = await premium.markOrderFailed(client, ORDER_ID);

  assert.deepEqual(result, { ok: true, updated: true });
  assert.equal(calls.from, "orders");
  assert.deepEqual(calls.update, { status: "FAILED" });
  assert.deepEqual(calls.neq, [], "neq filters are replaced by the PENDING predicate");
  const predicates = calls.eq.map(([column, value]) => `${column}=${value}`).sort();
  assert.deepEqual(
    predicates,
    [`cashfree_order_id=${ORDER_ID}`, "status=PENDING"].sort(),
    "the update must target the merchant order id and only the PENDING state"
  );
  assert.equal(
    calls.eq.some(([column]) => column === "id"),
    false,
    "the UUID primary key must not be the lookup column"
  );
  assert.equal(calls.select, "id");
});

test("premium: markOrderFailed leaves PAID/FAILED/REFUNDED rows untouched", async () => {
  // The DB matches zero rows for every non-PENDING status; the helper must report
  // ok with updated:false so the webhook re-reads instead of assuming a change.
  const { client, calls } = ordersStub({ rows: [] });
  const result = await premium.markOrderFailed(client, ORDER_ID);
  assert.deepEqual(result, { ok: true, updated: false });
  assert.deepEqual(calls.update, { status: "FAILED" });
  assert.deepEqual(calls.neq, []);
});

test("premium: markOrderFailed propagates database errors with updated:false", async () => {
  const { client } = ordersStub({ error: { message: "permission denied for table orders" } });
  const result = await premium.markOrderFailed(client, ORDER_ID);
  assert.deepEqual(result, { ok: false, error: "permission denied for table orders", updated: false });
});

// ─────────────────────────────────────────────────────────────
// 6. Source wiring guards (stale legacy wiring must be gone)
// ─────────────────────────────────────────────────────────────

const readSource = (relative) => readFileSync(path.join(root, relative), "utf8");

const LEGACY_IDENTIFIERS = [
  "claimOrderAsPaid",
  "revertOrderClaim",
  "grantPremiumEntitlements",
  "recoverOrderEntitlements",
  "recoverPaidOrderEntitlement",
  "decidePaidOrderRecovery",
];

test("wiring: the webhook core exposes fulfillOrder and no legacy claim/grant deps", () => {
  const source = readSource("src/lib/actions/payment-webhook.ts");
  assert.match(source, /fulfillOrder\(orderId,\s*userId\)/);
  for (const identifier of LEGACY_IDENTIFIERS) {
    assert.equal(source.includes(identifier), false, `webhook core must not reference ${identifier}`);
  }
});

test("wiring: the webhook route resolves orders by cashfree_order_id and fulfils through the wrapper", () => {
  const source = readSource("src/app/api/webhooks/cashfree/route.ts");
  assert.match(source, /\.eq\("cashfree_order_id",\s*orderId\)/);
  assert.match(source, /fulfillPremiumOrder\(supabase,\s*orderId,\s*userId\)/);
  assert.match(source, /getSupabaseAdmin\(\)/);
  for (const identifier of LEGACY_IDENTIFIERS) {
    assert.equal(source.includes(identifier), false, `webhook route must not reference ${identifier}`);
  }
});

test("wiring: no production module calls the retained legacy helpers", () => {
  const productionFiles = [];

  const walk = (directory) => {
    for (const entry of readdirSync(directory)) {
      const full = path.join(directory, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) productionFiles.push(full);
    }
  };
  walk(path.join(root, "src"));

  // The two modules that define/host the retained legacy helpers are the only
  // allowed references; everything else in src/ is production traffic.
  const allowed = new Set([
    path.join(root, "src", "lib", "actions", "premium.ts"),
    path.join(root, "src", "lib", "actions", "payment-repair.ts"),
  ]);

  for (const file of productionFiles) {
    if (allowed.has(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const identifier of LEGACY_IDENTIFIERS) {
      assert.equal(
        source.includes(identifier),
        false,
        `${path.relative(root, file)} must not reference the legacy helper ${identifier}`
      );
    }
  }
});

test("wiring: the retained premium helpers still exist for legacy regression coverage", () => {
  assert.equal(typeof premium.grantPremiumEntitlements, "function");
  assert.equal(typeof premium.claimOrderAsPaid, "function");
  assert.equal(typeof premium.markOrderFailed, "function");
  assert.equal(typeof premium.logPaymentEvent, "function");
});
