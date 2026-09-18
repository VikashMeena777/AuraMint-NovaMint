# AuraMint release handoff

## Status: preview deployed; minting and purchase paths BLOCKED by empty deployment env (live-verified); visual sign-off delegated; provider E2E and production promotion remain

Preview: https://auramint-bxuikollm-novamint-networks-projects.vercel.app
Deployment: `dpl_4nidZffQLqgJvWiW6jW4KFaeKtem` (READY, includes all three fixes below). Production was not promoted.
Superseded previews: `dpl_EiDMbZACdnmUuRPBvCRQq1EU5CYu` (auramint-6thwm1klq…, two fixes) and `dpl_HJRXSRcdNYzTqkEySqtutCLSfYiG` (auramint-8dtya8dkz…).

### Bugs found and fixed (all live on the current preview)
1. **Cashfree `ACTIVE` status silenced the pending-payment notice.** `normaliseStatus` in
   `src/app/(app)/premium/premium-client.tsx:24` mapped `"active"` to `"idle"`, so a user returning
   from a created-but-unpaid sandbox order saw no "payment pending" state. Fixed: `active` now maps
   to `"pending"`. Proven by red/green tests (`_audit/premium-status-tests.mjs`): 2 failures against
   the old source, 6/6 after the fix; `tsc --noEmit` clean.
2. **Dashboard horizontal overflow at 390 px.** `(app)/layout.tsx:68` — the flex `<main>` refused to
   shrink below its content width (measured 476 px inside a 390 px viewport). Root cause: flexbox
   `min-width: auto`. Fixed with `min-w-0`; live-verified after deploy: scrollWidth 381, no overflow,
   at 390×844.
3. **Footer links below WCAG 2.5.8 minimum tap-target height.** All 8 footer nav links measured
   17 px tall at mobile width. Fixed in `src/components/layouts/site-footer.tsx` with an
   `[&_a]:min-h-[32px] [&_a]:items-center [&_a]:inline-flex` utility on both nav lists; live-verified
   on the current preview: every footer link now measures 32 px, with zero horizontal overflow.
   (32 px exceeds the 24 px WCAG 2.5.8 AA minimum; 44 px was not forced to avoid visually inflating
   the footer layout — flag for design sign-off.)

### Regression coverage added (all local/simulated — no provider traffic)
- **Webhook route E2E** (`_audit/webhook-route-e2e.mjs`, report in `_audit/webhook-route-e2e-report.md`):
  the real `POST /api/webhooks/cashfree` handler against PGlite with the real migration and real
  supabase-js over an HTTP shim. 8 scenarios green: missing secret → 503 (0 DB calls), bad signature →
  401 (0 DB), oversized body → 413 (0 DB), valid delivery → order PAID + premium + exactly 5 boosts +
  1 ledger row (amount_minor=9900 paise, INR; ₹99) + 2 audit rows, duplicate delivery → 200 "Already processed" with no refill,
  amount mismatch → 200 but fail-closed (no grant), `PAYMENT_FAILED_WEBHOOK` → order FAILED, missing
  service key → 503 (0 DB). Ephemeral secrets generated in memory per run.
- **Payment-return route tests** (`_audit/payment-verify-route-tests.mjs`, report in
  `_audit/payment-verify-route-report.md`): the real `GET /api/payments/verify` handler with real Next 16
  redirects and real `safety.ts`; 8/8 including hostile-token fail-closed and origin-priority rules.
  Mutation-tested: three in-memory source mutations each broke the suite (not vacuous).
- **Status normalisation red/green**: `_audit/premium-status-tests.mjs` extracts the real declaration
  from `premium-client.tsx` via TS AST — it tests the shipped code, not a copy.
- Prior evidence still holds: atomic payment migration 9/9 post-checks, SQL lifecycle suite 12/12,
  cron-handler local e2e 1/1, live-DB purchase probe 10/10 (rolled back), live PostgREST suite 7/7,
  narrow defensive review found no SQL-binding or credential-sourcing violations in its reviewed scope.

