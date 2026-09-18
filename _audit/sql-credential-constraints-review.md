# SQL binding & credential sourcing review (defensive, read-only)

Date: 2026-09-17
Scope: `src/`, `supabase/migrations/`, `_audit/` scripts in `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint`
Nature: static source review only. No live calls, no exploit testing, no credential checks, no changes.
No secret values are reproduced in this file; `.env.local` / `.env.example` contents were deliberately not read.
This is a constraint-focused review, not a comprehensive audit of the whole project.

## Verdict

- Constraint A (external SQL inputs parameter-bound; no concatenated/hand-assembled SQL): **no violations found in the reviewed scope.**
- Constraint B (usable credentials only from environment / configured secret stores; no hardcoded usable secrets): **no violations found in the reviewed scope.**
- Definite issues: none.
- Limits of this review are listed at the end and must be read before quoting the verdict.

## Method

1. Enumerated all source, migration and audit files (113 files under `src/`, one `.sql` migration, 30 `_audit` scripts).
2. Searched for raw-SQL surfaces: `execute`/`execute immediate`, `format(`, SQL-keyword template literals, string concatenation into SQL, `eval`/`new Function`, `child_process`.
3. Inspected every Supabase call site (`.from(...)`, `.rpc(...)`, `.select(...)`, filter builders) and every `_audit` script that talks to Postgres/PGlite/REST/Management API.
4. Searched for credential material: token-shaped patterns (`sbp_` prefix, JWT shape, DB-URL-with-credentials shape, long assigned literals), env-var usage, client-component leakage, tracked env files, `.gitignore`.

## Constraint A — SQL input handling

### A1. Migration SQL is static; RPC bodies use parameters/literals only

- `supabase/migrations/202609170001_atomic_payments.sql:26-28` states the invariant; the file holds it:
  - `fulfill_premium_order(text, uuid, numeric, text)` at `:266-412` uses only declared parameters, `%`-style `raise ... using` messages, and literals. No `EXECUTE`, no statement `format()`.
  - `reconcile_premium_entitlements(integer)` at `:426-494` bounds `p_limit` arithmetically (`:442`) and calls the other function with literals (`:470-475`).
  - All objects are schema-qualified under `set search_path = ''` (`:169`, `:275`, `:430`).
  - `grep -i "\bexecute\b"` over the repo finds only the trigger wiring (`:242`) and `grant execute on function ...` grants (`:509`, `:515`) — i.e. privilege statements, not dynamic execution.
- No other `.sql` file exists in the repo (excluding `node_modules/.next/.git`).

### A2. Application code never assembles SQL

- No raw SQL driver is a dependency (`package.json:11-41` has `@supabase/supabase-js` only, no `pg`/`postgres`), so there is no raw query API in app code.
- The only database call styles in `src/` are the PostgREST builder and two Supabase `rpc()` calls with named parameters:
  - `src/lib/actions/payment-fulfillment.ts:19-24` — `rpc("fulfill_premium_order", { p_order_id, p_user_id, p_amount_minor, p_currency })`.
  - `src/lib/actions/payment-fulfillment.ts:40` — `rpc("reconcile_premium_entitlements", { p_limit: 100 })`.
- Writes/reads go through the builder with static column/table names and value arguments, e.g. `src/lib/actions/premium.ts:39-43`, `:70-80`, `:94-99`; `src/lib/actions/payment-actions.ts:96-100`, `:134-142`, `:225-230`; `src/app/api/webhooks/cashfree/route.ts:34-38`.
- The one non-literal `.select(...)` argument is a module-level constant string: `src/app/(app)/vs/[user1]/[user2]/duel-client.tsx:24` (`const SELECT = "username, display_name, ..."`).
- Pagination is bounded before it reaches `.range(...)`: `src/lib/actions/aura-actions.ts:582-585`, `:619`.
- No `.or()`, `.filter()`, `.textSearch()` or `.match()` call with a raw filter string exists in `src/`.
- No `eval`, `new Function`, or `child_process` usage in `src/` or `_audit/`.

### A3. `_audit` scripts — parameter-bound or static

