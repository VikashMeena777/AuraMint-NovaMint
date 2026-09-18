# Backend Final Pass — rate limiting, feed read aggregates, payment crash window

Scope owner: `src/lib/actions/**`, `src/lib/rate-limit.ts` (new), plus the one backend glue
line in `src/app/api/webhooks/cashfree/route.ts` required to wire the payment repair.
UI, analytics, `package.json`/`package-lock.json`, `next.config.ts`, `eslint.config.mjs`,
`src/lib/utils.ts`, `src/types/*` and SQL/schema were **not touched**.

Constraints honoured: no `npm install`, no live DB/Redis/provider calls, no payments, no
emails, no secrets read or printed (env **names** only), no commits/push, no exploit
reproduction, **no `next build`** (another agent was building), no migration applied.

This pass resumes after a coordinator-requested pause. At the pause point zero files had
been changed; every file below was written after the explicit resume instruction.

## 1. Files changed / added

| File | Change |
|---|---|
| `src/lib/rate-limit.ts` | **new** — dependency-free Upstash REST atomic per-user limiter |
| `src/lib/actions/feed-aggregates.ts` | **new** — pure read-side feed aggregates |
| `src/lib/actions/payment-repair.ts` | **new** — crash-window entitlement repair (DI + Supabase binding) |
| `src/lib/actions/aura-actions.ts` | rate-limit `submitAuraEvent`; `getPublicFeed` now returns `reaction_counts`, `viewer_vote`, `viewer_reaction`, `profiles.is_premium`, and `error` on failure |
| `src/lib/actions/payment-actions.ts` | rate-limit `createPremiumOrder`; `verifyPayment` reconciles entitlement when the CAS is already claimed |
| `src/lib/actions/payment-webhook.ts` | new `recoverEntitlements` dep; already-claimed path reconciles instead of assuming success |
| `src/app/api/webhooks/cashfree/route.ts` | wires `recoverOrderEntitlements` into the existing deps factory (1 method) |
| `_audit/backend-finalpass-tests.mjs` | **new** — 16 unit tests for the new helpers |
| `_audit/backend-tests.mjs` | deps factory gains `recoverEntitlements`; duplicate-delivery test now asserts reconciliation; +2 crash-window webhook tests |

## 2. Verification (evidence)

| Check | Command | Result |
|---|---|---|
| New unit tests | `node --test _audit/backend-finalpass-tests.mjs` | **16 tests, 16 pass, 0 fail** |
| Existing regression suite | `node --test _audit/backend-tests.mjs` | **43 tests, 43 pass, 0 fail** (was 41; +2 new) |
| Types — backend scope | `npx tsc --noEmit` (filtered to `src/lib/**`, `src/app/api/**`) | **no errors in scope** |
| Types — whole project | `npx tsc --noEmit` | **1 error, outside my scope** — see note below |
| Lint (changed files) | `npx eslint src/lib/actions src/lib/rate-limit.ts src/app/api/webhooks/cashfree/route.ts _audit/backend-finalpass-tests.mjs` | **exit 0, 0 errors, 0 warnings** |
| Local schema presence | `find supabase -type f` / `find . -name "*.sql"` | **no files** — `supabase/migrations/` is empty, no generated DB types |

`npx tsc --noEmit` was **clean** for the whole project earlier in this pass. It is now red on a
single concurrent UI edit made by another agent after that run:
`src/components/ui/animated-icon.tsx(183,17)` — `useReducedMotion()` is `boolean | null`,
passed to a `reduced` prop typed `boolean | undefined` (an untracked file I did not create or
edit). My backend scope typechecks with **zero** errors, and my source has not changed since
the clean run. `npm run build` was deliberately **not** run (instruction: no concurrent build);
`tsc --noEmit` plus the route/module lint is the substitute. Full-project build evidence from
the previous pass stands in `_audit/backend-report.md`.

## 3. Rate limiting (new)

`src/lib/rate-limit.ts` — no package added; the Upstash REST API is a plain HTTPS endpoint.

- **Env NAMES only**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Values are read
  at call time, never logged, never returned. A token shorter than 16 chars is treated as a
  placeholder, not a credential.
- **Atomic**: one request to the Upstash base URL with
  `["EVAL", <lua>, "1", key, "<windowMs>"]`. The Lua script runs *inside Redis*:
  `INCR` → `PEXPIRE` on first write → `PTTL`, returning `{count, ttl}`. Two concurrent
  requests for the same key cannot both open the window or lose an increment.
- **Per user**: `auramint:rl:<scope>:<sha256(subject)[0:32]>`. The subject (a server-verified
  user id) is hashed so raw ids are not stored as Redis keys.
- **Fail closed in production**: missing/blank/invalid config, non-HTTPS URL in production,
  non-2xx status, timeout, unparseable JSON, `{error:...}`, or a malformed `result` array all
  **deny**. Outside production they degrade to `{allowed:true, degraded:true}` with a loud
  `console.error`, so local dev works without Upstash. The mode is an explicit parameter
  (`environment`), so both behaviours are unit-testable.