### Rendered-DOM audit on the current preview (no pixel judgment implied)
- Desktop 1440×900 and mobile 390×844, pages `/` and `/login`: correct H1s ("Every moment has an
  aura. Get it minted." / "Get your aura minted."), 0 broken images, 0 horizontal overflow on both
  viewports. Desktop header nav links measure 0 px at mobile width by design (hamburger menu takes
  over; the hamburger button itself is 44 px).
- **1430 px full-page capture explained with live measurement**: `window.innerWidth` = 1440 but
  `documentElement.clientWidth` = 1430 — the 10 px vertical scrollbar is excluded from layout width,
  and full-page screenshots render the layout width. No content is omitted by the capture; the
  discrepancy is expected browser behavior, not a defect.

### Live verification on the current preview
- Cron guard re-verified on the NEW deployment: unauthenticated `GET /api/cron/reconcile-payments` →
  401 `{"error":"Unauthorized"}`; with the application bearer secret → 200
  `{"ok":true,"attempted":0,"repaired":0,"failed":0}`. `attempted: 0` is correct: DB shows 0 PAID
  orders and 0 premium_purchases rows after QA cleanup, so there is nothing to reconcile.
- Deployment protection was passed with a fresh Vercel share link; application auth stayed enforced
  on top of it (share-cookie round-trip required for API fetches).
- Leak guard on the deploy: clean. 268 files, ~2 MB payload.

### Pointer / keyboard / mobile QA (scoped checks with limitations)
- **Coin (HeroSpecimen)**: desktop pointer and programmatically dispatched clicks advanced the serial;
  the mobile below-fold click was checked programmatically after harness scrolling failed. This does
  not prove physical mobile tapping. Tab reached the coin and computed styles showed a focus outline.
  Space activation was observed in an earlier run. Enter events reached the button without activating
  it; a plain-HTML control reproduced the failure, suggesting a harness limitation. Native button
  markup supports expected keyboard behavior, but real Enter activation remains unverified.
- **Theme toggle, sign-in flow, hamburger nav, demo assay**: exercised via real UI on desktop and
  mobile viewports. Mobile assay receipt printed fully (description, vibe, +1,500 aura, serial
  #06925587) after allowing for the debounce.
- **Tap targets measured**: coin 118×118, nav items 44×44, buttons ≥44 px tall — all pass.
- **Tab order**: sampled controls were reachable in a logical sequence; computed focus-outline styles were present. Pixel visibility and all-control coverage were not established.
- **Signed-in surfaces tested with throwaway users**: created via admin API, signed in through the real
  UI, measured, then cascade-deleted; final check confirmed zero `qa-coin` users remain.
- **LIMIT — visual appearance is UNJUDGED**: screenshot pixels were not visible to the reviewing
  model, so every finding above is DOM/geometric/behavioral. Typography, icon rendering, color and
  composition still need human eyes (user design sign-off, gate 3 below).

### Deployment configuration — live-verified on the preview (2026-09-18)

Exercised the real signed-in UI with a throwaway account (created via the Supabase Auth Admin API,
deleted afterwards; DB verified 0 users/profiles/orders remain; no payment, no AI spend). Three
independent environment gaps were observed on deployment `dpl_4nidZffQLqgJvWiW6jW4KFaeKtem`:

1. **`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` exist as Vercel variables but are empty at
   runtime.** The rate limiter is deliberately fail-closed in production (`src/lib/rate-limit.ts`),
   so both rate-limited server actions currently deny every request on this deployment:
   - `payment.create_order` (`src/lib/actions/payment-actions.ts:89`): clicking the real "Upgrade to
     Premium" button returned the limiter's "Service temporarily unavailable. Please try again
     shortly." toast; runtime log: `[rate-limit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are
     not configured { scope: 'payment.create_order' }`.
   - `ai.submit_event` (`src/lib/actions/aura-actions.ts:316`): submitting a moment through the real
     dashboard composer returned the same toast; runtime log with `{ scope: 'ai.submit_event' }`.
   Blast radius: the core minting action and the purchase path are non-functional for every signed-in
   user on this deployment. The public homepage demo is unaffected (it does not call the limiter),
   which is why earlier demo-receipt checks passed. No order row was ever written — the limiter
   denies before the order insert.

2. **`CASHFREE_WEBHOOK_SECRET` is not configured.** A junk-signature delivery to the live
   `POST /api/webhooks/cashfree` returned 503 `{"message":"Server misconfigured"}`; runtime log:
   `[Cashfree Webhook] CRITICAL: CASHFREE_WEBHOOK_SECRET not configured`. No webhook delivery can be
   verified on this deployment.

3. **`CASHFREE_CLIENT_ID` / `CASHFREE_CLIENT_SECRET` are not configured.** Probing the real
   `GET /api/payments/verify` route while signed in (with a temporary PENDING order row for the
   throwaway user, deleted after) produced runtime log
   `[verifyPayment] Cashfree credentials are not configured` — the request passed auth, ownership and
   the order lookup, then stopped at the credentials check.

Additional observation: `NEXT_PUBLIC_APP_URL` on the preview deployment resolves to the production
domain — the verify route's redirect sent the browser to `https://auramint.novamintnetworks.in/...`
from the preview host. Order `return_url`/`notify_url` will therefore also point at production when
orders are created from a preview build.

The fail-closed limiter is deliberate design, not a defect; no code was changed. These are deployment
configuration gaps only the operator can fill.

### Corrections to earlier handoffs
CRON_SECRET is integration-managed via Vercel's documented PATCH endpoint and works on the current
preview (401/200 above); no user action needed for it. Bulk Vercel variable listings return encrypted
envelopes for every variable. Live runtime checks on 2026-09-18 established the actual state:
CRON_SECRET and the Supabase keys work, while the three Cashfree variables and both Upstash variables
are empty at runtime (see the deployment-configuration section above). No successful provider
authentication or payment is established.

### Remaining gates
1. **Deployment environment — five variables, all operator-supplied**: `CASHFREE_CLIENT_ID`,
   `CASHFREE_CLIENT_SECRET`, `CASHFREE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN` in the Vercel project environment (or an authorized secret store).
   Do not send secrets in chat. Adding only the Cashfree trio is NOT sufficient: the fail-closed rate
   limiter denies before credentials are read until Upstash is configured, so minting and purchases
   stay dead. Keep sandbox and production credentials separate. Confirm the webhook signing
   credential against Cashfree's current documentation.
2. **Sandbox checkout E2E**: run a real sandbox purchase through the UI; verify the provider webhook
   event and the resulting server-side ledger grant independently of the return page. Expected result:
   PAID order, exactly one matching premium_purchases row, premium enabled, +5 boosts; a replayed
   webhook must not refill. Note the return/notify URLs point at the production domain
   (`NEXT_PUBLIC_APP_URL`), not the preview host.
3. **Visual/design sign-off**: review the preview's typography, icons, and layout by eye (desktop +
   mobile) and approve the redesign. Technical QA is done; appearance judgment is not. The operator
   has delegated this to a separate image-capable review; findings must be recorded by filename in
   `_audit/visual-qa/appearance-review-status.md` (all five captures currently UNREVIEWED — every
   in-session image read, including the judge reviewer, was omitted for lack of image input).
4. **Production promotion**: promote the tested source only after gates 1–3, then repeat smoke checks
   (cron guard, webhook signature rejection, homepage/dashboard render, and a real minting round-trip
   once Upstash is configured). A redeploy of the old Git revision would not include these
   uncommitted fixes.

No commits or pushes were made. Provider payment testing and production readiness remain incomplete.
