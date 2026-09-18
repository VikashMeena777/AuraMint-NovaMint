# Backend Security & Correctness Report

Scope owner: `src/lib/actions`, `src/lib/ai`, `src/lib/email`, `src/lib/utils/activity-logger.ts`,
`src/lib/badges.ts`, `src/app/api`, `src/app/auth`, `src/lib/supabase`, `src/middleware.ts`.
Out of scope and untouched: UI components/pages, `next.config.ts`, `eslint.config.mjs`,
`package.json`, `src/lib/utils.ts`, `src/types/*`, SQL/schema.

Constraints honoured: no `npm install`, no live mutations, no emails sent, no payments
touched, no secrets read or printed (env **names** only), no commits, no exploit generation.

## Verification (evidence)

| Check | Command | Result |
|---|---|---|
| Types (whole project) | `npx tsc --noEmit` | **no output — clean** |
| Lint (my scope) | `npx eslint src/lib/actions src/lib/ai src/lib/email src/lib/utils/activity-logger.ts src/lib/badges.ts src/lib/supabase src/app/api src/app/auth src/proxy.ts` | **0 errors, 0 warnings** |
| Regression tests | `node --test _audit/backend-tests.mjs` | **41 tests, 41 pass, 0 fail** |
| Production build | `npm run build` | **exit 0**, `✓ Compiled successfully`, `✓ Generating static pages (7/7)`, route table contains `ƒ Proxy (Middleware)` and all four `/api/*` handlers |
| Repo lint (baseline → now) | `npx eslint` | 106 errors / 20 warnings → **25 errors / 17 warnings**, all remaining ones in UI files owned by other agents (`src/app/(app)/{badges,dashboard,leaderboard,profile,wrapped}`, `src/app/(auth)/layout.tsx`, `src/components/**`). Zero in the backend scope. |

The build was run several times during the run; two intermediate failures were **not** in this
scope and were fixed by their owners while the run was in flight (a duplicate `const status`
in `premium/premium-client.tsx`, and a `HTMLMotionProps`/`onDrag` mismatch in
`components/ui/button.tsx`). One build attempt was rejected by Next because another agent's
build was already running; the final run above is clean. Raw logs: `_audit/build.log`.

`ƒ Proxy (Middleware)` in the build output is the direct proof that the deprecated
`middleware.ts` → `proxy.ts` migration is wired correctly.

`npm run build` is a full-fidelity check here: the build **compiled** the whole app,
ran the type check and generated the route table, so the backend changes are exercised
by Turbopack's module-boundary rules as well (which is how the `"use server"` export bug below
was caught).

## Files reviewed (every file in scope)

```
src/app/api/cron/daily-report/route.ts        src/lib/actions/aura-actions.ts
src/app/api/cron/streak-reminder/route.ts     src/lib/actions/daily-report.ts
src/app/api/cron/weekly-digest/route.ts       src/lib/actions/payment-actions.ts
src/app/api/payments/verify/route.ts          src/lib/actions/plan-actions.ts
src/app/api/webhooks/cashfree/route.ts        src/lib/ai/aura-calculator.ts
src/app/auth/callback/route.ts                src/lib/ai/nim-client.ts
src/lib/badges.ts                             src/lib/ai/prompts.ts
src/lib/supabase/client.ts                    src/lib/email/resend.ts
src/lib/supabase/middleware.ts                src/lib/email/send.ts
src/lib/supabase/server.ts                    src/lib/email/templates.ts
src/lib/utils/activity-logger.ts              src/middleware.ts (deleted → src/proxy.ts)
```