- **Bounded**: `AbortSignal.timeout(2000)` (injectable) so a slow Redis cannot hang a Server
  Action. `Limit`/`window` must be positive integers and `scope` must match
  `/^[a-z0-9._-]{1,64}$/i`, otherwise the call fails closed without touching the network.
- **Injection**: `fetchImpl`, `config` (`null` forces "not configured"), `now`,
  `environment`, `timeoutMs` are all injectable. `rateLimitUserMessage()` returns a
  non-informative message for infrastructure failures.

Budgets (`RATE_LIMITS`, single source of truth):

| Scope | Limit | Window | Rationale |
|---|---|---|---|
| `ai.submit_event` | 30 | 3600 s | `submitAuraEvent` is the only user-triggered AI spend; far above the free 5/day |
| `payment.create_order` | 10 | 3600 s | each call writes an order row and calls Cashfree |

Call sites:
- `submitAuraEvent` — after zod validation (malformed input costs nothing) and **before**
  the profile read / daily-limit query / `calculateAura`, so it also caps DB load. A denial
  returns the standard `{ error }` shape, so the UI needs no change.
- `createPremiumOrder` — immediately after the auth check and **before** the profile read,
  the order insert and the provider call.

## 4. `getPublicFeed` read aggregates (verified missing → fixed)

Verified against the real consumer (`src/components/aura/aura-event-card.tsx` and
`src/components/aura/types.ts`):

- `reaction_counts?: Record<string, number>` was in the UI type but **never returned**; the
  card initialises `useState(event.reaction_counts ?? {})`, so every reaction chip rendered 0.
- `profiles.is_premium` was **not in the embedded select**, yet the card uses
  `profile?.is_premium` for the subject's premium treatment (crown) — always `undefined`.
- The viewer's own vote/reaction was never returned (`userVote` always started `null`).
- A query failure returned `{events: [], hasMore: false}`, indistinguishable from "no entries".

Fixes (additive, no UI edits required — the dashboard already casts the result):

- selected `is_premium` in the `profiles!aura_events_user_id_fkey` embed and normalised it
  in `PublicProfileSummary`.
- `PublicFeedEvent` now carries `reaction_counts`, `viewer_vote`, `viewer_reaction`.
- `attachFeedInteractionState()` reads:
  - `reactions.select("event_id, type").in("event_id", ids)` → per-event counts;
  - `reactions`/`votes` filtered by `user_id = viewer` → the viewer's own state.
  Aggregates are **best-effort**: a failure logs a warning and degrades to empty, never
  failing an otherwise valid feed.
- `PublicFeedResult` gains `error?: string`, set only when the feed query itself failed.

`src/lib/actions/feed-aggregates.ts` holds the pure, tested logic. Only allowlisted
`REACTION_TYPES` are counted, so a legacy/forged `type` can never create a UI chip or
inflate a known one. Bounded to the page's event ids (≤50).

**RLS caveat (blocker):** if the `reactions`/`votes` read policies do not permit a signed-in
user to read other users' rows, the counts will be 0 for other people's events. This is a
policy concern, not fixable in application code; it is listed as a blocker below.

## 5. Payment crash window — honest analysis + application-level repair

### The window (confirmed by reading the code)

The paid transition is two non-atomic steps across two clients/tables:

1. `claimOrderAsPaid` / webhook `claimOrderPaid`: `update orders set status='PAID' where id=? and status<>'PAID'`.
2. `grantPremiumEntitlements`: `update profiles set is_premium=true, boosts_remaining=5`.

A crash (or a grant failure whose compensating revert also fails) between 1 and 2 leaves
**order PAID, user not premium**. Previously both paths then treated `claimed:false` as
"already processed" and returned success — stranding the user permanently.

### Application-level repair (implemented)

`src/lib/actions/payment-repair.ts`:

- `decidePaidOrderRecovery(snapshot)` — pure decision table: unreadable/missing profile ⇒
  `unverified`; `is_premium === true` ⇒ `already_entitled`; otherwise ⇒ `needs_grant`.
- `recoverPaidOrderEntitlement(deps, userId, orderId)` — DI core; returns `ok:false` when the
  state cannot be read or the grant fails, so callers never report an unsubstantiated success.
- `recoverOrderEntitlements(supabase, …)` — Supabase binding used by both paths.

Hooked in at both places where a PAID order can be re-observed:

- **Webhook** (`payment-webhook.ts`): on `claimed:false` it calls `recoverEntitlements(userId, orderId)`;
  `ok:false` ⇒ **500** (provider retries); `recovered:true` ⇒ logs
  `payment.webhook.recovered` and returns 200 "Recovered"; otherwise 200 "Already processed".
- **Verify fallback** (`verifyPayment`): when the order re-reads as `PAID`, it calls
  `recoverOrderEntitlements`; on success logs `payment.success { recovered: true }`, on
  failure returns an error so the user can retry.

Granting **only when premium is missing** is deliberate: `grantPremiumEntitlements` *sets*
`boosts_remaining = 5`, so an unconditional re-grant on every duplicate provider delivery
would silently replenish a user's already-spent boosts. This is covered by a test
("already-premium orders are left untouched (no boost reset)").

