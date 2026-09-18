# Atomic payment fulfillment — implementation and live verification

Date: 2026-09-17. Scope: local implementation/tests, authorized live migration,
rolled-back SQL probe, and live PostgREST purchase/reconciliation probe with cleanup.
No provider payments, emails, deployment, or git operations.

## What changed

### Database migration (LOCAL ONLY, not applied)
`supabase/migrations/202609170001_atomic_payments.sql`, written against the verified live
catalog snapshot (`_audit/live-payment-schema.md`, project `drgparslvudatouqtjmx`). Adds no
column to existing tables:

0. **Preflight**: aborts with a clear message if any `orders.status = 'PAID'` row predates
   the trusted write path (review against provider records first).
1. **`public.premium_purchases`** ledger — one immutable row per fulfilled merchant order id
   (unique `order_id` + unique `merchant_order_id`, no FK on `order_id` so deleting an order
   cannot erase a grant record; CHECKs pin plan `premium`, amount 9900, INR, 5 boosts). RLS
   enabled, deny-by-default for clients, explicit service_role policy, all privileges revoked
   from anon/authenticated/public.
2. **`public.orders`**: partial UNIQUE index on `cashfree_order_id`; PAID-oldest index;
   INSERT/UPDATE/DELETE/TRUNCATE revoked from anon/authenticated/public (table + column
   level) so a client cannot fabricate a PAID row the reconciler would trust. SELECT kept for
   the ownership read.
3. **`public.profiles` entitlement guard** (SECURITY INVOKER, `current_user`-based — JWT
   metadata is never consulted): clients can no longer set `is_premium`, `premium_expires_at`,
   or *increase* `boosts_remaining` on their own row; the existing client-side boost debit
   still works.
