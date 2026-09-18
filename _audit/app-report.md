# App / Aura components / Sound — implementation report

**Agent scope:** `src/app/(app)/**` (all files except `analytics/page.tsx`, owned by main), `src/components/aura/**`,
`src/lib/utils/sound.ts`, plus the new public `src/app/event/[id]/page.tsx` (authorised by the coordinator).
**Not touched:** `src/lib/**` other than `sound.ts`, `src/app/globals.css`, `src/app/layout.tsx`,
`src/components/layouts/**`, `src/components/ui/**`, `src/app/(app)/analytics/page.tsx`, any `package*.json`,
SQL. `_audit/app-plan.md` was written before any code change.

## 1. Verification (evidence)

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **clean** (0 errors, whole repo) |
| Lint (scoped) | `npx eslint src/components/aura src/lib/utils/sound.ts src/app/event "src/app/(app)" --ignore-pattern "src/app/(app)/analytics/**"` | **0 errors, 0 warnings** |
| Build | `npm run build` (Next 16.3.5, Turbopack) | **EXIT=0**, 22 routes, `/event/[id]` present |
| Grep audit | no `html2canvas`, no `Math.random`, no `purple/violet` classes, no `glass`/`cosmic`/`animate-float`/`grad-text`/`aura-orb` usage in scope; no `formatAuraPoints` call sites left (all figures go through `AuraNumber`) | as stated |

Not run (per instructions): no browser, no live mutations, no payments, no email sends, no git.
Runtime flows are main's browser pass — §7 lists exactly what to smoke test.

## 2. Per-file review

### 2.1 New shared foundations (`src/components/aura/`)

| File | Purpose / notes |
|---|---|
| `mint.ts` | Mint palette (`patina #1F6F5C`, `brass #C9A227`, `oxide #B4442E`, `lead`, `engrave`), `TONE` class strings, `formatSignedAura` / `formatAuraBalance` (en-IN grouping — the only place a `+` is added), `tierName`, `CATEGORY_META`, `REACTIONS`, origin-derived share URLs, seeded PRNG, `initialOf`. |
| `types.ts` | View-model types for feed/leaderboard/profile/interactions — replaces the `any` layer in every scoped file. |
| `aura-number.tsx` | **Adapter** over shell's `src/components/ui/aura-number.tsx`: adds the mount "Roll" (seed 0 → rAF → real value; snaps under reduced motion), size mapping, balance mode, colour override. One number implementation for landing + app. |
| `tier-mark.tsx` | **Adapter** over shell's `src/components/ui/tier-mark.tsx` (`.hallmark` frame + shared tier→icon map) plus `TierPill`. Removed my duplicate tier→icon/tone map. |
| `badge-stamp.tsx` | Badge marks on the same `.hallmark` frame; deterministic Lucide icon per badge id (16/16 mapped, no emoji/Lucide hybrid); rarity→shared tone; locked = lead frame + padlock. |
| `primitives.tsx` | Aura-surface composition: `Plate` (solid plate + 3px polarity rail), `Chip`, `SectionLabel`, `EmptyState`, `SkeletonPlate`, `IconButton` (label required), `PrimaryButton`, `Switch`, `EmojiMark` (content-only emoji, `role="img"`). No `.glass` dependency. |
| `mint-dialog.tsx` | Modal built on shell's `src/components/ui/dialog.tsx` (Radix): `role=dialog`, `aria-modal`, Escape, focus trap + return, scroll lock, aria-labelledby/describedby contract. Replaced three hand-rolled overlays. |
| `hooks.ts` | `useViewer` (id/username/real `is_premium`), `usePlanLimits` (real server quota, `Infinity` normalised to `null` = unlimited), `useDailyReport` (error path). |
| `sound-toggle.tsx` | Persisted mute UI via `useSyncExternalStore` (no hydration flash); row + icon variants. |
| `celebration-effect.tsx` | Seeded particle fields, generated in a frame callback (no `Math.random` in render → no hydration mismatch); static single-stamp frame under reduced motion. |