`src/lib/badges.ts` and `src/lib/supabase/client.ts` were reviewed and **needed no change**:
badges are pure predicate data with no I/O, no auth surface and no injection sink
(they render through React's escaping), and the browser client is public-env only.

## Critical fixes

### C1 — Cron endpoints were fail-open (`/api/cron/*`)
Before:

```ts
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { return 401 }
```

With `CRON_SECRET` unset the expected value becomes the *string* `"Bearer undefined"`, so
`Authorization: Bearer undefined` authenticated. Comparison was also non-constant-time.

Now: `assertCronRequest()` (`src/lib/supabase/cron-auth.ts`) → `checkCronAuthorization()`
(`src/lib/actions/safety.ts`) fails closed when the secret is missing or shorter than
16 chars (503 `Server misconfigured`, logged), requires exactly `Bearer <secret>`
(401 otherwise) and compares with `crypto.timingSafeEqual` over equal-length buffers.
`timingSafeEquals("", "")` is `false`, so an absent secret can never match.
Tests: "fails closed when CRON_SECRET is missing or short", "rejects the `Bearer undefined` bypass",
"requires an exact, constant-time match".

### C2 — Open redirect in the auth callback (`src/app/auth/callback/route.ts`)
Before: `next` was used verbatim and the redirect host came from `x-forwarded-host`
(attacker-controllable): `NextResponse.redirect(\`https://${forwardedHost}${next}\`)`.

Now: `safeRedirectPath()` validates `next` (must be a rooted path, not `//host`, no
backslashes, no control chars, no scheme smuggling, ≤512 chars, percent-decoded form also
checked) and `resolveTrustedOrigin()` derives the origin from `NEXT_PUBLIC_APP_URL` (falling
back to the request origin) — `x-forwarded-host` is never consulted. The welcome email now
runs inside `after()` so the serverless invocation cannot end before the send, and it only
fires for accounts younger than 10 minutes (previously every sign-in of an un-onboarded user
re-sent it). The code itself is length-validated and never logged.
Tests: "rejects open-redirect payloads", "every result is a safe same-origin path",
"ignores attacker-controlled host data".

### C3 — Webhook granted premium without amount/currency verification, and idempotency was racy
Before: `if (order.status === "PAID") return` → then unconditional
`profiles.update({ is_premium: true })` + `orders.update({ status: "PAID" })` in four
separate service-role clients, with no comparison of the paid amount and no atomic claim
(two concurrent deliveries could both pass the read).

Now the security decisions live in `src/lib/actions/payment-webhook.ts`
(`handleCashfreeWebhookEvent`, dependency-injected) and the route
(`src/app/api/webhooks/cashfree/route.ts`) only wires the service-role client:

1. signature verified over `` `${timestamp}${rawBody}` `` with HMAC-SHA256 + constant-time
   compare **before** any parsing or state change; a missing `x-webhook-timestamp` is a 401
   (the signed message must not be ambiguous);
2. JSON parse + zod validation of the payload;
3. order resolved from **our** database (never trusting payload identifiers), rejected unless
   it matches `auramint_*` (`isValidOrderId`, traversal guard);
4. `order_amount` (major units) compared to `orders.amount` (paise) via `amountsMatch`, and
   `order_currency` compared case-insensitively — a mismatch logs `payment.amount_mismatch` /
   `payment.currency_mismatch` into `activity_log` and **does not grant**;
5. owner (`user_id`) must exist on the order — orphan orders are logged CRITICAL and skipped;
6. idempotency is an atomic compare-and-swap: `update({status:'PAID'}).eq(id).neq(status,'PAID').select()`
   — exactly one delivery can observe `claimed: true`;
7. entitlement failure reverts the claim (conditional) and returns 500 so the provider retries;
8. failure events only mark `PENDING → FAILED` (`neq('status','PAID')`), so a late failure
   webhook can never downgrade a paid order;
9. `PAYMENT_SUCCESS_WEBHOOK`/`PAYMENT_FAILED_WEBHOOK` are the only processed types; anything
   else is a 200 "Ignored"; body size capped at 256 KB.

Status codes changed from "always 200" to 401 (bad signature/timestamp), 400 (malformed),
503 (misconfigured), 500 (transient) / 200 (handled or safely ignored). Rationale: a
misconfigured secret previously returned 200, which silently dropped every payment with no
alert and no retry. `/api/payments/verify` remains the user-facing fallback for any
webhook that could not be processed.
Tests: 12 webhook tests covering grant-once, replay, forged signature, forged timestamp,
missing timestamp/secret, malformed JSON, amount mismatch, currency mismatch, unknown order,
orphan order, traversal-shaped order id, failed-payment path, revert-on-failure and
claim-failure.

### C4 — Order row was created *after* the provider call (`src/lib/actions/payment-actions.ts`)
Before: Cashfree was called first, then the `orders` insert. If the insert failed the user
was charged and the webhook had no order to resolve → paid-but-no-premium with no recovery.

Now: the order row is persisted `PENDING` **before** the provider call, then
`provider_order_id` is attached, and any provider/validation failure marks the row `FAILED`.
The provider response is validated (`payment_session_id` required) and the call is bounded by
`AbortSignal.timeout(15s)`. `NEXT_PUBLIC_APP_URL` is required in production (otherwise the
return URL would point at localhost and strand the buyer).

### C5 — `verifyPayment` hardened (`src/lib/actions/payment-actions.ts`, `/api/payments/verify`)
- order id validated against the generated format before it is used in a provider URL path;
- ownership re-checked against the session (`orders.user_id = auth.uid()`);
- provider response parsed with zod, non-OK responses surfaced as errors (previously an
  API error looked like "pending");
- amount + currency re-verified before granting;
- the PAID transition uses the same atomic CAS claim as the webhook (owner-filtered) so the
  webhook and the fallback can never both grant/duplicate boosts;
- failure to grant reverts the claim so a retry can complete the upgrade;
- the redirect target is built from the trusted origin and the status query param is
  restricted to `[A-Z_]{1,20}`.

## High fixes

| ID | File | Fix |
|---|---|---|
| H1 | `src/lib/actions/aura-actions.ts` | `getUserProfile` now requires a session, validates the username with the same regex as updates, and selects an explicit public column list instead of `select("*")` on another user's row (output filtering). |
| H2 | `src/lib/actions/aura-actions.ts` | `voteOnEvent`/`reactToEvent` runtime-validate `value ∈ {1,-1}` and `type ∈ REACTION_TYPES` (6 UI values); rows fetched with `maybeSingle()`; the broken call to a non-existent `decrement_column` RPC and the no-op "switch" update are gone — counters are now recomputed from the `votes` table after every mutation, so the "hot"/"top" feeds stop sorting on a permanently-zero column. |
| H3 | `src/lib/actions/aura-actions.ts` | `boostEvent` uses compare-and-swap (`.eq("boosts_remaining", current)`, `.eq("is_boosted", false)`) with a compensating revert, so concurrent boosts cannot overspend or charge without boosting. |
| H4 | `src/lib/actions/aura-actions.ts` | `updateProfile` validates username (zod) and display name (≤50 chars after sanitising), guards `username_changes` with `Array.isArray`, and does case-insensitive uniqueness (`ilike` with LIKE wildcards escaped). |
| H5 | `src/lib/email/render.ts` (new), `send.ts`, `templates.ts` | Transactional email HTML injection closed: every interpolated value (username, event description, AI verdict/vibe/emoji, tier, leaderboard usernames, preheader) passes through `sanitizePlainText` + `escapeHtml`. Renderers were extracted from the transport so the escaping is testable. |
| H6 | `src/lib/ai/*` | `"use server"` removed from `aura-calculator.ts` (it exposed `calculateAura` as a public endpoint, i.e. unauthenticated AI spend). New `src/lib/ai/aura-output.ts` coerces the model JSON with zod + `clampAuraPoints` + sanitised/limited strings; `buildAuraUserPrompt` fences the description in `<<<EVENT … EVENT>>>`, strips newlines and forged delimiters, and the system prompt now states the data is not instructions (prompt-injection guard). `nim-client` gets a 15 s timeout and 1 retry. |
| H7 | `src/middleware.ts` → `src/proxy.ts` | Next 16 deprecation migrated (`export function proxy`, Node runtime, `middleware.ts` deleted — Next errors when both files exist). The optimized gate now covers the whole `(app)` group (`/analytics`, `/badges`, `/wrapped`, `/vs`, `/onboarding` were missing), matching is segment-exact (`/dashboardx` no longer matches), a Supabase failure degrades instead of 500-ing every route, and `/api/cron` + `/api/webhooks` are excluded from the session-refresh matcher so provider retries never depend on Supabase auth. Policy extracted to `src/lib/supabase/route-policy.ts` for testing. |

## Medium fixes

| ID | File | Fix |
|---|---|---|
| M1 | cron routes | Service-role client creation moved inside the guarded block with an explicit 503 when unconfigured; cron database errors are checked (`error` is returned, not thrown); `sent` now counts only successful sends and `failed`/`skipped` are reported; recipients capped at 500 per run; `dynamic`/`runtime`/`maxDuration` pinned. |
| M2 | cron routes | `profiles.tier` was selected while every writer uses `current_tier`; if the column is absent the whole query errored and **no emails were sent**. Reads now use `select("*")` and tolerate both names; `aura_events.emoji` vs `ai_emoji` handled the same way. |
| M3 | `/api/payments/verify` | Error results no longer masquerade as `pending`; provider status sanitised; trusted-origin redirect; `dynamic`/`runtime` pinned. |
| M4 | `payment-actions.ts` | Provider responses validated, timeouts added, missing-profile fail-closed, `amount`/`currency` verified, explicit result types. |
| M5 | `src/lib/supabase/admin.ts` (new), `server.ts`, `middleware.ts` | One cached service-role client (the webhook previously built four); loud `console.error` once when public Supabase env is missing instead of silently using placeholder credentials. |
| M6 | `src/lib/utils/activity-logger.ts` | Supabase returns errors instead of throwing, so the old `try/catch` never fired and failures were invisible; the returned `error` is now checked and logged. `action` is bounded to 120 chars, metadata is size-bounded (2 KB) and JSON-safe, and invalid user ids/actions are refused. |
| M7 | `src/lib/actions/plan-constants.ts` (new), `plan-actions.ts`, `aura-actions.ts` | `dailyEventsLimit: Infinity` was not a serialisable/meaningful quota; the contract is now `number \| null` where `null` = unlimited, matching the UI's documented `dailyEventsLimit: number \| null` ("null means unlimited") — so premium renders "Unlimited" instead of a fake number. The free limit (5) now has a single source of truth. Additionally the constant had to move out of the `"use server"` module: Turbopack rejects **any** non-async export from such a file (`Only async functions are allowed to be exported in a "use server" file`), which broke `next build` until it was moved. `hooks.ts` needed no change — it only imports the `getUserPlanLimits` action reference. |
| M8 | `aura-actions.ts` | `getLeaderboard`/`getPublicFeed` pagination clamped (`page` 0-1000, `limit` 1-100/50) instead of unbounded `range()`. |
| M9 | `nim-client.ts` | 15 s timeout + `maxRetries: 1` so a hung NIM call cannot hang a submit. |
| M10 | `aura-calculator.ts` | Fallback scorer used `desc.includes("w")` (nearly every description got +500) and `"got"` inside `"forgot"` (double counting). Now word-boundary patterns; the unused `category` param and dead counters were removed (also cleared the file's lint warnings). |
| M11 | `email/resend.ts` | Recipient validated before sending (single address, no CR/LF, ≤254 chars) so header injection/multi-recipient input is rejected; subject sanitised/bounded; the Resend client is only constructed with a real key. |
| M12 | `aura-actions.ts`, `payment-actions.ts` | Resource ids validated (`isSafeId`, `isValidOrderId`) before being used in queries/URLs. |

## Regression tests (`_audit/backend-tests.mjs`, 41 assertions-level tests)

Run with `node --test _audit/backend-tests.mjs` (Node 24 type-stripping + `_audit/loader.mjs`
resolve hook for `@/` and extensionless imports). They exercise **real application code**,
not copies:

- **Redirects/auth**: 19 malicious `next` values rejected; every output verified rooted,
  non-protocol-relative, backslash/control-char free; trusted-origin selection.
- **Cron auth**: fail-closed on missing/short/empty secret; the `Bearer undefined` bypass
  reproduced and rejected; wrong-length and wrong-secret rejection.
- **Webhook core** (real HMAC computed in the test): grant exactly once, replay idempotency,
  forged signature, signature over a different timestamp, missing timestamp, missing secret,
  malformed JSON, amount mismatch, currency mismatch, unknown/forged order id, orphan order,
  failed payment path, entitlement-failure revert, claim failure.
- **AI**: output coercion (NaN, `"abc"`, ±999999 clamping, markup stripping, length limits,
  defaults), prompt fencing against delimiter forgery, fallback scorer sign stability for
  "I forgot my homework" / "I won the lottery" (the old substring scorer returned positive for
  "forgot").
- **Email**: injection payloads into username/description/emoji/tier/leaderboard names are
  stripped or escaped (no `<script`, `<img`, `<svg`, `onerror=` survives), templates still render.
- **Route policy**: all 12 app prefixes protected, `/dashboardx` not matched, auth paths exact.

## Intentional behaviour changes (product sign-off recommended)

1. `getUserPlanLimits().dailyEventsLimit` is `null` (unlimited) for premium — matches the UI's contract.
2. `getUserProfile` requires a session and its 30-day history is limited to `is_public = true`
   events (a public profile page could previously aggregate private event points).
3. `updateProfile` username uniqueness is case-insensitive ("Foo" can no longer be taken when
   "foo" exists).
4. Webhook responses are no longer always 200 (see C3) — 5xx asks the provider to retry.
5. `/api/cron` and `/api/webhooks` no longer receive session-cookie refresh from the proxy.
6. Welcome email only for accounts younger than 10 minutes.
7. `reactToEvent(eventId, type)` keeps `type: string` for caller compatibility; the runtime
   allowlist `REACTION_TYPES` (`crown|skull|fire|yikes|iconic|npc`) is the security boundary.
   `ReactionType` is exported for UI adoption. No `any` is used, so
   `@typescript-eslint/no-explicit-any` stays clean.
8. Aura events are stored with `sanitizePlainText(description, 280)` (tags/control chars stripped).

## Schema requirements / blockers (migrations directory is empty — nothing invented)

The code assumes only fields that already existed. The following need DDL/verification, and
two of them are correctness blockers that cannot be fixed in application code:

1. **Atomic aura totals (blocker).** `submitAuraEvent` does read-modify-write on
   `profiles.total_aura`/`streak_days`; concurrent submits lose updates. Needs
   e.g. `increment_aura(p_user_id uuid, p_delta int)` + a trigger or an `update ... returning`
   pattern. Same class of issue for the free daily limit (check-then-insert can exceed 5/day
   under concurrency) — needs a constraint/trigger or an RPC.
2. **`profiles` tier column name (blocker for emails).** Writers use `current_tier`
   (`submitAuraEvent`, `(app)/layout.tsx`), the cron previously read `tier`. Pick one; the
   cron now reads `current_tier ?? tier` so it works either way.
3. **`orders.amount` is in minor units (paise).** `createPremiumOrder` writes `9900`, the
   provider reports `99`. The webhook compares `Math.round(order_amount * 100) === amount`.
   Confirm the column semantics (and consider `NOT NULL`); a null `amount` is logged CRITICAL
   because the amount check cannot run.
4. **Vote counters.** `aura_events.upvotes/downvotes` are now recomputed from the `votes`
   table by the app. A trigger (or the same recompute) is still required for atomicity, and
   **existing rows have stale zero counters** — a one-off backfill is needed for "hot"/"top"
   to look right historically.
5. **`profiles.username`** needs a case-insensitive unique index; uniqueness is currently
   only enforced by an application-level check (race window).
6. **FK name** `aura_events_user_id_fkey` is assumed by the feed's embedded select in
   `getPublicFeed` (a rename silently returns an empty feed — it logs the PostgREST error).
7. **Tables used by my scope**: `profiles`, `aura_events`, `orders`, `votes`, `reactions`,
   `activity_log`. The UI additionally references `reaction_counts` on events
   (`src/components/aura/types.ts`) — nothing in the backend maintains that column, so the
   reaction chips will stay at their default until a read/aggregate path exists.

## Remaining issues (known, not fixed)

- **No rate limiting.** Upstash env vars exist but no client is installed and no dependency
  may be added here. Highest-value targets: `submitAuraEvent` (AI spend), `createPremiumOrder`
  (order spam), `voteOnEvent`. Recommended: Upstash REST via `fetch` (no package needed) or a
  DB counter, fail-closed on the AI/payment paths.
- **Cron fan-out** is capped at 500 recipients/run and resolves emails one-by-one via
  `auth.admin.getUserById` (N+1). Batching via `auth.admin.listUsers` would remove ~1 call per user;
  behaviour otherwise unchanged.
- **Day boundary is UTC** (`toISOString().split("T")[0]`) while the product targets IST, so
  free-tier quotas and "today" reports roll over at 05:30 IST. Changing it must be done
  consistently across UI + actions.
- **`getLeaderboard` exposes `is_premium`** for other users (used by the UI's crown badge).
  Acceptable, but it is PII-adjacent; drop it if unused.
- **Webhook replay window.** No timestamp-freshness rejection by design: deliveries are
  idempotent (CAS claim) and Cashfree retries can be legitimately delayed. Alerting on
  `payment.amount_mismatch` / `payment.currency_mismatch` rows in `activity_log` is recommended.
- **AI verdict text is still model-authored** (sanitised, bounded, HTML-escaped at render).
  If it is ever rendered with `dangerouslySetInnerHTML`, the sanitisation is defeated — keep
  React text rendering or the email escaper.
- The **Next.js RCE advisory** on 16.2.6 (now upgraded to 16.3.5 centrally) is out of my scope;
  the proxy convention used here is unchanged in 16.3.x (verified against
  `node_modules/next/dist/lib/constants.js` `PROXY_FILENAME = 'proxy'`).

## Coordination notes (other agents)

All UI type errors that intersected this contract were resolved during the run; at hand-off
`npx tsc --noEmit` is clean for the whole project and the production build passes. The canonical
server shapes for the UI are exported from `src/lib/actions/aura-actions.ts`
(`AuraEventRow`, `PublicFeedEvent`, `UserProfileRecord`, `AuraHistoryPoint`, `LeaderboardUser`,
`UserProfileResult`, `AnalyticsResult`/`AnalyticsData`, `VoteResult`, `ReactionResult`,
`BoostResult`) and `src/lib/actions/plan-actions.ts` (`PlanLimits`); the UI's
`src/components/aura/types.ts` mirrors them. Rows are normalised at the query boundary
(`normalizeEventRow`) so nullable columns never leak `null` into components.
