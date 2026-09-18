# App / Aura components / Sound — implementation plan

**Owner scope:** `src/app/(app)/**` (all files except `analytics/page.tsx`), `src/components/aura/**`,
`src/lib/utils/sound.ts`, plus the new public `src/app/event/[id]/**` route (explicitly authorised by
the coordinator). **Not touched:** `src/lib/**` other than `sound.ts` (`formatAuraPoints` stays as
backend/shell own it), `src/app/globals.css`, `src/app/layout.tsx` (fonts), `src/components/layouts/**`
(shell), `analytics/page.tsx` (main), any `package*.json`.

Docs read first (AGENTS.md requirement, from `node_modules/next/dist/docs`):
`01-getting-started/10-error-handling.md`, `13-fonts.md`, `03-api-reference/03-file-conventions/{error,loading,route-groups}.md`.
Key Next 16 finding: **the App Router error boundary prop is `unstable_retry`, not `reset`.** Route groups
`(app)` do not add a URL segment, so `/event/[id]` must live outside `(app)` to stay public.

## Design direction applied ("The Mint")

Tokens as literal hex in `components/aura/mint.ts` (globals.css is not mine, so I do not depend on it):
patina `#1F6F5C` (primary/positive), brass `#C9A227` (prestige/premium/legendary only), oxide `#B4442E`
(loss), lead `#7A7F87` (neutral), engraving blue `#1B3A5C` (rare fills). Neutrals stay semantic
(`bg-card`, `text-foreground`, `border-border`) so light=paper/dark=oxide repaints follow the shell's
`globals.css` change. No purple, no orbs, no infinite float/pulse/bounce, no gradient text on numbers.
Type: `font-display` (Instrument Serif once main swaps `--font-display`), `font-mono tabular-nums` for
all figures, micro-labels uppercase 11px. Every card is a solid plate + 3px polarity rail + hallmark.

## Fix list (all from `_audit/ui-research.md`, scoped subset)

P0 — share 404: new public `/event/[id]` server route (private-safe: `is_public = true` only) +
origin-derived share URL/QR. Feed page-0 duplicate: request-sequence guard, correct page advance,
`Set` dedupe by id, derived loading, honest error state, IntersectionObserver sentinel. Double sign /
`grad-text` on numbers: one `AuraNumber` component owns sign+colour+tabular figures; delete 11 hand-rolled
signs. Dead mobile Log: mount `SubmitEventModal` once in `(app)/layout.tsx`, listen to both
`open-submit-modal` and `open-aura-log-modal`, announce minting via a window event for refetch.

P1 — `(app)/layout`: remove the render-time `current_tier = "NPC"` mutation, derive tier from
`total_aura`. `html2canvas` → `html-to-image` + `document.fonts.ready`. All three modals → one
`MintDialog` (Radix: `role=dialog`, `aria-modal`, Escape, focus trap/return, scroll lock). Premium:
real `is_premium` for `AdBanner` and `/premium` (certificate + manage state), real daily limit from
`getUserPlanLimits()`, `?status` normalised (`success|failed|pending|cancelled`). Origin-derived share
host. Icon-only controls get `aria-label`; tabs get tablist semantics; labels get `htmlFor`.

P2 — `Math.random` in render removed everywhere (celebration particles generated in an effect from a
seeded PRNG; reduced-motion = single static stamp). Profile chart: pure `reduce`, day-bucketed, sorted;
stats sourced from the 30-day history so labels are honest. Leaderboard rows link to profiles with a
Duel CTA + period/lifetime labels. Wrapped: real share/QR (html-to-image) + empty state. Badges: no
hang on missing user, error/empty states, one deterministic `BadgeStamp` system. Onboarding: lowercase
enforced, debounced availability, error handling. `any` removed from scoped files. Sound: persisted
mute + gains re-voiced, never throws.

## Verification

`npx tsc --noEmit`, `npx eslint <scoped paths>` (must be clean, not suppressed), plus a scoped
production build only if no other agent is building. No live mutations/payments/emails, no browser.
Deliverable: `_audit/app-report.md` with per-file review, before/after bug table and test evidence.
