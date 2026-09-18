# Backend Audit — Implementation Plan

Owner scope: `src/lib/actions`, `src/lib/ai`, `src/lib/email`, `src/lib/utils/activity-logger.ts`,
`src/lib/badges.ts`, `src/app/api`, `src/app/auth`, `src/lib/supabase`, `src/middleware.ts`.
Out of scope (other agents): UI/components, `next.config.ts`, `eslint.config.mjs`, `package.json`,
`src/lib/utils.ts`, `src/types/*`, SQL/schema migrations.

Docs read before coding (from `node_modules/next/dist/docs` — AGENTS.md requires reading them):
- `01-app/01-getting-started/16-proxy.md` + `03-api-reference/03-file-conventions/proxy.md`
  → **`middleware.ts` is deprecated in Next 16 and renamed `proxy.ts`**; the export must be named
  `proxy`; proxy runs on the Node.js runtime (edge is not supported for proxy).
- `01-app/02-guides/upgrading/version-16.md` → rename instructions for the file + the export.
- `01-app/01-getting-started/15-route-handlers.md` → Route Handlers are **not cached by default**.
- `01-app/02-guides/data-security.md` → Server Actions are reachable by direct POST; each action
  must re-verify auth + **authorization (IDOR)**, validate input, and control return values.
- `01-app/02-guides/authentication.md` → proxy checks are only optimistic; do not use it as the
  only authorization layer.
- `01-app/03-api-reference/04-functions/after.md` → `after()` for work that must outlive the response.
- Security checklist: `~/.agents/skills/fullstack-guardian/references/security-checklist.md`.

## Findings (severity → fix)

### Critical

