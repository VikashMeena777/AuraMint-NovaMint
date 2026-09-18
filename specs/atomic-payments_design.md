# Atomic payment fulfillment

## Scope and release boundary
Local implementation only. The 2026-09-17 read-only catalog snapshot is the schema baseline. Do not apply migrations, deploy, send payment requests or emails, or mutate the live database. Restoration approval did not authorize migrations.

## Frontend
Keep the existing Cashfree redirect and server-action result contracts. Continue to expose an opaque `auramint_…` merchant order id, but store it in `orders.cashfree_order_id`; use a separate UUID primary key. A verification response reports success only after a confirmed transactional fulfillment result. No new checkout or pricing UX.

## Backend
- Create orders through the service client after session authentication, profile lookup and rate limiting. Write only verified columns: UUID id, user_id, cashfree_order_id, amount (9900 paise), currency INR, plan `premium`, status PENDING. The merchant order id is not Cashfree's separate cf_order_id.
- Verify ownership via session/RLS read by cashfree_order_id; verify provider PAID and exact amount/currency before privileged fulfillment. Webhooks keep signature and payload verification first.
- Service-only `fulfill_premium_order(p_order_id text, p_user_id uuid, p_amount_minor numeric, p_currency text)` locks the merchant order and profile and validates ownership, amount=9900, INR, plan=premium, and allowed status. One transaction changes order status and records a unique purchase grant and updates profile. Reject REFUNDED. Missing profile rolls back all writes.
- Lifetime premium remains the existing product behavior (no new duration is invented). Each distinct paid order adds five boosts once; retries never reset or replenish spent boosts. A purchase ledger makes that distinction durable. Reconciliation can restore the premium flag without re-granting a ledgered purchase.
- Scheduled, bounded reconciliation considers only PAID orders with a missing grant or missing premium flag. Reuses the transactional fulfillment function. A service-only sweep uses row locks, skips locked rows, and reports attempted/repaired/failed counts. Cron route uses existing fail-closed CRON_SECRET guard and generic HTTP errors.

## Security checkpoint
- SQL parameters are bound; SQL bodies use static statements and qualified objects. SECURITY DEFINER functions pin search_path; revoke EXECUTE from PUBLIC/anon/authenticated, grant service_role only.
- Lock and recheck stored payment facts inside the transaction (no check/write gap). Revoke client order writes so a client cannot fabricate PAID rows for reconciliation.
- Add an invoker trigger preventing client inserts/updates of premium flags, expiry, or boost increases while preserving existing authenticated boost debit behavior. No service credentials are exposed in responses.
- Migration must refuse preexisting PAID rows until manually reviewed, rather than trusting possibly client-created historical rows. Never infer verified payment from a profile flag alone.
- Audit transactional grants; refuse malformed RPC responses and database failures. No fallback to non-atomic grant/claim.

## Acceptance
Run isolated local PostgreSQL-compatible execution tests for migration, roles, missing-profile rollback, duplicate/retry behavior and reconciliation; test webhook/verification wiring and fail-closed wrappers; run existing suites, lint, typecheck, production build. Do not describe local tests as live RLS/provider acceptance. Migration application and live integration remain explicit release gates.
