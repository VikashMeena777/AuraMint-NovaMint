# Round 2 — motion, analytics and remaining application gaps

## Implemented

- 33 first-party animated SVG marks with individual moving/drawing parts, wired through AnimatedIcon and MintIcon into the landing page, header, sidebar, bottom navigation and assay demo. Other icons retain whole-glyph feedback. Not a new paid library retrieval.
- Dimensional landing coin press with finite coin compression, impact ring, changing specimen serial, receipt re-strike, visible Struck stamp and live announcement. Coin button has an explicit accessible name.
- Below-fold staggered section entrances with visible-by-default server HTML and reduced-motion CSS/JS guards. No cursor follower, shimmer overlay or indefinite decorative spin.
- Analytics converted to Mint plates and semantic colours, larger labels, shared aura numbers, keyboard-focusable chart days and a text table alternative. Zero chart days now use neutral colour.
- Rate limits for AI submissions and checkout creation via dependency-free Upstash REST/Lua. Production fails closed on unavailable configuration/provider. This is a NEW runtime dependency: production submissions/checkouts will be denied unless UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are configured and functional. Upstash was not exercised live.
- Feed query now returns reaction aggregates, author premium and viewer vote/reaction; query errors no longer always masquerade as an empty feed. Main pass connected viewer values to initial card state and added rendered regression tests.
- Paid-order retry/revisit now attempts to repair missing premium entitlements. This is application recovery, NOT an atomic payment transaction or a scheduled reconciler.

## Final local verification

- `npx eslint src`: passed without diagnostics.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed after final coin-label and feed-state fixes; `_audit/round2-final-build.log`.
- Combined five suites: **76 tests passed, 0 failed**; `_audit/round2-tests.log`.
  - Original/expanded backend: 43.
  - Rate limiter, feed aggregation, payment recovery: 16.
  - Aura number signs: 6.
  - Motion component SSR: 8.
  - Feed-card initial selected state: 3.
- Exact requested `node _audit/motion-tests.mjs`: 8 passed.
- Test warnings: Node typeless-package warning from the standalone TypeScript loader; motion test image stub forwards `priority` to a plain img. The production Next Image priority prop is valid. Neither warning failed a test.

## Launch-blocker code fixes (post-hardening round 3)

- **Analytics zero-point semantics FIXED**: all three `points >= 0` win expressions in `getAnalyticsData` (daily-trend gain bucket, category wins, headline wins filter) now require a strictly positive strike; zero-point events are neutral. `winRate` now divides by scored outcomes (wins + losses) instead of all events, so neutral strikes no longer dilute the rate. The page's `hasScored` gating already matched this semantics.
- **markOrderFailed affected-row check FIXED**: returns `{ ok, updated }`; `updated: false` distinguishes "order missing / already PAID or FAILED" from a real transition. Webhook dep types still accept the narrower shape, so no caller changes were needed.
- **Plan-currency pin FIXED**: `verifyProviderAmountAndCurrency` now refuses a matched pair of non-`PLAN_CURRENCY` currencies (`plan_currency_mismatch`, logged as `payment.currency_mismatch`, message "Currency not supported"). A wrong-product order that agrees on e.g. USD on both sides can no longer verify itself.
- New regressions cover all three (unit + wiring guards). Combined suites: **103 tests, 0 failed** (`_audit/round2-tests.log`); `tsc --noEmit` clean; eslint clean on changed files; production build clean (`_audit/round2-final-build.log`).

## Payment final hardening (post-status addendum)

- New `src/lib/actions/payment-verification.ts` — shared fail-closed amount/currency decisions; both the webhook and `verifyPayment` now refuse null/zero/malformed amounts and missing currencies instead of skipping the comparison (audit rows written, no claim/grant). `_audit/payment-final-hardening.md` documents residual non-atomic claim+grant, markOrderFailed row-count gap, session-client entitlement writes and plan-currency pinning as remaining launch work.
- `grantPremiumEntitlements` now requires ≥1 affected row via `.select("id")`; zero rows returns failure instead of silent `ok:true`.
- Combined suites after this pass: **98 tests, 0 failed** (`_audit/round2-tests.log`); `tsc --noEmit` clean; final production build clean (`_audit/round2-final-build.log`).