### What this is NOT (stated plainly)

- **It is not atomic.** Two concurrent repairs can both observe "not premium" and both
  grant. That is value-idempotent (sets, never increments) and therefore harmless, but it is
  still two statements, not a transaction.
- **It still needs a trigger event.** If the process crashes and the provider never
  re-delivers and the user never revisits `/api/payments/verify`, the order stays
  PAID-without-premium. Repairing that residual requires a **sweep** (a reconciler) over
  `orders` where `status='PAID'` joined to non-premium profiles — which belongs in a route
  I do not own (`src/app/api/cron/*`).
- **Narrowed, not eliminated.** The remaining unrepaired window is "the grant write itself
  fails and no retry/revisit ever happens".

### DB transaction requirement (blocker — no migration written)

The correct fix is a single transaction/RPC that claims the order **and** grants the
entitlement together, with the same repair semantics:

```
begin
  lock the order row
  if status <> 'PAID':
      status := 'PAID'; grant premium;              -> 'claimed'
  elsif profile is not premium:
      grant premium;                                -> 'repaired'
  else:                                             -> 'already'
commit
```

A `SECURITY DEFINER` function with that body (or an equivalent `update … returning` +
`security definer` trigger) is the atomic primitive. **No migration file was written**,
because the schema is not locally verifiable (see §6). The DDL above is a *shape sketch for
discussion*, not an artifact; whoever owns the schema must confirm column names/types, the
`orders.status`/`profiles.is_premium` definitions, RLS, and the exact boost-grant semantics
before it is authored and applied.

## 6. Schema / DB blockers (migration directory is empty — nothing invented)

Evidence: `supabase/migrations/` contains **zero** files, there are no `*.sql` files anywhere
in the repo, and there are no generated Supabase database types (`src/types/` holds only
`cashfree.d.ts`). Consequently no schema could be verified locally, so **no migration was
created**, per the instruction to write one only when the schema is locally verified.

1. **Atomic claim+grant RPC (blocker)** — as in §5. Until it exists, the crash window is only
   narrowed by application code and a residual PAID-without-premium state is possible.
   *Unapplied migration required: yes.*
2. **Entitlement write is not privileged (security-relevant, pre-existing).** `verifyPayment`
   grants premium through the **user session** client. If the `profiles` update policy allows
   a user to write their own row without column-level restrictions, a user could set
   `is_premium = true` directly through PostgREST and bypass payment entirely. Either the
   policy must forbid client writes to `is_premium`/`boosts_remaining`, or entitlement writes
   must move to the service-role client (the webhook already uses it). This pass kept the
   existing client choices to avoid a trust-model change mid-flight; it must be verified.
3. **Reaction-count read policy (blocker for §4)** — the aggregate read depends on a
   `SELECT` policy that lets a signed-in user count other users' `reactions` rows. Verify, or
   the chips stay at 0. A maintained aggregate column or a `security definer` count function
   would be the alternative; neither was invented here.
4. **Upstash REST payload smoke test (unverified by design)** — the atomic Lua `EVAL` command
   shape is implemented per Upstash's documented "command as a JSON array on the base URL"
   contract, but it was **not** exercised against a live Redis (production access is
   prohibited). It must be smoke-tested in a non-production environment before being relied
   on; the fail-closed behaviour means a wrong shape denies traffic (safe, but visible).
5. **`orders.amount` minor units + `profiles.current_tier`** — carried over unresolved from
   `_audit/backend-report.md` §"Schema requirements"; unchanged this pass.
6. **`aura_events.upvotes/downvotes` backfill** — still required for historical "hot"/"top"
   correctness; unchanged this pass.

## 7. Remaining issues (not fixed, scoped elsewhere or requiring a decision)

- **No reconciler sweep** for PAID-without-premium (§5). Needs a route in `src/app/api/cron/*`.
- **Vote/reaction actions are not rate limited.** The helper supports it
  (`consumeRateLimit({scope:"interaction.vote", …})`); the brief asked for limits before AI
  calls and order creation only, so `voteOnEvent`/`reactToEvent` were left alone.
- **Day boundary is UTC** (product targets IST) — unchanged.
- **`getLeaderboard` viewer-relative rank** (requested in `_audit/app-report.md` §6.2) — not
  done; out of this pass's brief.
- **UI adoption of the new feed fields** — `viewer_vote`/`viewer_reaction` are now on the
  wire but the card's `userVote` state is still unconditioned on them; that is the UI owner's
  change.

## 8. Coordination notes

- The unified server shapes are unchanged for existing consumers; `PublicFeedResult`,
  `PublicFeedEvent` and `PublicProfileSummary` only gained fields (all additive).
- `payment-webhook.ts` gained one required dep (`recoverEntitlements`). Any other caller of
  `handleCashfreeWebhookEvent` must supply it; the only caller (the webhook route) and the
  test deps factory were both updated.
- `RATE_LIMITS` / `consumeRateLimit` are exported from `src/lib/rate-limit.ts` (no
  `"use server"` directive) so other server code can adopt the same limiter without a new
  dependency.
