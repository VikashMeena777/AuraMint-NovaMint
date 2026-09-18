# Payment Final Hardening — fail-closed amount/currency verification + entitlement grant row check

Scope owner: payment backend only — `src/lib/actions/payment-*.ts`, `src/lib/actions/premium.ts`,
and the payment-specific test suite. **No frontend, route, schema, config, dependency or
`package.json` change.** No commits, deployments, live DB/provider calls, payments, emails or
secret disclosure; secrets were never read or printed (env names only).

Constraints honoured: no migration invented (the schema is not locally verifiable — see §5),
the claim/grant pair was **not** made atomic and is **not** described as atomic anywhere in the
code or this report.

## 1. Defects confirmed by reading the code (before this pass)

### 1.1 A missing/invalid stored amount or currency skipped verification entirely

`verifyPayment` (`src/lib/actions/payment-actions.ts`):

```ts
if (typeof order.amount === "number" && order.amount > 0) {
  if (providerAmount === undefined || !amountsMatch(providerAmount, order.amount)) { /* refuse */ }
} else {
  console.error("[verifyPayment] CRITICAL: order has no stored amount to verify", orderId);
}
// then, unconditionally:
const claim = await claimOrderAsPaid(supabase, orderId, user.id);
```

```ts
if (order.currency && providerCurrency && order.currency.toUpperCase() !== providerCurrency.toUpperCase()) { /* refuse */ }
```

`handleCashfreeWebhookEvent` (`src/lib/actions/payment-webhook.ts`) had the same shape:
`if (typeof order.amount === "number" && order.amount > 0) { … } else { console.error(…) }`
and the currency comparison ran only when the stored currency was a non-empty string **and**
the provider reported one.

Consequence: an order row whose `amount` was `null`/`0`/negative/`NaN`/text — or whose
`currency` was `null`/empty — skipped the comparison and fell through to the CAS claim and the
premium grant. A provider success event with **no** `order_currency` also skipped the currency
check. In payment terms, "we could not verify" was treated as "verified".

### 1.2 The provider-amount fallback could paper over a malformed primary field

`toAmount(order_amount) ?? toAmount(payment_amount)` coerced `"abc"`/`""`/`{}` to `null`/`0`
and, for `null`, fell back to `payment_amount`. A malformed `order_amount` could therefore be
silently replaced by the secondary field instead of being rejected.

### 1.3 The entitlement grant reported success on zero affected rows

`grantPremiumEntitlements` ran `update({...}).eq("id", userId)` with no `.select()`. PostgREST
returns **no error** for an UPDATE that matches zero rows, so a grant against a missing (or
RLS-hidden) profile returned `{ ok: true }`. The caller claimed the order PAID and reported
success while the paying user never received premium.

## 2. Fixes

| File | Change |
|---|---|
| `src/lib/actions/payment-verification.ts` | **new** — pure, dependency-free, fail-closed stored-vs-provider decision shared by both paths |
| `src/lib/actions/payment-webhook.ts` | success path now uses the shared decision; refuses (no claim, no grant) on any missing/malformed/mismatched value; local `toAmount` removed |
| `src/lib/actions/payment-actions.ts` | `verifyPayment` uses the shared decision and refuses **before** the CAS claim; unused `amountsMatch` import removed |
| `src/lib/actions/premium.ts` | `grantPremiumEntitlements` asks for the affected rows back (`.select("id")`) and fails when zero rows match |
| `_audit/payment-final-hardening-tests.mjs` | **new** — 22 regressions (see §4) |
| `_audit/payment-final-hardening.md` | this report |

### 2.1 The shared decision (`payment-verification.ts`)

No `"use server"` directive on purpose: a `"use server"` module turns every export into a
publicly callable endpoint, and these helpers must never be reachable from a client (same
reasoning as `premium.ts` and `safety.ts`).

- `normalizeStoredAmountMinor(value)` — accepts only a positive finite number or numeric string
  (bounded to 32 chars). `null`, `undefined`, `0`, negatives, `NaN`, `±Infinity`, `""`, text,
  booleans, objects, arrays ⇒ `null`.
- `normalizeCurrencyCode(value)` — accepts only a trimmed, 3–8 letter, case-normalised code;
  anything else ⇒ `null`.
- `normalizeProviderAmountMajor(value)` — as above, provider side (major units).
- `verifyProviderAmountAndCurrency(stored, provider)` — checks our stored row first, then the
  provider report, then equality. Failure reasons: `stored_amount_invalid`,
  `stored_currency_invalid`, `provider_amount_invalid`, `provider_currency_invalid`,
  `amount_mismatch`, `currency_mismatch`. `ok: true` is possible only when **both** sides are
  present, well-formed, and equal under the existing zero-tolerance `amountsMatch`
  (provider major × 100 vs stored minor).
