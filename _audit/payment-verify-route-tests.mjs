/**
 * Route-level regression for the REAL production payment-verify fallback:
 *   src/app/api/payments/verify/route.ts   (GET)
 *
 * Pattern: transpileModule + Module-require override, same as _audit/feed-card-tests.mjs.
 *
 * REAL (loaded and executed, not re-implemented):
 *   - the actual route module, so the real `redirectWith` closure, the order-id gate,
 *     the status-token mapping, the try/catch and the exported `dynamic`/`runtime`
 *     constants are exercised.
 *   - `next/server` is deliberately NOT overridden: NextRequest / NextResponse are the
 *     real implementations, so every assertion reads a genuine 307 + Location header
 *     and the target is parsed back with WHATWG URL.
 *   - the real `@/lib/actions/safety` module (isValidOrderId, resolveTrustedOrigin,
 *     safeStatusToken) — the same helpers the production handler calls.
 *
 * MOCKED (one dependency, disclosed): `verifyPayment` from
 *   `@/lib/actions/payment-actions`. That is a `"use server"` Server Action which
 *   reaches Supabase and the Cashfree API; nothing here substitutes for it. This test
 *   proves ROUTE MAPPING ONLY. Ownership checks, provider-status truth, amount/currency
 *   verification, purchase idempotency and the entitlement grant all live inside the
 *   mocked action and are NOT proven by this file.
 *
 * No .env reads, no credentials, no network, no source changes.
 *
 * Run:
 *   node --test _audit/payment-verify-route-tests.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server"); // real NextRequest, CJS entry

// ─────────────────────────────────────────────────────────────
// The single mocked dependency: the `verifyPayment` Server Action
// ─────────────────────────────────────────────────────────────
const verifyCalls = [];
let verifyOutcome = { result: {} };

function resetVerify(outcome = { result: {} }) {
  verifyCalls.length = 0;
  verifyOutcome = outcome;
}

const overrides = {
  "@/lib/actions/payment-actions": {
    verifyPayment: async (orderId) => {
      verifyCalls.push(orderId);
      if (verifyOutcome.throwError) throw verifyOutcome.throwError;
      return verifyOutcome.result;
    },
  },
};

function loadSource(relative) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.require = (id) => (Object.hasOwn(overrides, id) ? overrides[id] : require(id));
  loaded._compile(outputText, filename);
  return loaded.exports;
}

// Real safety helpers first, then the real route (which imports them).
const safety = loadSource("../src/lib/actions/safety.ts");
overrides["@/lib/actions/safety"] = safety;

const route = loadSource("../src/app/api/payments/verify/route.ts");
assert.equal(typeof route.GET, "function", "route must export GET");
assert.equal(route.runtime, "nodejs");
assert.equal(route.dynamic, "force-dynamic");

// ─────────────────────────────────────────────────────────────
// Fixtures / helpers
// ─────────────────────────────────────────────────────────────
const APP_URL = "https://auramint.example";
const REQUEST_HOST = "auramint-preview-abc123.vercel.app";
const ORDER_ID = "auramint_2f1c9a4e-7b3d-4a55-9e01-8c6f0d2b7a11";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
process.env.NEXT_PUBLIC_APP_URL = APP_URL;

const callRoute = (query, host = REQUEST_HOST) =>
  route.GET(new NextRequest(`https://${host}/api/payments/verify${query}`));

/** Asserts the response is a real NextResponse.redirect onto /premium?status=… */
function redirectTarget(res, expectedStatus) {
  assert.equal(res.status, 307, "NextResponse.redirect must produce a 307");
  const location = res.headers.get("location");
  assert.ok(location, "redirect must carry a Location header");
  const target = new URL(location);
  assert.equal(target.pathname, "/premium", "every branch redirects to /premium");
  assert.equal(target.searchParams.get("status"), expectedStatus);
  return target;
}

