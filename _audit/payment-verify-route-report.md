# Payment verify route — route-mapping regression

**Status: GREEN.** The real `GET /api/payments/verify` handler was executed against real
`NextRequest`/`NextResponse` and the real safety helpers, with only the `verifyPayment`
Server Action mocked. No network, no `.env` reads, no credentials, no source edits.

## Command and result

```
node --test _audit/payment-verify-route-tests.mjs
```

Exit code: **0**. TAP summary: `tests 8 | pass 8 | fail 0 | cancelled 0 | skipped 0 | todo 0`.
A second consecutive run produced an identical pass set (deterministic; no shared state
leaks between subtests).

Observed stdout (verbatim):

```
▶ GET /api/payments/verify — route mapping over the real safety helpers
  ✔ missing or empty order_id → status=error, action never invoked (4.4218ms)
  ✔ malformed order_id is rejected by the real gate before any action call (2.4706ms)
  ✔ PAID result → status=success and the exact order id is forwarded (0.3225ms)
  ✔ action error result → status=error (0.6522ms)
  ✔ pending / failed / unexpected statuses map onto the redirect token (1.2994ms)
  ✔ thrown action error → status=error and the failure is logged (0.5602ms)
  ✔ ordinary trusted-origin behaviour: configured app URL wins, unset falls back to request origin (0.4991ms)
✔ GET /api/payments/verify — route mapping over the real safety helpers (11.9767ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 429.9755
```

No warnings, no skips, no `console.error` noise leaked to the runner (the handler's own
diagnostic in the thrown-error branch is captured and asserted instead).

## What is real vs. mocked

Real (loaded and executed, not re-implemented):

- `src/app/api/payments/verify/route.ts` — the actual `GET` export, including the
  `redirectWith` closure, the `isValidOrderId` gate, the `result.error` branch, the
  `success && status === "PAID"` branch, the token sanitiser call, the `try/catch`, and
  the module's own `dynamic = "force-dynamic"` / `runtime = "nodejs"` exports (asserted).
- `next/server` — deliberately **not** overridden; `NextRequest` and `NextResponse` are
  the genuine Next 16 implementations, so every assertion reads a real `307` plus a real
  `Location` header, parsed back with WHATWG `URL`.
- `src/lib/actions/safety.ts` — the real `isValidOrderId`, `resolveTrustedOrigin` and
  `safeStatusToken`, loaded through the same transpile/override loader the route uses.

Mocked (one dependency, disclosed): `verifyPayment` from `@/lib/actions/payment-actions`.
That is a `"use server"` Server Action which reads the Supabase session, queries the
`orders` row, calls the Cashfree API, verifies amount/currency and performs the atomic
fulfillment. The mock records each call and returns a scripted outcome. **This file proves
route mapping only.**

Loader: `ts.transpileModule` (`module: CommonJS`) into a `node:module` `Module` whose
`require` consults an override table, falling back to real `require` — the same pattern as
`_audit/feed-card-tests.mjs`.

## Scenario table

| # | Scenario | Mocked action outcome | Route result (`Location`) | Extra assertions |
|---|----------|----------------------|---------------------------|------------------|
| 1 | Missing order id (`""`, `?order_id=`, `?order_id=&utm=1`) | *not invoked* | `?status=error` | `verifyPayment` call count is `0` |
| 2 | Malformed order id ×7 (`not-an-order`, `auramint_`, `auramint_bad id`, `auramint_bad/id`, `auramint_bad.id`, `AURAMINT_ok`, 81-char suffix) | *not invoked* | `?status=error` | call count `0`; real regex boundary proven (80 chars `true`, 81 chars `false`) |
| 2b | Control: well-formed `auramint_…` id | `{success:false,status:"PENDING"}` | `?status=PENDING` | exactly one call, exact id forwarded — proves the override is wired through the real import |
| 3 | Success | `{success:true,status:"PAID",orderId}` | `https://auramint.example/premium?status=success` | exact full `Location` string; action received the raw, unmodified id |
| 4 | Error results ×3 (`Order not found`, `Must be logged in`, `Payment verification failed…`) | `{error:…}` | `?status=error` | action still reached exactly once per case |
| 5 | Status mapping | `PENDING`, `FAILED`, `ACTIVE`, `USER_DROPPED` | `?status=PENDING` / `FAILED` / `ACTIVE` / `USER_DROPPED` | token preserved verbatim by `safeStatusToken` |
| 5b | Missing / non-conforming status | `status: undefined`, `""`, `"not a token!"` | `?status=pending` | route's literal `"pending"` fallback; hostile token is **never echoed** |
| 5c | Token-vs-flag divergence | `{success:true,status:"paid"}`, `{success:false,status:"PAID"}` | `?status=PAID` (neither is `success`) | see “Observed nuances” |
| 6 | Thrown action error | `throw new Error("provider exploded")` | `?status=error` | exactly one `console.error` with prefix `[Payments/verify] Unexpected error:` carrying the original error object |
| 7 | Configured app URL, request arrives on a different host | `{error:"Order not found"}` | `https://auramint.example/premium?status=error` | configured origin wins over the request host |
| 7b | App URL unset | `{error:"Order not found"}` | `https://auramint-fallback.test/premium?status=error` | request's own origin is the documented fallback |