- `paymentVerificationLogAction(reason)` maps to the audit actions; existing
  `payment.amount_mismatch` / `payment.currency_mismatch` are preserved, and the previously
  permissive cases now record `payment.amount_unverifiable` / `payment.currency_unverifiable`
  (new action names — alerting/dashboards should be aware).
- `paymentVerificationMessage(reason)` supplies the bounded webhook body text
  (`Amount mismatch`, `Currency mismatch`, `Amount unverifiable`, `Currency unverifiable`).

### 2.2 Webhook behaviour on a refusal

Order of checks is unchanged up to the owner check. On a refusal the handler:

1. logs `CRITICAL` with `orderId`, `reason` and both sides' raw values,
2. writes an audit row via `deps.logEvent`,
3. returns **HTTP 200** with the mapped message, and does **not** claim the order, does not
   touch entitlements, and does not revert anything.

200 is deliberate: a retry cannot repair a mismatched or unverifiable stored row, so a 5xx
retry loop would not fix it. The trade-off — the order stays `PENDING` and needs an
operational reconciliation — is recorded as a residual blocker in §5.

Provider-side amount selection is now explicit: if `data.order.order_amount` is **present** it
must be usable (a malformed value is a refusal, never rescued by `payment_amount`); only when
it is absent is `data.payment.payment_amount` used.

### 2.3 Verify fallback behaviour on a refusal

`verifyPayment` returns `{ error: "Payment verification failed. Contact support." }` and writes
the same audit action; it never claims the order. The route maps that to
`/premium?status=error` as before. The stored-vs-provider comparison now also applies to the
`order_amount` string form the provider lookup schema allows.

### 2.4 Grant row check

```ts
const { data, error } = await supabase
  .from("profiles")
  .update({ is_premium: true, boosts_remaining: PREMIUM_BOOSTS_GRANT })
  .eq("id", userId)
  .select("id");

if (error) return { ok: false, error: error.message };
if (!Array.isArray(data) || data.length === 0) {
  return { ok: false, error: "grantPremiumEntitlements: profile not found" };
}
```

Both callers already handle `ok: false` correctly: the webhook reverts the claim and returns
500 (provider retries); `verifyPayment` reverts the claim and returns an error; the crash-window
repair in `payment-repair.ts` returns a non-success so the caller never reports an
unsubstantiated upgrade. Note this makes the grant depend on the caller's role having `SELECT`
privilege on `profiles`; if that were ever revoked the grant would **fail closed** (purchases
blocked, visibly) rather than report a false success.

## 3. Verification evidence

| Check | Command | Result |
|---|---|---|
| New payment suite | `node --test _audit/payment-final-hardening-tests.mjs` | **22 tests, 22 pass, 0 fail** |
| Existing backend suite | `node --test _audit/backend-tests.mjs` | **43 tests, 43 pass, 0 fail** (unchanged) |
| Final-pass suite | `node --test _audit/backend-finalpass-tests.mjs` | **16 tests, 16 pass, 0 fail** (unchanged) |
| Typecheck | `npx tsc --noEmit` | **exit 0, no diagnostics** (whole project) |
| Lint (changed files) | `npx eslint src/lib/actions/payment-verification.ts src/lib/actions/payment-webhook.ts src/lib/actions/payment-actions.ts src/lib/actions/premium.ts _audit/payment-final-hardening-tests.mjs` | **exit 0, no output** |

`npm run build` was deliberately not run: it writes outside the payment scope (`.next/`,
build metadata) and other agents may be building concurrently; `tsc --noEmit` plus lint and
the suites are the substitute. The two pre-existing suites passing unchanged is the
regression evidence that valid payments are unaffected.

## 4. What the new suite actually tests (real code, no copies)

1. **Shared decision** — every malformed stored/provider amount and currency (17 junk values
   per amount field, incl. `null`/`undefined`/`0`/negative/`NaN`/`Infinity`/empty/text/
   booleans/objects/arrays, and oversized strings) returns the precise refusal reason;
   mismatches stay distinguishable from malformed input; the zero-tolerance boundary
   (`99.00` ok, `98.99` refused, `"9900"` major ≠ `9900` paise) is pinned; a 3–8 letter
   lowercase/whitespace variant normalises while "same number, different currency" refuses.
2. **Webhook integration (DI core)** — stored `amount` junk and stored `currency` junk each
   produce 200 + `* unverifiable` with **`claimed === 0` and no grant** and the correct audit
   action; a success event missing both amounts, a malformed `order_amount` next to a valid
   `payment_amount`, and missing/empty `order_currency` all refuse; the pre-existing
   `Amount mismatch` / `Currency mismatch` messages and audit actions are preserved for
   present-but-different values; a valid delivery (including `"99.00"` as a string) still
   claims once and grants once; a refused delivery leaves the order claimable for a later
   valid one.