4. **`public.fulfill_premium_order(text, uuid, numeric, text) -> jsonb`** — service-only
   SECURITY DEFINER, pinned `search_path=''`, all objects schema-qualified, parameters only.
   Locks the merchant order and profile FOR UPDATE, validates owner, plan, exact amount
   (9900) and INR on both stored and provided values, rejects REFUNDED and absent status,
   accepts PENDING/PAID/**FAILED** (a verified success may follow a failed attempt). One
   transaction: ledger insert `ON CONFLICT (merchant_order_id) DO NOTHING` (first grant:
   `is_premium=true`, boosts **+5**, never reset; duplicate: boosts untouched, repairs a lost
   flag), PENDING/FAILED→PAID, transactional audit row into `activity_log`. Missing profile
   or any refusal rolls back everything. Identity mismatch between ledger row and order is an
   exception. Whole migration runs in a single `begin; … commit;` block.
5. **`public.reconcile_premium_entitlements(integer limit default 100) -> jsonb`** —
   bounded 1–100, SKIP LOCKED, per-row subtransaction (one failure counted, sweep continues),
   reuses the fulfillment function; targets exactly PAID orders with a missing ledger row or
   a missing premium flag.
6. EXECUTE on all three functions revoked from PUBLIC/anon/authenticated, granted to
   `service_role` only.

## Release gate — APPLIED (operator-authorized)
Applied to the live AuraMint database (project `drgparslvudatouqtjmx`) on 2026-09-17 via
`_audit/apply-migration.mjs` after the user explicitly chose "Apply now" in a structured
question (the earlier restore approval did not cover migrations). Preflight confirmed
ACTIVE_HEALTHY and zero preexisting PAID rows; the whole migration executed in one request
(HTTP 201, ~1.1s) and is atomic (`begin; … commit;`). Evidence:
`_audit/mcp-evidence/apply-migration-request.json` (redacted, leak-guard clean).

**Read-only post-apply verification** (`_audit/verify-live-migration.mjs`, 9/9 OK):
`premium_purchases` exists; `fulfill_premium_order`/`reconcile_premium_entitlements` are
SECURITY DEFINER with `search_path=""`; the guard trigger is enabled on `profiles`;
unique index `orders_cashfree_order_id_key` exists; anon has NO execute on the RPC, NO
insert/update on `orders`, NO access to the ledger; `authenticated` retains SELECT on
`orders`; live data unchanged (0 PAID rows, empty ledger).

## Application wiring (schema-aligned)
Verified by local execution (`_audit/order-schema-proof.mjs`) against the real column types:
the previous insert failed three ways — nonexistent `payment_provider` column (42703), a
non-UUID string in `orders.id` (22P02), and missing NOT NULL `plan` (23502). `createPremiumOrder`
now: mints a UUID PK, stores the prefixed `auramint_…` merchant id in `cashfree_order_id`,
writes `plan: 'premium'`, inserts via the service-role client (client INSERT privilege on
orders is revoked by the migration), and on provider failure marks FAILED with the narrowed
`markOrderFailed` (only `PENDING` rows, resolved by `cashfree_order_id`).

- `src/lib/actions/payment-fulfillment.ts` (new): typed wrappers
  `fulfillPremiumOrder` / `reconcilePremiumEntitlements` — exact bound RPC parameters, refuse
  malformed/missing RPC responses, fail closed on transport errors.
- `src/lib/actions/payment-webhook.ts`: after signature/owner/amount/currency verification
  the webhook makes ONE call `fulfillOrder(orderId, userId)`; `ok:false → 500` (provider
  retries), `applied → 200 OK`, `recovered → 200 Recovered`, neither → 200 "Already
  processed". Failure path terminal readback now includes REFUNDED; a late failure can no
  longer overwrite a REFUNDED row (`markOrderFailed` only touches PENDING).
- `src/lib/actions/payment-actions.ts` (`verifyPayment`): same fail-closed verification, then
  one atomic fulfillment via the service client; no separate claim/grant/revert chain.
- `src/app/api/webhooks/cashfree/route.ts`: wires `fulfillPremiumOrder` + service client;
  order lookup by `cashfree_order_id`.
- `src/app/api/cron/reconcile-payments/route.ts` (new) + `vercel.json` cron (daily 03:00 UTC):
  fail-closed `assertCronRequest` guard, service client, 500 on any failure.
- Legacy helpers (`claimOrderAsPaid`, `grantPremiumEntitlements`, `markOrderFailed`'s old
  filters, `recoverOrderEntitlements`) are retained for their unit-tested contracts but have
  no production callers (regression-enforced).

## Verification (all local, isolated)
- **SQL execution tests** `_audit/atomic-sql-tests.mjs` — 12/12 on PGlite (isolated
  `_audit/.atomic-test-runtime`, test-only install, project package.json untouched):
  migration applies; both RPCs SECURITY DEFINER with pinned search_path; atomic
  order+ledger+profile fulfillment; duplicate delivery never refills spent boosts; missing
  profile rolls back leaving the order PENDING; injected profile-write failure after the
  ledger insert rolls back ledger+order; foreign owner/wrong amount/wrong plan/REFUNDED
  refused; FAILED→PAID retry fulfillable; anon/authenticated cannot execute RPCs, write
  orders, or touch the ledger; profile guard blocks client entitlement increases while
  allowing boost debit; reconciliation repairs the crash window, never refills ledgered
  boosts, is idempotent, and counts a no-op attempt as attempted-but-not-repaired; migration
  refuses historical PAID rows.
- **Independent state probe** `_audit/reconcile-sweep-probe.mjs` — prints candidate rows,
  ledger and profile state before/after; all 7 semantic assertions pass (including that the
  sweep targets exactly the two intended orders and never touches boosts on ledgered
  purchases).
- **App regressions** — 150/150 across all suites (incl. new
  `_audit/atomic-payment-tests.mjs`: wrapper RPC shape + malformed-payload refusals, webhook
  atomic success/failure contracts, wiring guards). `npx tsc --noEmit` clean, `npx eslint src
  --max-warnings=0` clean, `npm run build` succeeds with `/api/cron/reconcile-payments`
  present.
- **End-to-end cron route test** `_audit/reconcile-route-e2e.mjs` — the REAL production
  `GET` handler (`src/app/api/cron/reconcile-payments/route.ts`) was invoked with the real
  `assertCronRequest` guard, a real supabase-js client, and the real `rpc()` wire call
  (POST /rest/v1/rpc/... against a local parameter-bound shim) against a fresh PGlite
  database with the migration applied: three unauthorized requests (missing header, wrong
  secret, unconfigured CRON_SECRET) were refused 401/401/503 with **zero** database calls;
  the authorized run turned the seeded PAID-but-unledgered crash-window order into
  `is_premium=true` with exactly 5 boosts and a matching `premium_purchases` row
  (order_id/merchant_order_id/user_id/plan/amount 9900/INR/5), left the seeded PENDING
  order untouched, was idempotent on retry (attempted 0), and surfaced an injected
  database failure as 500 with no partial writes. Combined suite: **151/151**.
  Disclosed limit: the PostgREST wire layer between supabase-js and Postgres is a local
  shim executing the same bound SQL; live Supabase PostgREST behavior is untested (the
  live database cannot host test data and the migration is not yet applied there).
- Probe-fix note: the first probe run failed three of its own assertions due to jsonb key
  ordering and a copied candidate count; fixed in the probe and re-run to green. The SQL
  behavior itself never changed between probe runs.
- **Live transactional purchase probe** `_audit/live-purchase-probe.mjs` — the full payment
  success path was executed on the LIVE database inside ONE plpgsql DO block that raises at
  the end (exception = full transaction rollback, zero persistence): a real `auth.users` row
  (the real `handle_new_user` trigger created the profile), a real PENDING order, the real
  `fulfill_premium_order` RPC, then a client-role self-grant attempt under faked JWT claims.
  All 10 assertions pass: user+profile created by the real trigger; fulfill `applied:true`;
  order PENDING→PAID; profile `is_premium=true`; boosts exactly +5; exactly one ledger row
  with exact fields (order_id, merchant_order_id, user_id, plan premium, 9900 paise, INR,
  5 boosts); one transactional `payment.fulfilled` audit row; and the
  `profiles_entitlement_guard` trigger refused the client self-grant (42501) — the guard is
  reachable in the real signed-in path (with claims, RLS exposes the row and the trigger,
  not RLS, refuses the write). `_audit/verify-probe-rollback.mjs` confirmed afterwards:
  0 ledger rows, 0 probe orders, 0 probe users, 0 audit rows on the live database.
- **Live catalog check** `_audit/live-catalog-probe.mjs` (read-only): confirmed
  `auth.users.raw_app_meta_data`/`raw_user_meta_data` are jsonb and the profiles policies
  (SELECT `true`, INSERT/UPDATE `auth.uid() = id`) — this explained the probe's earlier
  inconclusive guard result (no-claims UPDATE matched zero rows and never reached the
  trigger) and motivated the claims-faking fix above.
- **Cron route e2e re-confirmed 2026-09-18** (`_audit/reconcile-route-e2e.mjs`, 1/1 PASS):
  rerun after an invocation-flag correction (the loader must be registered with
  `--loader`, not `--import`, for the resolve hook to take effect — test-side only, no
  application code changed). Same green outcome: 3 unauthorized attempts refused
  401/401/503 with zero database calls; the authorized sweep repaired the seeded
  PAID-but-unledgered order; retry was a no-op; injected database failure returned 500.
- **Defensive constraints review** `_audit/sql-credential-constraints-review.md`
  (read-only subagent review, 2026-09-18): parameter-binding and credential-sourcing
  constraints hold across src, the migration, and `_audit` scripts — no assembled SQL
  (migration fully static; app has no raw SQL driver; audit scripts bind `$1..$n`), and
  all secrets read from env/configured stores at call time, failing closed, with no
  usable credential literals in source. Scope-limited: static review only; env files and
  git history intentionally unread.
- **Live PostgREST wire test** `_audit/live-postgrest-purchase.mjs` (7/7 PASS, evidence:
  `_audit/mcp-evidence/live-postgrest-purchase.json`) — closes the "real wire path under a
  real signed-in JWT" gap. A throwaway confirmed user was created via the Supabase Auth
  admin API (no email sent), signed in with a real password grant, and every request below
  went over live `*.supabase.co` PostgREST with parameter-bound filters (no SQL sent):
  1. The signed-in JWT read its trigger-created profile (`is_premium=false`, boosts 0).
  2. Two synthetic PENDING orders were inserted with the service key; the signed-in user
     saw exactly its own two rows (RLS ownership filter working on the wire).
  3. Service-key `fulfill_premium_order` over PostgREST returned `{applied:true}` and the
     signed-in session immediately saw `is_premium=true`, boosts +5.
  4. Replaying the same RPC returned `{applied:false}` with boosts unchanged (no refill).
  5. Second order flipped to PAID, then `reconcile_premium_entitlements` over PostgREST
     repaired it (`{attempted:1, repaired:1, failed:0}`) with both exact ledger rows
     (premium, 9900, INR, 5 boosts each); an immediate re-sweep returned all zeros.
  6. Refusals were not re-tested here — anon/authenticated denial of the RPCs, ledger,
     and order writes was already proven live in `_audit/verify-live-migration.mjs` (9/9,
     including `has_function_privilege` for anon) and the client-role denial was exercised
     at the SQL level in the rolled-back probe.
  7. Cleanup verified row-by-row: activity_log, premium_purchases, orders all zero probe
     rows; auth user deleted with profile cascade confirmed.
  Scope note: the two RPCs were invoked with service-role credentials because EXECUTE is
  deliberately service_role-only (enforced live earlier); the *user-facing* half of the
  wire (auth handshake, JWT acceptance, RLS-scoped reads) ran under the real user JWT.

## Honest limits (not verified here)
- **PGlite is not the Supabase Postgres** (single-connection, no real `supabase_admin` role,
  emulated auth schema). Concurrency (two concurrent fulfillments racing on one order) is
  argued by `FOR UPDATE` + unique constraints but not demonstrated with parallel sessions.
- **No live end-to-end payment**: Cashfree sandbox, webhook delivery from the provider, real
  pointer/keyboard coin press, and authenticated UI journeys remain unverified.
- The reconciler counts a no-op repair (attempted>repaired) as normal; the cron route returns
  500 only on `failed>0` or RPC refusal, not on no-op attempts.
- `orders.plan` has no DB CHECK; plan validation currently lives in the RPC + insert code.

## Updated deployment evidence (supersedes earlier environment conclusions)
Preview `dpl_HJRXSRcdNYzTqkEySqtutCLSfYiG` is READY at
https://auramint-8dtya8dkz-novamint-networks-projects.vercel.app . Production was not promoted.
The first preview failed because the upload script decoded binary files as UTF-8;
base64 byte-preserving uploads fixed that build failure.

CRON_SECRET was generated securely and updated through the documented PATCH endpoint;
existing targets were preserved. The earlier claim that ENV_ALREADY_EXISTS proved
integration management was unsupported and is withdrawn. A prior preview returned 503;
the current preview returns 401 without application auth and 200 with the stored bearer
secret: `{ok:true,attempted:0,repaired:0,failed:0}`. Evidence is in
`_audit/mcp-evidence/authorized-cron-live.json`. Provider payment tests and visual QA remain
unverified. See `_audit/RELEASE-HANDOFF.md` for the current release gates.

## Historical release-gate notes (superseded by update above)
1. **Vercel environment inspection (read-only, 2026-09-17/18)**: existing AuraMint project
   `prj_hWFMZo7qff7V59Q8pgqeoKY7XJeq` belongs to NovaMint Networks, not the separate
   `vercel2` account. Entries exist across production/preview/development, but the
   per-variable decrypted endpoint confirms `CRON_SECRET`, `CASHFREE_CLIENT_ID`,
   `CASHFREE_CLIENT_SECRET`, and `CASHFREE_WEBHOOK_SECRET` are EMPTY. Local values are
   also empty. `NEXT_PUBLIC_CASHFREE_ENV` is `sandbox`. Bulk-list encrypted values must
   not be mistaken for nonempty plaintext credentials. No settings were changed and no
   deployment or Cashfree request was issued. Supply valid sandbox credentials through
   the secret store, configure the webhook signing credential expected by the application,
   and generate a sufficiently long cron secret before deployment and provider testing.
   **BLOCKER (2026-09-18)**: valid Cashfree sandbox credentials have not been supplied
   through any authorized channel; the sandbox payment test and deployment verification
   cannot proceed autonomously. Valid Cashfree credentials cannot be generated by the
   assistant; they must come from the Cashfree dashboard into Vercel secret settings (or
   an authorized secret-store reference). `CRON_SECRET` requires no user action: an
   integration-managed entry already exists (write rejected ENV_ALREADY_EXISTS even with
   upsert; reads decrypt to an empty value by design) and Vercel's scheduler injects the
   matching bearer header itself; set it manually only if a scheduled run is refused 401.
2. **Cashfree sandbox end-to-end**: create a sandbox order through the UI, pay with
   Cashfree's sandbox instrument, confirm the webhook/verify path grants premium, then swap
   in production credentials.
3. **Visual acceptance**: the redesign (typography, icons, Framer Motion coin interaction)
   needs the user's eyes before sign-off.