// ─────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────
test("GET /api/payments/verify — route mapping over the real safety helpers", async (t) => {
  await t.test("missing or empty order_id → status=error, action never invoked", async () => {
    resetVerify();
    for (const query of ["", "?order_id=", "?order_id=&utm=1"]) {
      const target = redirectTarget(await callRoute(query), "error");
      assert.equal(target.origin, APP_URL);
    }
    assert.equal(verifyCalls.length, 0, "an absent order id must never reach verifyPayment");
  });

  await t.test("malformed order_id is rejected by the real gate before any action call", async () => {
    resetVerify();
    const malformed = [
      "not-an-order",           // wrong prefix
      "auramint_",              // empty suffix
      "auramint_bad id",        // space
      "auramint_bad/id",        // path separator
      "auramint_bad.id",        // dot
      "AURAMINT_ok",            // wrong-case prefix
      `auramint_${"a".repeat(81)}`, // one char over the 80-char suffix limit
    ];
    for (const id of malformed) {
      const target = redirectTarget(await callRoute(`?order_id=${encodeURIComponent(id)}`), "error");
      assert.equal(target.origin, APP_URL);
    }
    assert.equal(verifyCalls.length, 0, "malformed ids must never reach verifyPayment");

    // Boundary proof that the REAL regex (not a looser stand-in) gates the route.
    assert.equal(safety.isValidOrderId(`auramint_${"a".repeat(80)}`), true, "80-char suffix is the documented maximum");
    assert.equal(safety.isValidOrderId(`auramint_${"a".repeat(81)}`), false);

    // Control: the same wire path with a well-formed id DOES reach the action, which
    // also proves the module override is wired through the real import.
    resetVerify({ result: { success: false, status: "PENDING" } });
    redirectTarget(await callRoute(`?order_id=${ORDER_ID}`), "PENDING");
    assert.deepEqual(verifyCalls, [ORDER_ID], "a well-formed id must reach the overridden action once");
  });

  await t.test("PAID result → status=success and the exact order id is forwarded", async () => {
    resetVerify({ result: { success: true, status: "PAID", orderId: ORDER_ID } });
    const res = await callRoute(`?order_id=${ORDER_ID}`);
    redirectTarget(res, "success");
    assert.equal(res.headers.get("location"), `${APP_URL}/premium?status=success`);
    assert.deepEqual(verifyCalls, [ORDER_ID], "verifyPayment receives the raw, unmodified order id");
  });

  await t.test("action error result → status=error", async () => {
    for (const message of [
      "Order not found",
      "Must be logged in",
      "Payment verification failed. Contact support.",
    ]) {
      resetVerify({ result: { error: message } });
      redirectTarget(await callRoute(`?order_id=${ORDER_ID}`), "error");
      assert.deepEqual(verifyCalls, [ORDER_ID], `"${message}" must still have reached the action`);
    }
  });

  await t.test("pending / failed / unexpected statuses map onto the redirect token", async () => {
    const cases = [
      ["PENDING", "PENDING"],
      ["FAILED", "FAILED"],
      ["ACTIVE", "ACTIVE"],
      ["USER_DROPPED", "USER_DROPPED"],
      [undefined, "pending"],   // route default when the action reports no status
      ["", "pending"],
      ["not a token!", "pending"], // non-conforming token falls back, never echoed
    ];
    for (const [status, expected] of cases) {
      resetVerify({ result: { success: false, status } });
      redirectTarget(await callRoute(`?order_id=${ORDER_ID}`), expected);
      assert.equal(verifyCalls.length, 1);
    }

    // The success branch is the conjunction `success === true && status === "PAID"`.
    // A lowercase "paid" is uppercased by the token sanitiser and therefore lands on
    // status=PAID, not status=success.
    resetVerify({ result: { success: true, status: "paid" } });
    redirectTarget(await callRoute(`?order_id=${ORDER_ID}`), "PAID");
    // A PAID token without success:true does not take the success branch either.
    resetVerify({ result: { success: false, status: "PAID" } });
    redirectTarget(await callRoute(`?order_id=${ORDER_ID}`), "PAID");
  });

  await t.test("thrown action error → status=error and the failure is logged", async () => {
    const thrown = new Error("provider exploded");
    resetVerify({ throwError: thrown });
    const logged = [];
    const originalConsoleError = console.error;
    console.error = (...args) => { logged.push(args); };
    let target;
    try {
      target = redirectTarget(await callRoute(`?order_id=${ORDER_ID}`), "error");
    } finally {
      console.error = originalConsoleError;
    }
    assert.equal(target.origin, APP_URL);
    assert.deepEqual(verifyCalls, [ORDER_ID]);
    assert.equal(logged.length, 1, "the catch branch must log exactly once");
    assert.equal(logged[0][0], "[Payments/verify] Unexpected error:");
    assert.equal(logged[0][1], thrown, "the original error object must be logged, not swallowed");
  });

  await t.test("ordinary trusted-origin behaviour: configured app URL wins, unset falls back to request origin", async () => {
    resetVerify({ result: { error: "Order not found" } });
    const configured = await callRoute(`?order_id=${ORDER_ID}`, REQUEST_HOST);
    assert.equal(
      configured.headers.get("location"),
      `${APP_URL}/premium?status=error`,
      "a configured NEXT_PUBLIC_APP_URL must be used instead of the deployment host"
    );
    assert.equal(redirectTarget(configured, "error").origin, APP_URL);

    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      const fallbackHost = "auramint-fallback.test";
      const fallback = await callRoute(`?order_id=${ORDER_ID}`, fallbackHost);
      assert.equal(
        fallback.headers.get("location"),
        `https://${fallbackHost}/premium?status=error`,
        "with no configured app URL the request's own origin is the documented fallback"
      );
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = APP_URL;
    }
  });
});

test.after(() => {
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});