| # | File | Issue | Fix |
|---|------|-------|-----|
| C1 | `api/cron/{daily-report,streak-reminder,weekly-digest}/route.ts` | Cron guard is **fail-open**: expected value is the *string* `"Bearer undefined"` when `CRON_SECRET` is unset, so `Authorization: Bearer undefined` authenticates. Plain `!==` compare is not timing-safe. | Shared `assertCronRequest()` in `src/lib/supabase/cron-auth.ts`: fail closed on missing/short secret, timing-safe compare, 401 otherwise. |
| C2 | `app/auth/callback/route.ts` | **Open redirect**: `next` is unvalidated and `x-forwarded-host` is attacker-controlled, so `https://<attacker-host>${next}` is returned. | Validate `next` (must be a single-slash absolute path, no `\`, no control chars, bounded length) and resolve the origin from a trusted source only (`NEXT_PUBLIC_APP_URL`, else request origin). |
| C3 | `api/webhooks/cashfree/route.ts` | Order is marked PAID and premium granted **without verifying the paid amount/currency** against the stored order, and idempotency is a read-then-write race (concurrent duplicates both grant). | Validate event payload (zod), compare `order_amount`/`order_currency` to the stored order, and use a conditional update (`status != PAID`) as the atomic claim before granting entitlements. |
| C4 | `api/webhooks/cashfree/route.ts` | Missing `CASHFREE_WEBHOOK_SECRET` returns **200** → payments silently not delivered, no alert, no retry. | Return 5xx on misconfiguration (loud + retryable) and log CRITICAL. |
| C5 | `lib/actions/payment-actions.ts` | Order row is inserted **after** the Cashfree order is created; if the insert fails the user is charged and the webhook can never resolve the order → paid-but-no-premium. | Insert the order row (PENDING) first, then create the provider order, then attach `provider_order_id`; mark FAILED if provider creation fails. |

### High

| # | File | Issue | Fix |
|---|------|-------|-----|
| H1 | `lib/actions/aura-actions.ts` | `getUserProfile()` has no auth check, no input validation, and returns `select("*")` on another user's profile row (output filtering). | Require auth, validate the username with the same regex used for updates, select an explicit public column list. |
| H2 | `lib/actions/aura-actions.ts` | `voteOnEvent`/`reactToEvent` trust runtime input (`value` can be any number, `type` any string) and the vote counters are never maintained (the toggle path calls a non-existent RPC `decrement_column`; the switch path is a no-op update) → "hot"/"top" feeds sort by an always-0 column. | Zod-validate `value` ∈ {1,-1} and `type` ∈ allowlist; recompute `upvotes`/`downvotes` from the `votes` table after each mutation (skip on count error). |
| H3 | `lib/actions/aura-actions.ts` | `boostEvent` read-modify-writes `boosts_remaining` → concurrent boosts can go negative / double-spend; partial failure leaves event boosted with no deduction. | Compare-and-swap updates (`.eq("boosts_remaining", current)`, `.eq("is_boosted", false)`) with a compensating revert. |
| H4 | `lib/actions/aura-actions.ts` | `updateProfile` doesn't validate `display_name` (unbounded / control chars) and assumes `username_changes` is an array. | Zod schema for username + display name, `Array.isArray` guard, case-insensitive uniqueness check. |
| H5 | `lib/email/send.ts` | **HTML injection** into transactional email: `username`, event `description`, AI verdict/emoji and vibe strings are interpolated raw. | `escapeHtml()` on every interpolated value; `emailLayout()` escapes the preheader. |
| H6 | `lib/ai/aura-calculator.ts` | File is `"use server"` → `calculateAura` is a **publicly callable** Server Action (cost amplification / unauthenticated AI spend) and the model output is trusted (`parsed.points || 0` can produce NaN, unbounded strings stored and later rendered). | Drop `"use server"` (internal module), zod-validate the model JSON, clamp points, sanitize/length-limit `verdict`/`vibe_tag`/`emoji`, harden the prompt against injection. |
| H7 | `src/middleware.ts` | Deprecated `middleware.ts`/`middleware` export in Next 16; protected-path list misses `/analytics`, `/badges`, `/wrapped`, `/vs`, `/onboarding`; `startsWith` over-matches; a Supabase outage in `getUser()` 500s every route (including payment webhooks). | Rename to `src/proxy.ts` with a named `proxy` export, segment-exact prefix match, complete route list, try/catch degrade, and exclude `/api/cron` + `/api/webhooks` from the matcher (keep them out of the session-refresh path so provider retries never depend on Supabase auth). |

### Medium

| # | File | Issue | Fix |
|---|------|-------|-----|
| M1 | cron routes | `createClient(...)` runs **outside** `try`; missing env ⇒ unhandled 500 HTML. Email failures are still counted as `sent`. No fan-out cap. | Move client creation inside the guarded block, count only successful sends, cap recipients per run, return `sent`/`failed`/`skipped`. |
| M2 | cron routes | `profiles.tier` selected while every writer uses `current_tier` → if the column is absent the whole query errors and **no emails are sent** (silent). | `select("*")` (schema-tolerant) + `current_tier ?? tier ?? "NPC"`. |
| M3 | `api/payments/verify/route.ts` | `verifyPayment` error results are treated as `pending`; provider status string is reflected into the redirect query; no runtime/dynamic pin. | Distinguish `{error}` → `status=error`; sanitize status to `[A-Z_]{1,20}`; `dynamic = "force-dynamic"`, `runtime = "nodejs"`. |
| M4 | `lib/actions/payment-actions.ts` | No `NEXT_PUBLIC_APP_URL` in production ⇒ `return_url` points at localhost (paid users stranded); no response validation; no fetch timeout; amount/currency from the provider not checked; `Infinity`-like issues around status typing. | Validate app URL in prod, zod-ish validate provider response, `AbortSignal.timeout`, verify amount/currency before granting, explicit `{success,status}` union. |
| M5 | `lib/supabase/*` | Service-role client constructed ad hoc per call (webhook builds 4); missing env silently falls back to placeholder URL/key, hiding misconfiguration. | New `src/lib/supabase/admin.ts` (cached singleton + `isAdminConfigured()`); warn loudly when public env is missing. |
| M6 | `lib/utils/activity-logger.ts` | Supabase returns errors, it does not throw → the `try/catch` never fires and failures are invisible; unbounded `action`/`metadata`. | Check the returned `error`, bound `action` length + metadata size, keep non-throwing contract. |
| M7 | `lib/actions/plan-actions.ts` | `dailyEventsLimit: Infinity` is not serializable across the RSC boundary (arrives as `null`). | Finite sentinel (`PREMIUM_DAILY_LIMIT`) + keep `isPremium` as the source of truth. |
| M8 | `lib/actions/aura-actions.ts` | `getLeaderboard` accepts unbounded `page`/`limit`; `getAnalyticsData` is documented premium but has no entitlement check. | Clamp page 0..1000 / limit 1..100, validate `period`. Analytics: **not** gated (the page is not premium-gated in the UI) — documented as a product decision to confirm, not changed. |
| M9 | `lib/ai/nim-client.ts` | No request timeout / retries on the OpenAI-compatible client → a hung NIM call hangs the action. | `timeout: 15s`, `maxRetries: 1`. |
| M10 | fallback scorer | `desc.includes("w")` matches nearly every description (+500 free points); `"got"` matches inside `"forgot"` (double count). | Word-boundary regex matching, longest-match-first dedupe. |
| M11 | `lib/email/resend.ts` | Recipient not validated (header injection / provider spam); placeholder key path constructs a client with a fake key. | Validate recipient (single address, no CR/LF, bounded), short-circuit before constructing the client. |
| M12 | `app/api/payments/verify` + `createPremiumOrder` | Order id from the query string is passed into a provider URL path (defense in depth against path traversal on the provider host). | Validate `order_id` against `/^auramint_[A-Za-z0-9_-]{1,80}$/` before use. |

### Low / informational (documented, not changed)

- Aura total (`total_aura`) and streak updates are read-modify-write → lost updates under concurrency.
  Correct fix needs a DB function (`increment_aura(user_id, delta)`); migrations are empty (see Blockers).
- Free-tier daily limit is check-then-insert → concurrent submits can exceed 5/day; needs a DB constraint/trigger.
- Day boundary uses UTC (`toISOString().split("T")[0]`) while the product targets IST.
- No distributed rate limiting on `submitAuraEvent`/`createPremiumOrder` (Upstash env vars exist but no client is installed; adding a dependency is out of scope).
- `profiles.username` uniqueness is app-level only; needs a case-insensitive unique index.
- `activity_log.user_id` actor is supplied by the caller; safe today (always the session user) — never pass client input.

## Schema requirements / blockers (migrations directory is empty)

Documented with evidence in the report; no schema is invented by this change:

1. `profiles`: writers use `current_tier`, the cron reader used `tier` → one name must win (I made the reader tolerate both).
2. `orders(id, user_id, amount, currency, status, payment_provider, provider_order_id)`; **`amount` is paise** (writer stores `9900`), provider reports rupees. Needed for C3 amount verification.
3. `votes(value ∈ {1,-1})` + counters `aura_events.upvotes/downvotes`; needs a trigger or RPC (`increment_aura`, vote-counter trigger) for true atomicity.
4. `aura_events` FK name `aura_events_user_id_fkey` is assumed by `getPublicFeed` (embed fails otherwise).
5. `activity_log(user_id, action, metadata)` for the audit trail.

## Test plan

- `_audit/backend-tests.mjs` (Node 24 native TS type-stripping; `.mjs` is outside `tsconfig.include`,
  so it cannot pollute `next build`): pure-function tests for the redirect validator, cron-secret
  compare, HTML escaping, amount matching, order-id validation, points clamping/output sanitization,
  the fallback scorer, and reaction-type normalization.
- Scoped checks: `npx tsc --noEmit`, `npm run lint`, `node --test _audit/backend-tests.mjs`.
- No live provider calls, no email sends, no DB mutations, no secret values read or printed.