- PGlite integration/regression tests bind values through `$1..$n` with a values array:
  - `_audit/atomic-sql-tests.mjs:33-43`, `:62-63`, `:86-90`, `:99-104`, `:110-130`.
  - `_audit/reconcile-sweep-probe.mjs:23-28`, `:37`, `:57-60`; its CTE at `:47-54` is a static template literal that binds `$1` to the `user` variable.
  - `_audit/reconcile-route-e2e.mjs:59-64`; the PostgREST shim binds `Number(body.p_limit)` as `$1` at `:85-86`.
  - `_audit/order-schema-proof.mjs:9-16` — `$1..$n` + values array, with the no-argument DDL as a static template literal at `:6`.
- Static DDL baselines and injected-failure triggers are template literals with no interpolation: `_audit/atomic-sql-tests.mjs:8-24`, `:79-81`; `_audit/reconcile-sweep-probe.mjs:8-19`; `_audit/reconcile-route-e2e.mjs:31-42`.
- Live read-only probes send static query string literals to the Management API `.../database/query` endpoint: `_audit/verify-live-migration.mjs:16-26`, `_audit/live-catalog-probe.mjs:10,12`, `_audit/mcp-single-probe.mjs:42`, and the static `Q` object in `_audit/mcp-schema-probe.mjs:123-205` (dispatched at `:208`).
- `_audit/apply-migration.mjs` posts the migration file read from disk, verbatim, in one request (`:112-121`). This is a whole-file migration application, not input interpolation; the payload is repo-controlled static SQL and the endpoint offers no binding interface. Recorded here as a disclosed exception, not a violation.
- `_audit/live-purchase-probe.mjs:20-98` is a self-contained plpgsql DO block: static SQL, generated values only via `gen_random_uuid()` inside the script, and it force-rolls back by `raise` (comment at `:8-11`).
- `_audit/live-postgrest-purchase.mjs:54,63,78,94-102` builds PostgREST URL filters with interpolated server-generated UUIDs. That is PostgREST filter syntax (not SQL assembly); identifiers are `randomUUID()` values returned by the API, the script is operator-run, and the base URL is asserted against the approved project at `:8`.

### A4. Distinctions applied

- Static SQL (DDL baselines, migration, catalog queries) — not an injection surface: no external input reaches it.
- PostgREST builder filters (`.eq/.neq/.gte/.lte/.in/.range/.order`, `.select(...)`) — values are passed as arguments to the client library, which encodes filters; these are not SQL text.
- Data strings (labels, actions, usernames, metadata) — stored via parameterized builder inserts, e.g. `src/lib/utils/activity-logger.ts:52-56`; never concatenated into SQL.
- `src/lib/rate-limit.ts:47-52` is a static Lua script for Redis `EVAL` with `KEYS[1]`/`ARGV[1]` passed separately (`:224`) — parameter separation in the Redis protocol, not SQL.

## Constraint B — credential sourcing

### B1. Application secrets are read from the environment at call time

- Cashfree: `src/lib/actions/payment-actions.ts:65-70` (`CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`; absent => refuses, never a default), sent only as request headers at `:154-156`, `:244-246`; webhook secret at `src/app/api/webhooks/cashfree/route.ts:80` (absent => 503, `src/lib/actions/payment-webhook.ts:110-113`).
- Cron: `src/lib/supabase/cron-auth.ts:12` with fail-closed, constant-time comparison in `src/lib/actions/safety.ts:46-62` (minimum 16 chars).
- Supabase service role: `src/lib/supabase/admin.ts:16,24-27,33` (returns `null` when unset; no fallback value).
- Resend: `src/lib/email/resend.ts:7-13`; NVIDIA NIM: `src/lib/ai/nim-client.ts:11-19`; Upstash: `src/lib/rate-limit.ts:31-35`, `:128-145`, sent only as an `Authorization` header at `:219-225` and deliberately excluded from all log lines (`:229-231`, `:271-277`).
- Missing-env fallbacks are non-usable placeholders only: `src/lib/supabase/client.ts:10-13`, `src/lib/supabase/server.ts:21-22`, `src/lib/supabase/middleware.ts:29-30` (`https://placeholder.supabase.co` / `placeholder-key`). Non-secret literals exist for `DEFAULT_FROM_EMAIL` (`resend.ts:15`), `CASHFREE_API_VERSION` (`payment-actions.ts:156,246`), and app URL (`src/app/layout.tsx:38`) — none are credentials.
- Only these `NEXT_PUBLIC_` variables are referenced (all designed to be public): `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CASHFREE_ENV`. No file containing `"use client"` references a server-only secret (checked by script).

