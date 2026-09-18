/**
 * Payment final-hardening regressions.
 *
 * Run:  node --test _audit/payment-final-hardening-tests.mjs
 *
 * Every test below exercises real application code (Node 24 native TS type-stripping +
 * the shared `_audit/loader.mjs` resolve hook) — no copies of the logic.
 *
 *  1. `payment-verification.ts` — the shared fail-closed amount/currency decision.
 *  2. `payment-webhook.ts`      — the webhook success path refuses whenever a stored or
 *     provider amount/currency is missing, malformed or mismatched, and never claims or
 *     grants on those paths.
 *  3. `premium.ts`              — `grantPremiumEntitlements` fails when the UPDATE
 *     affects zero rows instead of reporting a false success.
 *  4. Static wiring guard       — `verifyPayment` (not loadable outside Next because it
 *     imports `next/headers`) must call the shared decision and must not contain the
 *     old "skip the comparison" branches.
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

register(pathToFileURL(path.join(here, "loader.mjs")).href);

const load = (relative) => import(pathToFileURL(path.join(root, relative)).href);

const verification = await load("src/lib/actions/payment-verification.ts");
const webhook = await load("src/lib/actions/payment-webhook.ts");
const premium = await load("src/lib/actions/premium.ts");

// ─────────────────────────────────────────────────────────────
// 1. Shared decision: stored side
// ─────────────────────────────────────────────────────────────

const VALID_STORED = { amountMinor: 9900, currency: "INR" };
const VALID_PROVIDER = { amountMajor: 99, currency: "INR" };

const INVALID_AMOUNTS = [
  null,
  undefined,
  0,
  -1,
  -9900,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  "",
  "   ",
  "abc",
  "99abc",
  "9,900",
  "1e400",
  true,
  false,
  {},
  [],
  [9900],
];

test("verification: a valid stored order with a matching provider report passes", () => {
  const result = verification.verifyProviderAmountAndCurrency(VALID_STORED, VALID_PROVIDER);
  assert.deepEqual(result, { ok: true, amountMinor: 9900, currency: "INR" });
});

test("verification: every missing/malformed stored amount fails closed", () => {
  for (const amountMinor of INVALID_AMOUNTS) {
    const result = verification.verifyProviderAmountAndCurrency(
      { amountMinor, currency: "INR" },
      VALID_PROVIDER
    );
    assert.equal(result.ok, false, `expected refusal for stored amount ${JSON.stringify(amountMinor)}`);
    assert.equal(result.reason, "stored_amount_invalid");
  }
});

test("verification: every missing/malformed stored currency fails closed", () => {
  for (const currency of [null, undefined, "", "   ", 123, "IN", "I", "I N", "₹", "inr!", {}, ["INR"]]) {
    const result = verification.verifyProviderAmountAndCurrency(
      { amountMinor: 9900, currency },
      VALID_PROVIDER
    );
    assert.equal(result.ok, false, `expected refusal for stored currency ${JSON.stringify(currency)}`);
    assert.equal(result.reason, "stored_currency_invalid");
  }
});

// ─────────────────────────────────────────────────────────────
// 2. Shared decision: provider side + comparisons
// ─────────────────────────────────────────────────────────────

test("verification: every missing/malformed provider amount fails closed", () => {
  for (const amountMajor of INVALID_AMOUNTS) {
    const result = verification.verifyProviderAmountAndCurrency(VALID_STORED, {
      amountMajor,
      currency: "INR",
    });
    assert.equal(result.ok, false, `expected refusal for provider amount ${JSON.stringify(amountMajor)}`);
    assert.equal(result.reason, "provider_amount_invalid");
  }
});

test("verification: every missing/malformed provider currency fails closed", () => {
  for (const currency of [null, undefined, "", "   ", 123, "IN", "INR!", {}, ["INR"]]) {
    const result = verification.verifyProviderAmountAndCurrency(VALID_STORED, {
      amountMajor: 99,
      currency,
    });
    assert.equal(result.ok, false, `expected refusal for provider currency ${JSON.stringify(currency)}`);
    assert.equal(result.reason, "provider_currency_invalid");
  }
});

test("verification: amount and currency mismatches are distinguished", () => {
  assert.deepEqual(
    verification.verifyProviderAmountAndCurrency(VALID_STORED, { amountMajor: 1, currency: "INR" }),
    { ok: false, reason: "amount_mismatch" }
  );
  assert.deepEqual(
    verification.verifyProviderAmountAndCurrency(VALID_STORED, { amountMajor: 99.5, currency: "INR" }),
    { ok: false, reason: "amount_mismatch" }
  );
  assert.deepEqual(
    verification.verifyProviderAmountAndCurrency(VALID_STORED, { amountMajor: 99, currency: "USD" }),
    { ok: false, reason: "currency_mismatch" }
  );
  // A cheaper currency with a same-number amount must never look like the INR order.
  assert.deepEqual(
    verification.verifyProviderAmountAndCurrency(VALID_STORED, { amountMajor: 99, currency: "usd" }),
    { ok: false, reason: "currency_mismatch" }
  );
});

test("verification: accepted forms are exact and do not soften the comparison", () => {
  // Numeric strings and case/whitespace variants normalise…
  assert.deepEqual(
    verification.verifyProviderAmountAndCurrency(
      { amountMinor: "9900", currency: "inr " },
      { amountMajor: "99.00", currency: " INR" }
    ),
    { ok: true, amountMinor: 9900, currency: "INR" }
  );
  // …but a string that parses to a different value still fails.
  assert.equal(
    verification.verifyProviderAmountAndCurrency({ amountMinor: "9900", currency: "INR" }, {
      amountMajor: "9900",
      currency: "INR",
    }).ok,
    false,
    "9900 major units is not 9900 paise"
  );
  // Tolerance stays zero: one paise off refuses.
  assert.equal(
    verification.verifyProviderAmountAndCurrency(VALID_STORED, { amountMajor: 98.99, currency: "INR" }).ok,
    false
  );
});

test("verification: normalisers reject junk without throwing", () => {
  for (const value of INVALID_AMOUNTS) {
    assert.equal(verification.normalizeStoredAmountMinor(value), null);
    assert.equal(verification.normalizeProviderAmountMajor(value), null);
  }
  for (const value of [null, undefined, "", "   ", 1, {}, [], true]) {
    assert.equal(verification.normalizeCurrencyCode(value), null);
  }
  assert.equal(verification.normalizeStoredAmountMinor(9900), 9900);
  assert.equal(verification.normalizeStoredAmountMinor(" 9900 "), 9900);
  assert.equal(verification.normalizeCurrencyCode(" inr "), "INR");
  // Oversized strings are rejected before any numeric coercion.
  assert.equal(verification.normalizeStoredAmountMinor("9".repeat(33)), null);
  assert.equal(verification.normalizeProviderAmountMajor("9".repeat(33)), null);
});

test("verification: every failure maps to an existing or explicitly new audit action", () => {
  const mapping = {
    stored_amount_invalid: "payment.amount_unverifiable",
    provider_amount_invalid: "payment.amount_unverifiable",
    amount_mismatch: "payment.amount_mismatch",
    stored_currency_invalid: "payment.currency_unverifiable",
    provider_currency_invalid: "payment.currency_unverifiable",
    currency_mismatch: "payment.currency_mismatch",
  };

  for (const [reason, action] of Object.entries(mapping)) {
    assert.equal(verification.paymentVerificationLogAction(reason), action);
    assert.equal(typeof verification.paymentVerificationMessage(reason), "string");
    assert.ok(verification.paymentVerificationMessage(reason).length > 0);
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Webhook success path (dependency-injected core)
// ─────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = "webhook_secret_0123456789";
const ORDER_ID = "auramint_1234abcd_1712345678901";

function sign(body, timestamp, secret = WEBHOOK_SECRET) {
  return createHmac("sha256", secret).update(`${timestamp}${body}`).digest("base64");
}

const DEFAULT_ORDER = {
  id: ORDER_ID,
  user_id: "user-1",
  status: "PENDING",
  amount: 9900,
  currency: "INR",
};

function makeDeps(overrides = {}) {
  const calls = { claimed: 0, granted: [], reverted: 0, logged: [] };
  const order = "order" in overrides ? overrides.order : DEFAULT_ORDER;

  const deps = {
    async getOrder(orderId) {
      if (!order || orderId !== order.id) return { order: null };
      return { order };
    },
    async fulfillOrder(orderId, userId) {
      calls.claimed += 1;
      if (!overrides.alreadyClaimed) calls.granted.push(userId);
      return { ok: true, applied: !overrides.alreadyClaimed, recovered: false };
    },
    async markOrderFailed() {
      return { ok: true, updated: true };
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

test("webhook: a stored order without a usable amount never claims or grants", async () => {
  for (const amount of [null, undefined, 0, -9900, Number.NaN, "abc", "", {}]) {
    const { deps, calls } = makeDeps({ order: { ...DEFAULT_ORDER, amount } });
    const result = await handle(successBody(), { deps });

    assert.equal(result.status, 200, `amount ${JSON.stringify(amount)}`);
    assert.equal(result.body.message, "Amount unverifiable");
    assert.equal(calls.claimed, 0, "must not claim an order it cannot verify");
    assert.deepEqual(calls.granted, [], "must not grant premium on an unverifiable order");
    assert.equal(
      calls.logged.some((l) => l.action === "payment.amount_unverifiable"),
      true
    );
  }
});

test("webhook: a stored order without a usable currency never claims or grants", async () => {
  for (const currency of [null, undefined, "", "  ", "US", 123]) {
    const { deps, calls } = makeDeps({ order: { ...DEFAULT_ORDER, currency } });
    const result = await handle(successBody(), { deps });

    assert.equal(result.status, 200, `currency ${JSON.stringify(currency)}`);
    assert.equal(result.body.message, "Currency unverifiable");
    assert.equal(calls.claimed, 0);
    assert.deepEqual(calls.granted, []);
    assert.equal(
      calls.logged.some((l) => l.action === "payment.currency_unverifiable"),
      true
    );
  }
});

test("webhook: a provider success event without an amount never claims or grants", async () => {
  const { deps, calls } = makeDeps();
  const body = successBody({ omitOrder: ["order_amount"], omitPayment: ["payment_amount"] });
  const result = await handle(body, { deps });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, "Amount unverifiable");
  assert.equal(calls.claimed, 0);
  assert.deepEqual(calls.granted, []);

  // Also: a malformed order_amount must not be papered over by a valid payment_amount.
  const conflicted = makeDeps();
  const conflictedResult = await handle(successBody({ order: { order_amount: "abc" } }), {
    deps: conflicted.deps,
  });
  assert.equal(conflictedResult.body.message, "Amount unverifiable");
  assert.equal(conflicted.calls.claimed, 0);
  assert.deepEqual(conflicted.calls.granted, []);
});

test("webhook: a provider success event without a usable currency never claims or grants", async () => {
  for (const currency of [undefined, "", "  "]) {
    const { deps, calls } = makeDeps();
    const body = successBody({ order: { order_currency: currency } });
    const result = await handle(body, { deps });

    assert.equal(result.status, 200, `currency ${JSON.stringify(currency)}`);
    assert.equal(result.body.message, "Currency unverifiable");
    assert.equal(calls.claimed, 0);
    assert.deepEqual(calls.granted, []);
    assert.equal(
      calls.logged.some((l) => l.action === "payment.currency_unverifiable"),
      true
    );
  }
});

test("webhook: amounts that are present but different keep the mismatch behaviour", async () => {
  const low = makeDeps();
  const lowResult = await handle(successBody({ order: { order_amount: 1 } }), { deps: low.deps });
  assert.equal(lowResult.body.message, "Amount mismatch");
  assert.equal(low.calls.claimed, 0);
  assert.deepEqual(low.calls.granted, []);
  assert.equal(low.calls.logged.some((l) => l.action === "payment.amount_mismatch"), true);

  const currency = makeDeps();
  const currencyResult = await handle(successBody({ order: { order_currency: "USD" } }), {
    deps: currency.deps,
  });
  assert.equal(currencyResult.body.message, "Currency mismatch");
  assert.equal(currency.calls.claimed, 0);
  assert.deepEqual(currency.calls.granted, []);
  assert.equal(currency.calls.logged.some((l) => l.action === "payment.currency_mismatch"), true);
});

test("webhook: a fully valid delivery still grants exactly once (no over-hardening)", async () => {
  const { deps, calls } = makeDeps();
  const result = await handle(successBody({ order: { order_amount: "99.00" } }), { deps });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, "OK");
  assert.equal(calls.claimed, 1);
  assert.deepEqual(calls.granted, ["user-1"]);
  assert.equal(calls.logged.some((l) => l.action === "payment.webhook.success"), true);
});

test("webhook: a refused delivery leaves the order claimable for a later valid one", async () => {
  const bad = makeDeps({ order: { ...DEFAULT_ORDER, amount: null } });
  const badResult = await handle(successBody(), { deps: bad.deps });
  assert.equal(badResult.body.message, "Amount unverifiable");
  assert.equal(bad.calls.claimed, 0);

  // The order row is repaired (amount restored) and the provider retries.
  const good = makeDeps();
  const goodResult = await handle(successBody(), { deps: good.deps });
  assert.equal(goodResult.body.message, "OK");
  assert.equal(good.calls.claimed, 1);
  assert.deepEqual(good.calls.granted, ["user-1"]);
});

// ─────────────────────────────────────────────────────────────
// 4. Entitlement grant: zero affected rows is a failure
// ─────────────────────────────────────────────────────────────

/** Minimal chainable stand-in for the PostgREST builder used by premium.ts. */
function profilesStub({ rows = [], error = null } = {}) {
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

test("premium: a grant that matches zero profile rows fails instead of reporting success", async () => {
  const { client, calls } = profilesStub({ rows: [] });
  const result = await premium.grantPremiumEntitlements(client, "user-1");

  assert.equal(result.ok, false, "zero affected rows must not be reported as a successful grant");
  assert.match(result.error, /profile not found/);
  // The row-count check only works because the UPDATE asks for the affected rows back.
  assert.equal(calls.from, "profiles");
  assert.deepEqual(calls.update, { is_premium: true, boosts_remaining: 5 });
  assert.deepEqual(calls.eq, [["id", "user-1"]]);
  assert.equal(calls.select, "id");
});

test("premium: a grant that matches exactly one profile row succeeds", async () => {
  const { client } = profilesStub({ rows: [{ id: "user-1" }] });
  assert.deepEqual(await premium.grantPremiumEntitlements(client, "user-1"), { ok: true });
});

test("premium: a database error still fails the grant with its message", async () => {
  const { client } = profilesStub({ error: { message: "permission denied" } });
  const result = await premium.grantPremiumEntitlements(client, "user-1");
  assert.equal(result.ok, false);
  assert.equal(result.error, "permission denied");
});

test("premium: an empty user id fails before any database call", async () => {
  let touched = false;
  const client = {
    from() {
      touched = true;
      throw new Error("must not be reached");
    },
  };

  for (const userId of ["", null, undefined, 42]) {
    const result = await premium.grantPremiumEntitlements(client, userId);
    assert.equal(result.ok, false);
  }
  assert.equal(touched, false);
});

test("premium: claimOrderAsPaid only reports a claim when a row was actually updated", async () => {
  const updated = profilesStub({ rows: [{ id: ORDER_ID }] });
  const claim = await premium.claimOrderAsPaid(updated.client, ORDER_ID, "user-1");
  assert.deepEqual(claim, { ok: true, claimed: true });
  assert.equal(updated.calls.from, "orders");
  assert.deepEqual(updated.calls.update, { status: "PAID" });
  assert.deepEqual(updated.calls.neq, [["status", "PAID"]]);
  assert.deepEqual(updated.calls.eq, [["id", ORDER_ID], ["user_id", "user-1"]]);

  // RLS or a concurrent delivery can make the conditional UPDATE match nothing.
  const blocked = profilesStub({ rows: [] });
  const notClaimed = await premium.claimOrderAsPaid(blocked.client, ORDER_ID, "user-1");
  assert.deepEqual(notClaimed, { ok: true, claimed: false });

  const failed = profilesStub({ error: { message: "db down" } });
  const errored = await premium.claimOrderAsPaid(failed.client, ORDER_ID);
  assert.deepEqual(errored, { ok: false, error: "db down" });
});

// ─────────────────────────────────────────────────────────────
// 5. Wiring guard for verifyPayment (not importable outside Next)
// ─────────────────────────────────────────────────────────────

test("wiring: verifyPayment uses the shared fail-closed decision, not permissive skips", () => {
  const source = readFileSync(path.join(root, "src/lib/actions/payment-actions.ts"), "utf8");

  assert.match(
    source,
    /verifyProviderAmountAndCurrency\(/,
    "verifyPayment must call the shared stored-vs-provider decision"
  );
  assert.equal(
    source.includes("order has no stored amount to verify"),
    false,
    "the old branch that skipped verification for a missing stored amount must not return"
  );
  assert.equal(
    /order\.currency && providerCurrency/.test(source),
    false,
    "the old branch that skipped the currency comparison must not return"
  );
  // The decision must be applied to the provider status lookup result before the claim.
  const verificationIndex = source.indexOf("verifyProviderAmountAndCurrency(");
  const claimIndex = source.indexOf("fulfillPremiumOrder(");
  assert.ok(verificationIndex > 0 && claimIndex > verificationIndex, "verification must precede the claim");
});

// ─────────────────────────────────────────────────────────────
// 6. Plan-currency pin (added post-hardening)
// ─────────────────────────────────────────────────────────────

test("verification: a matched pair of non-plan currencies is still refused", () => {
  // 199 USD ≈ 19900 paise numerically "matches" — the pair agreement must not be
  // enough. AuraMint+ is sold in INR only; a wrong-product/tampered order cannot
  // verify itself by matching a foreign currency on both sides.
  const result = verification.verifyProviderAmountAndCurrency(
    { amountMinor: 9900, currency: "USD" },
    { amountMajor: 99, currency: "USD" }
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "plan_currency_mismatch");
});

test("verification: the plan pin maps and reports like other currency refusals", () => {
  assert.equal(verification.paymentVerificationLogAction("plan_currency_mismatch"), "payment.currency_mismatch");
  assert.equal(verification.paymentVerificationMessage("plan_currency_mismatch"), "Currency not supported");
});

test("wiring: order creation and the provider call both pin PLAN_CURRENCY", () => {
  const source = readFileSync(path.join(root, "src/lib/actions/payment-actions.ts"), "utf8");
  const writes = source.match(/currency: PLAN_CURRENCY/g) ?? [];
  assert.ok(writes.length >= 2, "both the order insert and the provider payload must carry PLAN_CURRENCY");
});

// ─────────────────────────────────────────────────────────────
// 7. markOrderFailed affected-row visibility (added post-hardening)
// ─────────────────────────────────────────────────────────────

test("premium: markOrderFailed reports whether a row was actually updated", async () => {
  const updated = profilesStub({ rows: [{ id: ORDER_ID }] });
  const result = await premium.markOrderFailed(updated.client, ORDER_ID);
  assert.deepEqual(result, { ok: true, updated: true });
  assert.equal(updated.calls.from, "orders");
  assert.deepEqual(updated.calls.update, { status: "FAILED" });
  assert.deepEqual(updated.calls.neq, []);
  assert.deepEqual(updated.calls.eq, [["cashfree_order_id", ORDER_ID], ["status", "PENDING"]]);
  assert.equal(updated.calls.select, "id");

  // Already-PAID (or missing) orders match zero rows: ok, but nothing changed.
  const blocked = profilesStub({ rows: [] });
  const untouched = await premium.markOrderFailed(blocked.client, ORDER_ID);
  assert.deepEqual(untouched, { ok: true, updated: false });

  const failed = profilesStub({ error: { message: "db down" } });
  const errored = await premium.markOrderFailed(failed.client, ORDER_ID);
  assert.deepEqual(errored, { ok: false, error: "db down", updated: false });
});

// ─────────────────────────────────────────────────────────────
// 8. Analytics zero-point neutrality (added post-hardening)
// ─────────────────────────────────────────────────────────────

test("webhook: matching non-plan currency never claims or grants", async () => {
  const { deps, calls } = makeDeps({ order: { ...DEFAULT_ORDER, currency: "USD" } });
  const result = await handle(successBody({ order: { order_currency: "USD" } }), { deps });
  assert.equal(result.body.message, "Currency not supported");
  assert.equal(calls.claimed, 0);
  assert.deepEqual(calls.granted, []);
});

test("webhook: zero-row failure updates acknowledge only verified terminal states", async () => {
  const body = JSON.stringify({ type: "PAYMENT_FAILED_WEBHOOK", data: { order: { order_id: ORDER_ID } } });
  for (const status of ["PAID", "FAILED", "PENDING"]) {
    const { deps, calls } = makeDeps({ order: { ...DEFAULT_ORDER, status } });
    deps.markOrderFailed = async () => ({ ok: true, updated: false });
    const result = await handle(body, { deps });
    assert.equal(result.status, status === "PENDING" ? 500 : 200);
    assert.equal(calls.claimed, 0);
    assert.deepEqual(calls.granted, []);
  }
});

test("webhook: failed transition readback errors ask for retry", async () => {
  const { deps } = makeDeps();
  let reads = 0;
  deps.getOrder = async () => ++reads === 1 ? { order: DEFAULT_ORDER } : { order: null, error: "db down" };
  deps.markOrderFailed = async () => ({ ok: true, updated: false });
  const body = JSON.stringify({ type: "PAYMENT_FAILED_WEBHOOK", data: { order: { order_id: ORDER_ID } } });
  assert.equal((await handle(body, { deps })).status, 500);
});

test("wiring: analytics win semantics treat zero-point strikes as neutral", () => {
  const source = readFileSync(path.join(root, "src/lib/actions/aura-actions.ts"), "utf8");

  // Strict inequalities in all three classification sites — a `>= 0` win check
  // would count a zero-point strike as a win and dilute the win rate.
  assert.equal(
    /if \(points >= 0\) entry\.gain/.test(source),
    false,
    "daily-trend gain bucket must not absorb zero-point strikes as gains"
  );
  assert.equal(
    /if \(points >= 0\) entry\.wins\+\+/.test(source),
    false,
    "category wins must require a strictly positive strike"
  );
  assert.equal(
    /filter\(\(e\) => \(Number\(e\.aura_points\) \|\| 0\) >= 0\)/.test(source),
    false,
    "headline wins must require a strictly positive strike"
  );
  // The win rate must divide by scored outcomes, not all events.
  assert.match(source, /winRate: scoredEvents > 0/);
  assert.match(source, /const scoredEvents = wins\.length \+ losses\.length/);
});
