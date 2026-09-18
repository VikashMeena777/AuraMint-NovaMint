# Cashfree webhook route — local-only E2E regression

**Status: GREEN.** The real `POST /api/webhooks/cashfree` handler was executed end to end
against a migrated database and a real `supabase-js` HTTP client. No live network or
services, no `.env` reads, no real credentials, no source edits.

## Command and result

```
node --loader ./_audit/loader.mjs --test _audit/webhook-route-e2e.mjs
```

Exit code: **0**. TAP summary: `tests 1 | pass 1 | fail 0 | duration ~2.2s`.

Observed stdout (abridged):

```
E2E PASS: real POST /api/webhooks/cashfree + real HMAC + real supabase-js HTTP + migrated PGlite
  guards: missing-secret 503 (0 db) | bad-signature 401 (0 db) | oversized 413 (0 db) | misconfig 503 (0 db)
  valid signed delivery -> 200 OK: order PAID, is_premium=true, boosts=5, 1 ledger row (9900 INR), 2 audit rows (payment.fulfilled + payment.webhook.success)
  duplicate -> 200 Already processed: boosts stay 5, ledger stays 1, audit unchanged
  amount mismatch -> 200 Amount mismatch: no premium, no ledger write
  PAYMENT_FAILED_WEBHOOK -> 200 OK: order FAILED
  total DB round-trips through supabase-js: 9
✔ cashfree webhook route: real signed handler, entitlement + ledger, duplicate no refill, fail-closed guards
```

Only loader/deprecation warnings from Node 24 and the handler's own intentional
`console.error` diagnostics appear; there are no test warnings or skips.

## What is real vs. emulated

Real (imported/executed, not re-implemented):

- `src/app/api/webhooks/cashfree/route.ts` — the actual `POST` handler, including its
  `content-length` pre-check, `getSupabaseAdmin()` misconfig branch, `req.text()`
  body-length guard, and response wiring.
- `src/lib/actions/payment-webhook.ts` — the entire security core: constant-time HMAC
  verification over `${timestamp}${rawBody}`, Zod payload validation, order-id format
  gate, owner resolution, fail-closed amount/currency verification, idempotent grant.
- `src/lib/actions/payment-fulfillment.ts`, `premium.ts`, `payment-verification.ts`,
  `safety.ts` and `src/lib/supabase/admin.ts` are the production modules.
- A genuine `supabase-js` client built by `getSupabaseAdmin` from `process.env`, issuing
  real HTTP to `127.0.0.1` (GET/PATCH `orders`, POST `activity_log`, POST
  `rpc/fulfill_premium_order`).
- A fresh **PGlite** database with `supabase/migrations/202609170001_atomic_payments.sql`
  applied, so the real PL/pgSQL `fulfill_premium_order` transaction runs (row locks,
  `on conflict (merchant_order_id) do nothing`, boost increment, PAID transition, audit
  insert).

Emulated (disclosed limitation): the **PostgREST wire layer only**. A minimal local HTTP
shim translates the four request shapes this route emits into parameter-bound SQL. It is
not a general PostgREST implementation and no Cashfree/provider traffic is involved —
this is a **transport shim, not a provider E2E**. SQL is always executed with bound
parameters (`$1..$n`); column names are whitelisted against the `orders` schema; `$3::jsonb`
is a cast on a bound value, never string-assembled SQL. Faithfully reproduced contract
details: array JSON returned for `maybeSingle()` (supabase-js collapses zero/one row),
representation array for `update().select("id")`, jsonb body for `rpc()`, `201` with an
empty body for `insert()`.

## Scenario table

| # | Scenario | Synthetic input | Route result | Database assertion |
|---|----------|-----------------|--------------|--------------------|
| 1 | Webhook secret missing | valid signature, `CASHFREE_WEBHOOK_SECRET` unset | `503 Server misconfigured` | 0 shim requests — no DB access |
| 2 | Invalid signature | HMAC computed with a different secret | `401 Invalid signature` | 0 shim requests, no writes |
| 3 | Oversized payload | body > 256 KiB (route limit, asserted against `256 * 1024`) | `413 Payload too large` | 0 shim requests, returned before DB access |
| 4 | Valid signed delivery | `PAYMENT_SUCCESS_WEBHOOK`, amount `99` (INR) vs stored `9900` paise | `200 OK` | order → `PAID`; `is_premium=true`; `boosts_remaining=5`; exactly 1 `premium_purchases` row (`merchant_order_id`, `plan=premium`, `amount_minor=9900`, `currency=INR`, `boosts_granted=5`); 2 audit rows (`payment.fulfilled`, `payment.webhook.success`) |
| 5 | Duplicate delivery | identical signed body replayed | `200 Already processed` | `boosts_remaining` stays `5`; ledger stays 1 row; audit row count unchanged (no refill) |
| 6 | Amount mismatch | `order_amount=1` vs stored `9900` | `200 Amount mismatch` | `is_premium=false`; no new ledger row (fail-closed) |
| 7 | Failure webhook | `PAYMENT_FAILED_WEBHOOK`, `order_status=FAILED` | `200 OK` | order → `FAILED` (exercises the real PATCH path) |
| 8 | Service-role key missing | valid delivery, `SUPABASE_SERVICE_ROLE_KEY` unset | `503 Server misconfigured` | 0 shim requests — no DB access |

Nine DB round-trips total (notably not more): getOrder on each verified success/failure
delivery, plus fulfillment, audit and the failure PATCH.

## Test-integrity notes

- **Credentials**: `CASHFREE_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are 32 random
  bytes each, generated per run with `node:crypto`, stored only in `process.env`, deleted
  in `finally`. They are never printed and never written to source. No `.env` is read and
  no real secret is used.
- **Signing**: HMAC-SHA256 over `${timestamp}${rawBody}`, base64 — the same construction
  the handler verifies.
- **Zero-write proofs** for scenarios 1, 2, 3 and 8 are enforced by counting shim requests
  before/after each call, not by trusting the response alone.
- **Isolation**: PGlite is in-process and ephemeral; the HTTP shim binds `127.0.0.1` on an
  OS-assigned port and is closed in `finally`. No external network or service was contacted.

## Files

- Test: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/_audit/webhook-route-e2e.mjs`
- This report: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/_audit/webhook-route-e2e-report.md`
- Route under test: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/src/app/api/webhooks/cashfree/route.ts`
- Migration applied: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/supabase/migrations/202609170001_atomic_payments.sql`
- Prior pattern reused: `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint/_audit/reconcile-route-e2e.mjs`

No production source, `.env`, deployment config, or credential was read or modified.