### B2. `_audit` scripts pull credentials from configured stores, never inline them

- Management-API token is read from the configured MCP server env (`.../Automations/.zcode/config.json` → `mcp.servers.supabase.env.SUPABASE_ACCESS_TOKEN`), prefix-checked and never printed: `_audit/apply-migration.mjs:41-47`, `_audit/restore-project.mjs:41-47`, `_audit/verify-live-migration.mjs:7-9`, `_audit/poll-project-status.mjs:20-25`, `_audit/management-project-details.mjs:26-32`, `_audit/mcp-schema-probe.mjs:36-38`, `_audit/live-catalog-probe.mjs:3-5`, `_audit/verify-probe-rollback.mjs:3-4`, `_audit/live-purchase-probe.mjs:16-18`.
- Output redaction and post-write leak guards: `_audit/apply-migration.mjs:24-30,145-146`, `_audit/restore-project.mjs:24-30,121-122`, `_audit/management-project-details.mjs:11-15,93-101`, `_audit/mcp-schema-probe.mjs:17-21,212-214`, `_audit/live-postgrest-purchase.mjs:110` (asserts the evidence JSON contains neither the anon nor service key), `_audit/live-purchase-probe.mjs:149-150`.
- Live PostgREST script reads all three values from `process.env` (`_audit/live-postgrest-purchase.mjs:5-9`) and asserts the expected project URL (a non-secret host) before running.
- Ephemeral per-run credentials exist only in `process.env`: `_audit/reconcile-route-e2e.mjs:99-102` (`randomBytes(32)` for `CRON_SECRET` and service-role key), restored/deleted at `:115-118`, `:175-176`; `_audit/live-postgrest-purchase.mjs:39` generates a throwaway user password with `randomBytes(36)`.

### B3. Secret-shaped literals found are test fixtures, not usable credentials

- `_audit/backend-tests.mjs:124` and `:261`, `_audit/atomic-payment-tests.mjs:301`, `_audit/payment-final-hardening-tests.mjs:203` are fixed fixture constants passed to `checkCronAuthorization` / `verifyCashfreeSignature` as injected arguments.
- `_audit/atomic-payment-tests.mjs:131` embeds a synthetic throwaway database-URL string with fake inline credentials inside a thrown-error fixture (value not reproduced here); the same test asserts such text never appears in a result (`:137`).
- These files, plus `backend-finalpass-tests.mjs`, `aura-number-tests.mjs`, `feed-card-tests.mjs`, `motion-tests.mjs`, make no network calls (imports checked: `node:test`, `node:crypto`, `node:fs`, `typescript`, `react` only). The fixture values authenticate nothing anywhere.
- No other token-shaped/assigned-credential strings were found repo-wide (excluding `node_modules`, `.next`, `.git`); audit evidence JSON under `_audit/mcp-evidence/` matched no personal-token, JWT, credentialed-URL, or inline-password pattern.

### B4. Repository hygiene

- `.gitignore` ignores `.env*`; `git ls-files` shows no env/secret/credential files tracked.
- Evidence writers validate the migration file identity against `.env.local` (read only for the project ref, no value printed) in `_audit/apply-migration.mjs:32-39`, `_audit/restore-project.mjs:32-39`, `_audit/management-project-details.mjs:17-24`.

## Definite issues

None found within the reviewed scope for either constraint.

## Limits and non-claims

- Not a comprehensive audit: the 113 `src/` files were searched broadly and all SQL/query/credential-relevant paths were inspected directly, but this was not a line-by-line review of every file.
- Static review only: no runtime, network, database, or provider verification was performed; behavior and deployed configuration are not attested.
- `.env.local` and `.env.example` were intentionally not read, so their contents (placeholder vs real values) are not attested. `_audit` scripts read `.env.local` for the project ref only; that behavior is reported from source, not executed.
- `_audit/*.log` files were pattern-scanned only; `.next/` build output, `node_modules/`, `.mimosa/` and `.git` history were not reviewed.
- Only one migration exists (`supabase/migrations/202609170001_atomic_payments.sql`); no generated DB types or other schema sources exist to cross-check.
- The external payment test remains blocked by the already-established missing-credentials condition recorded in prior audit documents (`_audit/payment-lifecycle-checkpoint.md`, `_audit/round2-status.md`). It was not rechecked here and no credential values were inspected.
- Line references use repository-relative paths; the repository root is `C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint`.