3. **Grant row check** — zero `profiles` rows ⇒ `ok:false` with `profile not found`, and the
   test asserts the builder actually requested `.select("id")` (otherwise the check cannot
   work); one row ⇒ `ok:true` with the exact update payload and filters; a DB error propagates
   its message; an empty/non-string user id fails without touching the client.
   `claimOrderAsPaid` is covered the same way (row ⇒ `claimed:true`, zero rows ⇒
   `claimed:false`, error ⇒ `ok:false`, filters asserted).
4. **Wiring guard for `verifyPayment`** — `payment-actions.ts` cannot be imported outside Next
   (it loads `next/headers` via `src/lib/supabase/server.ts`), so a static source assertion
   pins that it calls the shared decision, that the verification precedes the claim, and that
   the two old permissive branches/strings cannot return. Stated honestly: this is a wiring
   guard, not a runtime execution of `verifyPayment`.

## 5. Residual blockers (open, not fixed here — do not claim otherwise)

1. **The claim and the grant are still two separate statements, not a transaction.** No RPC,
   no trigger, no migration was written. The correct primitive remains a single
   `SECURITY DEFINER` transaction that claims the order and grants the entitlement together
   (shape sketched in `_audit/backend-final-pass.md` §5). Schema is still not locally
   verifiable (`supabase/migrations/` is empty; no generated DB types), so authoring DDL here
   would have been invented.
2. **Residual crash window.** If the process dies between the CAS claim and the grant, and the
   provider never re-delivers and the user never revisits `/api/payments/verify`, the order
   stays PAID-without-premium. The application-level repair only narrows this (see
   `payment-repair.ts`); there is still **no scheduled reconciler sweep** over
   `orders.status = 'PAID'` joined to non-premium profiles — that would belong in
   `src/app/api/cron/*`, outside this pass's file scope.
3. **Refusals are terminal and need an operator.** A row with a broken stored amount/currency
   now stays `PENDING` and is never granted; the only signal is the new
   `payment.amount_unverifiable` / `payment.currency_unverifiable` audit entry. There is no
   dead-letter queue, admin repair UI, or documented manual reconciliation runbook. The user
   sees "Payment verification failed" on the fallback path.
4. **`markOrderFailed` still does not check affected rows** (pre-existing, unchanged on
   purpose): a FAILED event for an already-PAID order matches zero rows and is silently a
   no-op. Changing it would alter failure-event semantics, so it remains a documented gap.
5. **Entitlement write privilege is unverified.** `verifyPayment` still grants premium through
   the user-session client; if the `profiles` update policy permits a user to write
   `is_premium`/`boosts_remaining` directly, a user could bypass payment through PostgREST
   entirely. This is a policy question that needs the real schema. The webhook path uses the
   service-role client.
6. **Repair is value-idempotent, not transaction-idempotent.** Two concurrent repairs can both
   grant (harmless because the grant *sets* rather than increments), but a repair after the
   user has spent boosts will reset `boosts_remaining` to 5. Calling the recovery fully
   idempotent would be inaccurate.
7. **The plan currency is not pinned.** Verification proves `stored == provider` for the order
   row we wrote; it does not pin the comparison to `PLAN_CURRENCY` ("INR"). Both values come
   from rows this server writes, so the equality is the security-relevant property, but a
   defence-in-depth pin to the plan constant is a product/schema decision that was not made
   here.
8. **`orders.amount` minor-units contract remains schema-unverified** (carried over from
   `_audit/backend-final-pass.md` §6 and `_audit/round2-status.md`); the code and tests
   assume paise, and Cashfree is called with `PLAN_PRICE_PAISE / 100` major units.
9. **The grant's `.select("id")` requires `SELECT` privilege on `profiles`** for the calling
   role (anon/user and service role). Failure mode is safe (grant fails closed) but would
   block purchases, so it must be confirmed against the live policies.

## 6. Coordination notes

- No route or UI change was required: the webhook route already forwards `outcome.body` and
  `status`; the verify route already maps `result.error` to `?status=error`.
- New audit action names (`payment.amount_unverifiable`, `payment.currency_unverifiable`)
  should be added wherever payment audit actions are consumed/monitored.
- The only new module, `payment-verification.ts`, has no `"use server"` directive and no
  dependency on Supabase or Next — the same constraint `premium.ts`, `payment-repair.ts` and
  `safety.ts` document, and it is covered by the wiring guard in the test suite.
- No existing test file was modified; the suites above were run from the working tree as-is.