### 2.2 Reworked aura components

| File | Key changes |
|---|---|
| `aura-event-card.tsx` | Solid plate + polarity rail (glow only for \|points\|≥5000); author is a `Link` with tier hallmark; description clamped with Read more; reactions/votes with in-flight guards, `aria-pressed` + counts in the label, try/catch + toasts; boost guarded and error-surfaced; share uses `navigator.share` → clipboard fallback, AbortError ignored; `AuraNumber` (no double sign, no `grad-text`); `isPremium` is the real flag (the old `isPremium: isOwner` hack removed). |
| `submit-event-modal.tsx` | Now mounted **once** in `(app)/layout.tsx`; listens to both `open-submit-modal` and the legacy `open-aura-log-modal`. Real quota strip from `usePlanLimits` (submit blocked at limit + upgrade link); labelled textarea/fieldset; aria-pressed categories; guarded submit (try/catch/finally, double-click safe); deferred reset timer cleared on reopen (stale-state bug); reveal choreography now ≤1.4 s with `AuraNumber` roll and seeded celebration; announces `auramint:event-minted` for refetch; links to the new public record. |
| `share-card-modal.tsx` | `html-to-image` `toPng` (pixelRatio 3, `cacheBust`, explicit `#0B0E0C` background) after `document.fonts.ready` — the oklch bug is gone; card body uses inline sRGB values only; origin-derived `/event/{id}` URL + QR; deterministic serial; dialog a11y; double-click guarded; real premium treatment. |
| `daily-report-card.tsx` | Error state (the old `.then()` had no rejection path and hung invisible), empty "Nothing minted today" state with a Log CTA, signed net via `AuraNumber`, biggest W/L as stamped cells, no double signs, solid plate. |
| `ad-banner.tsx` | Premium gate now real (prop or `getUserPlanLimits`), persisted dismissal (12 h) via `useSyncExternalStore`, `next/link`, labelled dismiss control. |
| `premium-icon.tsx` | **Kept** (analytics/page.tsx still imports it — main's file). Fixed the fallback-size bug (unmapped emoji now sized from the requested box height, `role="img"`), removed `animate-bounce`, expanded the map, re-based colours on Mint. |
| `sound.ts` | Persisted mute (`isSoundMuted`/`setSoundMuted`/`toggleSoundMuted`/`subscribeSoundMuted`), typed `webkitAudioContext`, `resume()` rejection swallowed, every sound wrapped so Web Audio can never throw an unhandled rejection, re-voiced gains (struck-brass ping / thud). Public function names unchanged for shell call sites. |

### 2.3 App routes

| File | Key changes |
|---|---|
| `(app)/layout.tsx` | Removed the render-time `current_tier = "NPC"` **DB write**; tier is derived from `total_aura` via `getTierForAura` before being handed to the sidebar (one source of truth, no mutation on GET). Mounted the single global `SubmitEventModal`. Added `id="content"` for the shell's skip link. Opaque `bg-background` canvas + one brass hairline (masks the legacy root-layout orbs). `dynamic` moved below imports. |
| `(app)/loading.tsx`, `(app)/error.tsx` | New route-group skeletons and an error boundary using Next 16's **`unstable_retry`** (not `reset`) with a digest reference and a safe "back to feed" path. |
| `dashboard/dashboard-client.tsx` | Feed rewrite: request-sequence guard (tab race), correct page advance (`page+1`), de-dupe by id, derived loading, honest error state (initial vs inline retry), IntersectionObserver sentinel with a manual fallback button, "end of ledger" terminator; real tablist semantics + arrow keys; viewer id drives `isOwner`; real premium drives the ad plate; listens for `auramint:event-minted`; handles legacy `?action=log`. Page adds metadata. |
| `leaderboard/*` | Server page (metadata) + client. Error + empty states per period, stale-response guard, rows are profile links with tier hallmark/streak/premium, period-vs-lifetime labels, Duel CTA when the viewer differs, `AuraNumber` balances. |
| `badges/*` | Server page (metadata) + client. The "hangs forever when logged out" bug is fixed (`finally` clears loading, no-user shows a real state); error + empty states; `aria` progressbar; one `BadgeStamp` system; purple rarity classes gone. |
| `premium/*` | Server wrapper (metadata + Suspense around `useSearchParams`) + client. Real `is_premium` (certificate state instead of an always-on upgrade button), `?status` normalised to `success|failed|pending|cancelled` with matching toasts, guarded checkout, free quota copy now imported from `FREE_DAILY_EVENT_LIMIT` (enforcement constant) — the "3/day vs 5/day" drift is gone. |
| `onboarding/*` | Server page (metadata) + client. Lowercase enforced, debounced availability check with ✔/✖ and error state (derived, no effect-setState), guarded claim, error handling; solid plate steps; `/profile` routes generated handles here so it is reachable. |
| `wrapped/*` | Server page (metadata) + client. Empty state when nothing was minted in 30 days (was a fabricated `+0` recap), error state, real share/QR implemented with `html-to-image` (the previously dead imports `Share2/Trophy/playPremiumUpgradeSound/QRCodeSVG` now do something), pure monthly aggregation typed without `any`, no purple. |
| `vs/[user1]/[user2]/*` | Server page with `generateMetadata` + client. Unused imports gone, real error/loading, `Promise.all` fetch, minted duel docket with hallmarks, delta ruling (removed the stray hardcoded "Rahul, E5 to C4" line), share via `navigator.share`→clipboard, precomputed share strings. |
| `profile/page.tsx` | Redirects a generated `user_*` handle to `/onboarding`. |
| `profile/[username]/page.tsx` | `generateMetadata`; typed narrowing instead of `result.profile` on a union; passes viewer ownership. |
| `profile/[username]/profile-client.tsx` | Chart is a **pure, day-bucketed, sorted cumulative** series (the render-time `let cumulative` mutation is gone); stats sourced from the 30-day history so labels are honest ("Events · 30d", biggest W/L at 0-floor/0-ceiling — no more `+-500`); `AuraNumber`/`TierMark`; notch-bar tier progress; edit modal is a real dialog with reset-on-open inputs, htmlFor labels, `<strong>` instead of literal `**`; Share profile; own-account rows (sound mute, badges, premium, wrapped) so mobile has a Me surface; `isOwner` + real premium passed to cards. |
| `event/[id]/page.tsx` | **New public route** — the destination every share card and QR code targets. Privacy-safe: id validated, query filtered `is_public = true`, whitelisted columns only (private/draft ⇒ 404), no session required. `generateMetadata` gives WhatsApp/X a real title/description. Server-rendered minted note with CTA. |

## 3. Bugs closed (from `_audit/ui-research.md`, scoped subset)

**P0** — ① every share/QR → 404: route created + URL/QR now origin-derived. ② dead mobile Log & undiscoverable pages: one global log sheet mounted in the app shell (shell dispatches `open-submit-modal`), palette deep link honoured, preview→onboarding path added, Wrapped/Badges/Premium/Sound reachable from the profile Me row. ③ aura figures: single `AuraNumber` owns sign/colour/figures; 11 call sites of hand-rolled signs removed, `grad-text` off numbers, K/M replaced by en-IN grouping. ④ feed "Load more" duplicated page 0 → page advance + de-dupe + race guard + honest error/loading.

**P1** — layout no longer writes NPC; `html2canvas`→`html-to-image`; all modals are Radix dialogs (Escape/focus trap/scroll lock/aria); premium respected (ads, certificate, watermark); `?status` normalised; share host origin-derived; icon-only controls labelled; tabs are tablists/labels are labels.

**P2** — `Math.random` gone (seeded, effect-generated particles; static frame under reduced motion); profile chart purity; profile stat labels; leaderboard rows link + Duel + period/lifetime; Wrapped empty state + real sharing; badges hang/empty/error; onboarding lowercase + availability; sound persisted mute; description clamping; `any` removed from all scoped files.

## 4. Design system ("The Mint") application

Patina = brand/positive, brass = prestige/premium/legendary only, oxide = loss, lead = neutral, engraving blue = rare fill. No violet, no gradient text, no orbs, no infinite float/pulse/bounce, one glow per screen (≥5000 only), polarity carried by a 3px rail + sign + colour (greyscale-readable). Typography rides shell's `--font-display` (Instrument Serif) / `--font-sans` (Instrument Sans) / JetBrains Mono for every figure; micro-labels are 11 px uppercase. Tiers and badges reuse shell's `.hallmark` frame. Cards are opaque plates on the semantic `--card`/`--border` tokens so the shell's paper/ink repaint flows through.

## 5. Cross-agent consolidation

- **Adopted shell primitives:** `src/components/ui/dialog.tsx` (all modals), `src/components/ui/aura-number.tsx` (all figures), `src/components/ui/tier-mark.tsx` (all tier marks). My `components/aura/{aura-number,tier-mark}.tsx` are now thin, documented adapters — if shell's API moves, only those two files change.
- **Deliberately kept:** `components/aura/primitives.tsx` (aura-surface composition layer: rail plates, chips, states, labelled icon buttons — composes markup, not a second design language) and the literal Mint hexes in `mint.ts` (the share plate feeds these into `html-to-image` **and** uses `${hex}66` alpha suffixes, so they must stay literal sRGB; they mirror the globals tokens one-for-one).
- **`premium-icon.tsx`** is retained only because `analytics/page.tsx` (main) imports it; its sizing bug is fixed. Delete it once analytics moves to `EmojiMark`/`TierMark`.
- **No conflict:** analytics untouched; no `package*.json`, globals, layouts or `lib/**` edits.

## 6. Backend contract requests (coordinate via main)

1. `getPublicFeed` — add `profiles.is_premium` and the viewer's own reaction/vote per row (research P2-14); return `{ error }` on failure so the feed can distinguish "empty" from "couldn't load" (today an error silently becomes an empty feed).
2. `getLeaderboard` — a viewer-relative rank/gap (PRD §6.6); the page currently shows the top 50 only.
3. `getUserProfile` — backend H1 (auth + explicit public column list) is still pending; my page renders only whitelisted fields, and `/event/[id]` selects only public columns itself.
4. FK name `aura_events_user_id_fkey` is assumed by the new event page (same assumption as `getPublicFeed`).

## 7. Browser smoke list for main

1. `/dashboard`: Hot/Fresh/Top switch, Load more appends without duplicates, deep-link `?action=log` opens the sheet, empty ledger CTA.
2. Mobile: bottom-nav Log from `/leaderboard` and `/wrapped`; Escape/backdrop/tab-trap on the sheet and share modal; `/profile` Me row (sound mute persists after reload).
3. Reveal: submit → roll-up + seeded celebration only at ±5000; reopen the sheet immediately (no stale reveal).
4. Share card: Save card PNG keeps patina/oxide colours (the old oklch failure); QR resolves to `/event/{id}` on a private event ⇒ 404, public ⇒ record page.
5. `/premium`: free state shows `5 / day` (from `FREE_DAILY_EVENT_LIMIT`), premium state shows the certificate (no upgrade button), `?status=failed` toasts the failure.
6. `/leaderboard` row → profile, Duel CTA → duel docket; `/wrapped` with zero events shows the empty state.
7. Reduced motion on: celebration static, no floating/pulsing elements, figures snap.

## 8. Known follow-ups (out of my scope / not done)

- Sound still fires on navigation from shell-owned call sites (`bottom-nav`, `command-palette`, `sidebar`); mute is now respected, but a nav-only mute rule is a shell decision.
- `primitives.tsx` vs `ui/card|button` overlap (see §5) — recommend main/design pick one owner in a later pass.
- Premium cancellation is provider-side only; no in-app manage/cancel action exists to wire.
- `Activity`-style aura decay/streak semantics remain a product decision (the layout no longer invents them).