Every branch asserted `res.status === 307` and `pathname === "/premium"`, so no branch can
silently redirect somewhere else.

## Falsification check (the suite is not vacuous)

Three in-memory mutations of the real route source (never written to disk) were executed
through the same loader and compared against the control:

| Route variant | `?order_id=` | Observed `Location` |
|---------------|--------------|---------------------|
| unmodified (control) | `auramint_abc` | `?status=PENDING` |
| unmodified (control) | `auramint_abc`, action `PAID` | `?status=success` |
| unmodified (control) | `nope` | `?status=error` |
| token sanitiser replaced with a passthrough | `auramint_abc` | `?status=MUTATED` |
| `isValidOrderId` gate disabled | `nope` | `?status=PENDING` (action invoked) |
| `status === "PAID"` success branch disabled | `auramint_abc`, action `PAID` | `?status=PAID` |

Each mutation diverges from the asserted expectation, so scenarios 2, 3 and 5 would fail
on a regression rather than passing vacuously.

## Observed nuances (reported, not defects proven reachable)

- The success branch is the **conjunction** `result.success === true && result.status === "PAID"`.
  A lowercase `"paid"`, or a `PAID` token without `success: true`, skips the success branch and
  lands on `?status=PAID`.
- Downstream, `src/app/(app)/premium/premium-client.tsx` normalises the token with
  `normaliseStatus()` (lowercases first) and maps `success|paid → success`,
  `pending|processing → pending`, `failed|failure|error → failed`,
  `cancelled|canceled|user_dropped → cancelled`. So the route's uppercase tokens
  (`PENDING`, `FAILED`, `error`, and even the `PAID` divergence above) all resolve to the
  intended UI state — the uppercase/lowercase mismatch is cosmetic, but it means the
  *client*, not the route, ultimately decides which state `?status=PAID` renders.
- Both nuances require a `verifyPayment` return shape the real action does not produce
  (`verifyPayment` returns `{success:false, status}` only when `status !== "PAID"`), so
  neither is reachable through the production action as written. They are recorded because
  this suite mocks that action.

## Limitations (what this file does NOT prove)

- **The action is mocked.** Ownership enforcement (`orders.user_id = auth.uid()`), session
  presence, the Cashfree provider lookup, `verifyProviderAmountAndCurrency`, the
  `safeStatusToken` applied to the provider's own status, the `fulfillPremiumOrder`
  idempotent grant and `markOrderFailed` are all inside `verifyPayment` and are **not
  exercised** here.
- **No provider proof.** No request reaches Cashfree; no real provider status, amount or
  currency is validated.
- **No database proof.** No Supabase client, no Postgres, no `orders`/`profiles`/ledger rows;
  no entitlement or idempotency behaviour is demonstrated.
- **No auth proof.** Nothing asserts that an unauthenticated caller cannot reach the
  success redirect; the route delegates that entirely to the action.
- **No real HTTP transport.** `GET` is invoked directly as a function with a constructed
  `NextRequest`; Next's own router, middleware, caching and `dynamic`/`runtime` enforcement
  are not in the path.
- **Origin behaviour tested only in its ordinary form.** The configured-URL branch and the
  request-origin fallback are covered; adversarial `Host`/`x-forwarded-host` inputs are
  deliberately out of scope for this file (the helper's hostile-input handling is unit-tested
  elsewhere in `_audit/`).
- **`next/server` version coupling.** Assertions assume `NextResponse.redirect` defaults to
  `307` and exposes `Location` on the standard `Response` — true for the installed Next 16,
  re-verified at runtime rather than assumed.

## Test-integrity notes

- Only `process.env.NEXT_PUBLIC_APP_URL` is touched: set to `https://auramint.example` for
  the run and restored (or deleted if originally absent) in `test.after`. No `.env` file is
  read, no credential is used, and no other environment variable is modified.
- No network access, no listening sockets, no subprocesses, no filesystem writes.
- No source file is modified; mutations in the falsification table were applied to an
  in-memory string and discarded.
- Console capture is scoped to a single subtest and restored in a `finally` block.

## Files

- Test: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/_audit/payment-verify-route-tests.mjs`
- This report: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/_audit/payment-verify-route-report.md`
- Route under test: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/src/app/api/payments/verify/route.ts`
- Real helpers under test: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/src/lib/actions/safety.ts`
- Mocked dependency: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/src/lib/actions/payment-actions.ts`
- Downstream token consumer (context only): `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/src/app/(app)/premium/premium-client.tsx`
- Loader pattern reused: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/_audit/feed-card-tests.mjs`

No production source, `.env`, deployment config, or credential was read or modified.