## Browser evidence / limits (updated)

Fresh production preview is running at http://localhost:3459 (server reports Ready). Do not use the earlier port 3457 preview to judge this round.

Browser attachment succeeded after the earlier "webview not ready" failures (those were environment, not code). Evidence collected on the live page:

- **Coin handler verified by direct DOM activation** on the hydrated page: `el.click()` on the real button produced `struck 1×`, serial advanced #0048213 → #0048214, and the polite live region read "Specimen re-struck. Serial #0048214." This proves the React handler, serial rotation, receipt state and announcement wiring work at runtime — stronger than the SSR tests, weaker than a full frame-by-frame animation check.
- **Real trusted-input activation was NOT achieved**: locator `click()` timed out twice, and bridge `press('Space')`/`press('Enter')` move focus (verified via `document.activeElement`) but never fire the browser's default button activation; `cua.click` at measured coordinates also produced no state change. This is an IAB input-bridge limitation observed against a target that was proven unique/visible/enabled/in-view and not covered by any other element — do not read it as a component defect. Keyboard and pointer acceptance therefore remain UNVERIFIED for a real user; a human should press the coin once and confirm the serial changes.
- **Desktop layout (1280×800, dark theme active)**: no horizontal overflow (scrollWidth ≤ innerWidth), zero elements wider than the viewport, coin image loaded (`naturalWidth > 0`), 45 animated SVG marks present, 3 reduced-motion media blocks in the delivered CSS.
- **Mobile layout (390×844)**: no horizontal overflow, no off-viewport elements, coin press renders 120×120 (≥40px tap target), h1 wraps at 40px font size, 3 navs present as designed.
- **Visual pixel judgement was not possible in this session**: screenshots were captured (artifact PNG exists) but the session model cannot view images, and no judge pass ran. Layout claims above are programmatic geometry/computed-style facts, not aesthetic acceptance.

SSR tests exercise real rendering and accessible markup, not real click dispatch. Static inspection shows onClick routes through the press callback to increment presses, rotate deterministic serials, animate coin/ring, remount the receipt and update its live announcement; this is source wiring evidence, NOT proof that runtime animation succeeds. No mocked test is described as an end-to-end interaction test.

## Remaining release blockers

- Verified live schema and database transaction for aura totals, free daily limits, vote counters and case-insensitive username uniqueness.
- Atomic order claim plus entitlement grant, purchase-linked entitlement history and a scheduled reconciler. Current repair checks a profile-wide premium boolean; it cannot distinguish previously expired/revoked premium from a missing grant. Concurrent repair can still reset boosts after intervening consumption. Do not call the recovery fully idempotent or production-approved.
- Verify entitlement write permissions/RLS; verifyPayment still uses a session client for entitlement updates. Amount/currency fail-closed validation, grant affected-row checks, `markOrderFailed` row counts, plan-currency pinning and analytics zero-point semantics are ALL FIXED (see payment final hardening and round-3 sections above); the remaining gap in this line is the non-atomic claim+grant.
- Analytics zero-point win semantics: FIXED (round 3) — the backend now matches the neutral chart rendering.
- Live Upstash configuration and permitted reaction/vote read policies must be checked without assuming successful mocked tests prove deployment integration.
- Analytics zero-point win semantics: FIXED (round 3).
- Subscription duration/cancellation/international-price copy versus actual provider entitlement model needs verification.
- Authenticated UI journeys, production provider integrations, mobile responsiveness and visual acceptance remain incomplete.

No commits, pushes, production database mutations, emails, payments or deployments were performed. Earlier assistant comments about a commit and an exact command request were mistaken; the user did not authorize a commit. Working-tree changes are retained locally.
