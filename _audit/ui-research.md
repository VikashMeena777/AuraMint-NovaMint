# AuraMint — UI Research & Correctness Audit

**Scope:** `auramint/src/app/**` (pages + layouts) and `auramint/src/components/**` (all UI components), plus the UI-facing shared libs (`lib/utils*`, `lib/ai/prompts.ts` constants, `lib/badges.ts` presentation constants, action **signatures/shapes only**) needed to validate render-time assumptions.
**Excluded (owned by other agents):** `src/app/api/**`, `src/app/auth/callback/**`, `src/lib/supabase/**` internals, `src/lib/actions/**` business logic, `src/lib/ai/**` engine, `src/lib/email/**`.
**Method:** full read of every UI file (no excerpts), static cross-referencing against the action return shapes, CSS/design-token inspection, and `npx eslint src` for objective React/TS findings. No browser was used; no app file was modified.
**Baseline (reported by coordinator, reproduced on UI paths):** `npm run build` passes; `npm run lint` = **106 errors / 20 warnings** repo-wide (UI-only subset detailed in §8).

---

## 1. Product purpose (from docs/PRD.md, verified against implementation)

AuraTracker/AuraMint is a **viral-first Gen-Z social game**: (a) log a real-life moment in ≤280 chars, (b) an LLM returns dramatic aura points (−10,000…+10,000) + a savage Hinglish verdict + vibe tag + emoji, (c) the scored moment is auto-posted to a public feed with emoji reactions and W/L votes, (d) everyone competes on Global/Daily/Weekly leaderboards through a tier ladder (NPC → GOD MODE), streaks, badges and premium monetisation (₹99/mo via Cashfree), and (e) **every surface is designed to be screenshotted and shared** (share cards, QR, Wrapped, 1v1 duels).

The PRD's own words: *"part life journal, part social game, part meme generator"*; monetisation is premium + AdSense; primary market India/Hinglish Gen-Z (`docs/PRD.md` §1–7, §11).

**Purpose-critical loop → what the code actually delivers:**

| Loop step | Implemented? | Notes |
|---|---|---|
| Log moment + AI score + reveal | Yes, strong | `submit-event-modal.tsx`, full reveal choreography |
| Auto-post to public feed | Yes | `submitAuraEvent({isPublic:true})` hard-coded in the modal |
| Reactions + votes | Yes | `aura-event-card.tsx` |
| Leaderboards | Yes (global/daily/weekly) | no "friends", no "your rank" |
| Streaks + badges | Yes (stored / computed client-side) | badge definitions are client-only |
| Share card | Yes, but **share links 404** | §4 P0-1 |
| Wrapped / Duel / Analytics | Yes but **undiscoverable** | §4 P0-2, §5 |
| Onboarding | Exists but **unreachable after signup** | §4 P0-3 |

**Conclusion: the product spine is built. What is broken is the *shell around* the spine — routing/discovery, the numeric sign layer, colour semantics, accessibility, and mobile parity. The single highest-value work is not new features; it is (1) fixing the share/reveal credibility bugs, (2) making every built page reachable, (3) replacing the generic cosmic-purple skin with a distinct identity.**

---

## 2. Page inventory

Routes are grouped by Next.js route group. "Gate" = what actually protects it.

| Route | File | Type | Gate | Primary job | States present |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | client (marketing) | public | convert + interactive AI demo | demo idle/loading/success; **no error state** |
| `/login` | `src/app/(auth)/login/page.tsx` | client | redirects if logged in | email+Google sign-in | loading; no inline error |
| `/signup` | `src/app/(auth)/signup/page.tsx` | client | redirects if logged in | account create | loading; no inline error |
| `(auth) layout` | `src/app/(auth)/layout.tsx` | client | — | centred card + starfield | — |
| `/dashboard` (Feed) | `src/app/(app)/dashboard/{page,dashboard-client}.tsx` | client | layout + middleware | feed tabs, daily report, log CTA | skeleton, empty, load-more |
| `/leaderboard` | `.../leaderboard/page.tsx` | client | layout | daily/weekly/all-time ranks | skeleton, 3 empty variants |
| `/analytics` | `.../analytics/page.tsx` | client | **layout only** | 30-day trend, categories, vibes, highlights | skeleton, "no data", "unable to load" |
| `/badges` | `.../badges/page.tsx` | client | **layout only** | earned/locked badge grid | skeleton (can hang), no empty state |
| `/profile` | `.../profile/page.tsx` | server | layout + middleware | redirect to `/profile/{username}` | — |
| `/profile/[username]` | `.../profile/[username]/{page,profile-client}.tsx` | server+client | layout | public profile, chart, edit modal | empty events, `notFound()` |
| `/premium` | `.../premium/page.tsx` | client | layout | pricing + Cashfree checkout | success/failed query banners |
| `/wrapped` | `.../wrapped/page.tsx` | client | **layout only** | 5-slide monthly recap | loading + fabricated fallbacks |
| `/vs/[user1]/[user2]` | `.../vs/[user1]/[user2]/page.tsx` | client | **layout only** | 1v1 aura duel + share text | loading, error |
| `/onboarding` | `.../onboarding/page.tsx` | client | layout | 3-step setup | 3 steps, no availability check |
| `/event/[id]` | **MISSING** | — | — | share/QR target | **404 — referenced by 2 files** |
| shell | `src/app/(app)/layout.tsx` | server | redirects to `/login` | sidebar/bottom nav, tier demotion write | — |
| nav | `src/components/layouts/{sidebar,bottom-nav,command-palette}.tsx` | client | — | 6 / 5 / 9 destinations | — |

**Untracked UI components:** `aura/{aura-event-card, submit-event-modal, share-card-modal, daily-report-card, ad-banner, celebration-effect, premium-icon}.tsx`, `providers/theme-provider.tsx`.

**Missing route-level files (no error boundary anywhere):** no `not-found.tsx`, no `error.tsx`/`global-error.tsx`, no `loading.tsx`, no `manifest.webmanifest`/`robots.ts`/`sitemap.ts`, no per-page `metadata`, no `opengraph-image`. The PRD claims "PWA-ready" (`PRD.md` §header, §13) but nothing PWA exists. `public/` still contains the untouched `create-next-app` SVGs (`file/globe/next/vercel/window.svg`).

---

## 3. What was reviewed (complete file list)

**App (21 files)**
`src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`,
`src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`,
`src/app/(app)/layout.tsx`, `.../dashboard/page.tsx`, `.../dashboard/dashboard-client.tsx`,
`.../leaderboard/page.tsx`, `.../analytics/page.tsx`, `.../badges/page.tsx`,
`.../profile/page.tsx`, `.../profile/[username]/page.tsx`, `.../profile/[username]/profile-client.tsx`,
`.../premium/page.tsx`, `.../wrapped/page.tsx`, `.../onboarding/page.tsx`,
`.../vs/[user1]/[user2]/page.tsx`, `src/middleware.ts`.

**Components (11 files)**
`components/aura/aura-event-card.tsx`, `submit-event-modal.tsx`, `share-card-modal.tsx`, `daily-report-card.tsx`, `ad-banner.tsx`, `celebration-effect.tsx`, `premium-icon.tsx`;
`components/layouts/sidebar.tsx`, `bottom-nav.tsx`, `command-palette.tsx`; `components/providers/theme-provider.tsx`.

**Supporting (read for correctness cross-checks only)**
`lib/utils.ts`, `lib/utils/sound.ts`, `lib/ai/prompts.ts` (AURA_TIERS/CATEGORIES/tier helpers), `lib/badges.ts` (BADGES/RARITY_*), `lib/actions/aura-actions.ts` (signatures + return shapes: `getPublicFeed`, `getLeaderboard`, `getUserProfile`, `getAnalyticsData`, `boostEvent`, `updateProfile`), `lib/actions/daily-report.ts` (type), `lib/supabase/middleware.ts` (route gating list), `package.json`, `tsconfig.json`, `next.config.ts`, `docs/PRD.md`, `docs/ROADMAP.md`.

---

## 4. Bug register — P0 (breaks the product promise)

### P0-1 · Every shared aura card links to a 404 route
- **Evidence:** `src/components/aura/aura-event-card.tsx:104` → `const url = \`${window.location.origin}/event/${event.id}\``; `src/components/aura/share-card-modal.tsx:200` → `value={data.event_id ? \`https://auramint.novamintnetworks.in/event/${data.event_id}\` : "https://auramint.novamintnetworks.in"}`.
- **Reality:** there is no `src/app/**/event/[id]` route (verified via full `src/app` listing). The QR code rasterised into every downloaded share card also points there.
- **Impact:** the PRD's #1 growth mechanic ("screenshot-ready shareable card", "built-in virality engine", `PRD.md` §6.4/§6.9/§11) sends every recipient to an unbranded Next 404. Share rate and D1/D7 retention targets (§15) cannot be met.
- **Fix:** add a server-rendered `/event/[id]/page.tsx` (public, OG-image-ready: description, points, verdict, author, tier, CTA to the feed) and reuse it for the share URL + QR. Until it exists, point shares at `/` or `/profile/{username}`. Add `generateMetadata` with `openGraph.images` so WhatsApp/X unfurls.

### P0-2 · Three built pages are undiscoverable; the mobile "Log" button is dead outside the feed
- **Evidence (dead Log button):** `src/components/layouts/bottom-nav.tsx:11` (`{ href: "#submit", icon: Sparkles, label: "Log", isAction: true }`) and `:19-21` (`window.dispatchEvent(new CustomEvent("open-submit-modal"))`). The only listener is `src/components/aura/submit-event-modal.tsx:49` — and `SubmitEventModal` is mounted **only** in `dashboard-client.tsx:84`. On `/leaderboard`, `/badges`, `/profile/*`, `/analytics`, `/premium`, `/wrapped`, `/vs/*` the central mobile CTA does nothing.
- **Evidence (dead palette action):** `src/components/layouts/command-palette.tsx:37` routes to `/dashboard?action=log`, `:104-107` dispatches `open-aura-log-modal`. Nothing reads `?action=log` (`dashboard-client.tsx` never touches `useSearchParams`) and nothing listens for `open-aura-log-modal` — two event names exist for one concept (`open-submit-modal` vs `open-aura-log-modal`), and the palette's own `router.push` happens in the same tick the unmounted page can't receive.
- **Evidence (unreachable pages):**
  - `/onboarding` — the only reference in the codebase is the file itself; `signup/page.tsx:67` sends new users to `/login` instead. Nothing ever checks "username still looks generated" (`onboarding/page.tsx:54` checks it, but nobody routes there).
  - `/vs/[user1]/[user2]` — referenced only inside its own share text (`vs/.../page.tsx:134`). No UI entry point, so the 1v1 duel feature is dead code from a user's perspective.
  - `/wrapped` — reachable only from the Ctrl/⌘-K palette (`command-palette.tsx:41`). Keyboard-only ⇒ **unreachable on mobile**.
  - `/analytics` and `/premium` are sidebar-only (`sidebar.tsx:24-31`); the mobile bottom nav (`bottom-nav.tsx:8-14`) omits them. Premium is rescued by the dashboard ad banner; **Analytics is unreachable on mobile**.
- **Impact:** ~40% of shipped surface area is orphaned. Mobile users cannot open Analytics, cannot open Wrapped, and — see P0-4 — cannot even log an event from any page but the feed.
- **Fix:** mount `SubmitEventModal` (or a global `LogAuraSheet` provider) in `src/app/(app)/layout.tsx`; unify on one event name or better, a React context (`useLogModal()`); add "Log" to the sidebar; replace bottom nav item `Badges` or add a 5th slot for `Analytics`; add Wrapped entry points (feed daily-report card, profile header, sidebar); add a "Duel" button on leaderboard rows and on profiles; redirect post-signup and post-login-with-generated-username to `/onboarding`.

### P0-3 · The aura number — the product's hero element — renders double signs and identical colours
- **Double sign (11 sites).** `formatAuraPoints()` (`lib/utils.ts:11-22`) already prepends `+` for every non-negative value, and every large display prepends its own sign on top:
  - `aura-event-card.tsx:183-184` → renders `++1.2K`
  - `submit-event-modal.tsx:328-329` → `++1.2K` (the reveal — the single most important moment in the app)
  - `daily-report-card.tsx:67-68` → `++1.2K`; `daily-report-card.tsx:84` → `+` + `formatAuraPoints()` = `++`
  - `share-card-modal.tsx:167-168` → `++1.2K` **inside the downloaded PNG** (viral artifact ships broken)
  - `wrapped/page.tsx:203`, `leaderboard/page.tsx:174-175` → `++`
  - `analytics/page.tsx:171` → `++`; `:189` → `-` + `+1.2K` = **`-+1.2K`** (totalLoss is a positive magnitude, `aura-actions.ts:686`); `:222` → `++` or `-+`; `:358` → `++`
  - `profile-client.tsx:195` → `++`, and **`+-`** whenever a user has no positive event (`biggestW` is `Math.min`-style `Math.max` over all points, `profile-client.tsx:90-92`)
- **Colour never applies.** Every one of those elements also carries `grad-text` (`globals.css:452-457`) which sets `background-clip:text` + `-webkit-text-fill-color:transparent`, so the sibling polarity class `text-emerald-400` / `text-red-400` (`aura-event-card.tsx:181`, `submit-event-modal.tsx:324`, `daily-report-card.tsx:65`, `share-card-modal.tsx:163` alongside a hard `text-white` at `:162`) is dead paint. **Wins and losses render in the same gold→violet gradient** — the app loses its core red/green signal exactly where it matters most.
- **Fix (one place, then delete 11 call-site signs):**
  1. Change `formatAuraPoints` to emit an unsigned, magnitude-formatted value, and add `formatSignedAura(n)` (or an options arg) that owns the sign. Then remove the hand-rolled `"+"`/`"-"` prefixes.
  2. Never combine `grad-text` with a polarity colour. For aura figures use a polarity-only token: `--aura-pos` / `--aura-neg` (`text-[hsl(var(--aura-positive))]`), and reserve the gradient for the brand wordmark only.
  3. Add a `PolarityNumber` component (value → sign + colour + tabular figures + reduced-motion-safe count-up) so this can't regress.
- **Regression test to add:** snapshot the reveal, feed card, share card and daily report with `+500`, `-500`, `0`, `+1250`, `-1250`.

### P0-4 · The feed's "Load More" duplicates page 0 instead of advancing
- **Evidence:** `dashboard-client.tsx:40-57` — `const currentPage = reset ? 0 : page; … if (!reset) setPage(currentPage + 1);`. The tab effect (`:59-64`) calls `loadEvents(true)`, which **never increments `page`** — so after the first successful load `page` is still `0`. The first "Load More" click (`:177-183`) therefore re-fetches page 0 and appends it: the feed shows the same 20 events twice with **duplicate React keys** (`key={ev.id}`, `:123`) inside `AnimatePresence mode="popLayout"`.
- **Secondary:** `loadEvents` closes over `events` (`:53` `[...events, ...newEvents]`) while the effect deliberately omits it from deps — the ESLint `react-hooks/exhaustive-deps` warning at `:64:6` is this bug, not noise.
- **Fix:** derive pagination from the loaded array (`const nextPage = Math.ceil(loaded.length / PAGE)`), or set `page` state inside `loadEvents` for both paths (`setPage(p => reset ? 1 : p + 1)`), and dedupe defensively by `id` when appending. Replace the manual button with an `IntersectionObserver` sentinel (PRD §6.3 promises infinite scroll) — or keep the button but make it honest.

---

## 5. Bug register — P1 (broken navigation, gating, trust)

### P1-1 · "Forgot password?" is a self-link
`login/page.tsx:136-140` → `<Link href="/login">Forgot password?</Link>`. No reset flow exists anywhere. The highest-intent button on the auth screen is a no-op that reloads the page. **Fix:** implement Supabase `resetPasswordForEmail` + `/reset-password` page, or remove the link (a dead link is worse than no link).

### P1-2 · New signups never reach onboarding, and land on the wrong screen
`signup/page.tsx:66-67` → `toast.success("Account created! Check your email to verify")` then `router.push("/login")`. Two failure modes: (a) if email confirmation is enabled the user gets no "we emailed you" screen; (b) if it's disabled the user is **already signed in** but is pushed to `/login`, where `middleware` bounces them to `/dashboard` (`lib/supabase/middleware.ts:50-60`) with a generated `user_xxx` handle and no onboarding. **Fix:** branch on `data.session` — session ⇒ `/onboarding`; no session ⇒ a dedicated "verify your email" state with a resend action.

### P1-3 · Two sources of truth for tier; the sidebar can contradict the profile
`src/app/(app)/layout.tsx:39-58` silently writes `current_tier = "NPC"` + `streak_days = 0` when `last_active_date` is >36h old, **without touching `total_aura`**. The sidebar (`sidebar.tsx:57,87-89`) and leaderboard (`leaderboard/page.tsx:178`) print the *stored* tier, while the profile recomputes it from aura (`profile-client.tsx:38` `getTierForAura(profile.total_aura)`). A user with 500,000 aura who was away 2 days therefore sees **"NPC · 500.0K" in the sidebar and "Legendary" on their own profile** — on the same screen if both are visible. The write also happens on *every* layout render (a DB write on page navigation) and uses `Math.abs()` so a future `last_active_date` also demotes. **Fix:** derive tier everywhere from `total_aura` (single helper `getTierForAura`), and if decay is a real product feature, model it explicitly (aura decay, not tier overwrite), log it, and surface it to the user ("your aura decayed −X while you were away").

### P1-4 · Premium state is not respected in three places
- `ad-banner.tsx:11` takes `isPremium = false` and is rendered as `<AdBanner />` (`dashboard-client.tsx:116`) with no prop ⇒ **paying users see "Go Premium for ad-free experience"**. The PRD explicitly sells ad-free (`PRD.md` §7.1). `dismissed` (`:12`) is component state, so it returns on every remount.
- `premium/page.tsx:146-165` has no `is_premium` check: an existing subscriber still sees an active "Upgrade to Premium" button (only the `?status=success` query param can change the label). Renewal/duplicate-charge risk.
- Off-grade copy drift: landing + premium page advertise "3 AI logs per day" (`page.tsx:498`, `premium/page.tsx:11`) while the enforcement message says **5/day** (`lib/actions/aura-actions.ts:50`) and the PRD says 5 (`PRD.md` §6.2). Pick one and make it a shared constant.
**Fix:** pass `profile.is_premium` into `AdBanner` from the layout (or fetch inside it), server-gate `/premium` (or show a "You're Premium — manage plan" state), and centralise plan limits in one exported constant used by copy, UI and the action.

### P1-5 · `html2canvas` cannot rasterise this Tailwind v4 UI
`share-card-modal.tsx:40-45` imports `html2canvas` and captures a node styled with Tailwind v4 palette utilities (`from-emerald-950`, `via-teal-900`, `bg-red-950`, `text-emerald-400`, `ring-yellow-400/30`). Tailwind v4 emits `oklch(...)` for these; html2canvas does not parse `oklch` and silently drops those declarations (`backgroundColor` falls back), so the exported PNG loses the card's polarity colours — the exact thing that makes it shareable. `html-to-image` is already in `package.json:15` (the library the PRD specifies, `PRD.md` §8) and is unused. **Fix:** switch to `html-to-image`'s `toPng` with `pixelRatio: 3, cacheBust: true`, or render the export card from a fully tokenised inline style object using sRGB hex values. Also add an `await document.fonts.ready` before capture so Bodoni/JetBrains text isn't BLOCKed, and wrap in try/catch with a "screenshot instead" fallback (already present — keep it).

### P1-6 · Modals are not dialogs: no Escape, no focus trap, no scroll lock, no role
`submit-event-modal.tsx:116-141`, `share-card-modal.tsx:68-90`, `profile-client.tsx:302-326`. None declares `role="dialog"`/`aria-modal`, none closes on `Escape` (the palette does, `command-palette.tsx:129-132` — the only one that got it right), none traps focus or restores it to the trigger, and all three leave the page behind them scrollable (the mobile sheet is `items-end` with `max-h` unconstrained so long verdicts can push the primary button off-screen with no scroll). **Fix:** extract one `<Sheet>` primitive (presentation + behaviour) and migrate all three; add `overscroll-contain`, `body` scroll lock, `Escape`, focus trap, `aria-labelledby` pointing at the modal title, and `returnFocus`.

### P1-7 · Unlabelled forms and unlabelled icon buttons
- **Icon-only controls with no accessible name (grep: `aria-label` count across `src/app` + `src/components` is 0):** mobile Log FAB `bottom-nav.tsx:30-38`; ad dismiss `ad-banner.tsx:37-42`; share-card close `share-card-modal.tsx:85-90`; modal close `submit-event-modal.tsx:136-141`, `profile-client.tsx:321-326`; password visibility toggles `login/page.tsx:110-116`, `signup/page.tsx:165-171`; landing theme toggle `page.tsx:218-223`; sidebar theme/logout `sidebar.tsx:150-164` (these two have text, OK) — but the landing theme button is icon-only.
- **No programmatic labels on any input:** `login/page.tsx:89-109` and `signup/page.tsx:111-164` rely on placeholder-only text (invalid as a label); `submit-event-modal.tsx:157` renders a `<label>` without `htmlFor` and the `<textarea>` at `:188` has no label at all; `profile-client.tsx:337,352` same.
- **Tabs are not tabs:** `dashboard-client.tsx:93-109` and `leaderboard/page.tsx:60-76` are button groups with no `role="tablist"/"tab"`, no `aria-selected`, no arrow-key navigation.
- **Contrast:** micro-type at 9–10px with 25–50% opacity (`page.tsx:255` `text-muted-foreground/40`; `analytics/page.tsx:318`; `wrapped/page.tsx:193` `text-white/25`; `profile-client.tsx:364`) fails WCAG AA (and is illegible at 375px).
- **Reduced motion is incomplete:** `globals.css:567-590` neutralises the CSS keyframe classes only; every Framer Motion animation (`aura-event-card.tsx:115-118`, `wrapped/page.tsx:364-373`, `submit-event-modal.tsx:308-330`, `celebration-effect.tsx:60-129`, the full-screen confetti/skull rain) ignores `prefers-reduced-motion`. No `useReducedMotion()` exists in the codebase.
- **Fix:** add `aria-label` to the 8 icon-only controls; convert placeholders to `<label className="sr-only">` + `htmlFor`; add `role="tablist"` semantics or use `aria-pressed`; raise micro-type to ≥11px and ≥60% opacity; gate all motion on `useReducedMotion()` and cap the celebration effect (or replace it with a static burst frame under reduced motion).

### P1-8 · Mobile cannot log out or switch theme
`signOut` exists only in `sidebar.tsx:51` (desktop-only, `hidden lg:flex` at `:60`) and in the command palette behind ⌘/Ctrl-K (`command-palette.tsx:95-102`) — a keyboard shortcut that does not exist on phones. Theme toggle has the same problem (`sidebar.tsx:151`, `page.tsx:219` — the landing toggle works, the app does not have one). **Fix:** move account actions into a proper mobile "Me" surface (the `/profile` page is the natural home: add Theme + Log out + Upgrade rows), and/or extend the palette with a visible trigger button so it is reachable by tap.

### P1-9 · Share/QR host is hard-coded and diverges from `metadataBase`
`share-card-modal.tsx:191,200` hard-code `AURAMINT.NOVAMINTNETWORKS.IN` / `https://auramint.novamintnetworks.in/event/…` while `layout.tsx:49-51` derives URLs from `NEXT_PUBLIC_APP_URL`. Local/staging/preview deployments therefore print a QR to production. `login/page.tsx:38` / `signup/page.tsx:73` correctly use `window.location.origin`. **Fix:** build the share URL from `window.location.origin` (client) or a single `NEXT_PUBLIC_APP_URL` helper, and print only the host (not the full uppercase domain) on the card.

---

## 6. Bug register — P2 (polish, integrity, performance)

| # | Bug | Evidence | Fix |
|---|---|---|---|
| P2-1 | Landing tier table fabricates a **different tier ladder** than the product (`GOD MODE >100K`, `Sigma/Chad 25–50K`, `Clown Behavior`, `Aura Debt`) while `AURA_TIERS` says GOD MODE ≥5,000,000 and Rising Star 25K (`lib/ai/prompts.ts:33-42`) | `page.tsx:96-105` | Render the table from `AURA_TIERS` so marketing, sidebar, profile and leaderboard agree |
| P2-2 | Marketing presents **invented social proof** ("50K+ Events Logged", "12K+ Active Users", "4.8★ App Rating") on a pre-launch product (`ROADMAP.md` Month-1 target is 500–2,000 users) | `page.tsx:107-111`, rendered `:282-289` | Replace with product truths (verdict speed, tier count, "free forever, no card") or gate behind real numbers |
| P2-3 | `Math.random()` in render → hydration mismatch on the hero starfield (server and client positions differ) | `page.tsx:185-198` (lint `react-hooks/purity` ×6) | Pre-generate positions in `useMemo` **after mount** (`useEffect` + state) or use a deterministic seeded PRNG; same pattern already attempted in `(auth)/layout.tsx:11-21` (also flagged by lint) |
| P2-4 | Profile chart mutates a `let` accumulator **after render** and Recharts draws whatever order the DB returned (unsorted by hour for same-day points) | `profile-client.tsx:79-87` (lint `react-hooks/immutability`) | Build the series with a pure `reduce`, bucket by day, sort by timestamp; the label `d/m` hides multi-point days |
| P2-5 | `premium-icon.tsx:63-66` renders unmapped emoji as a `<span>` **carrying size classes** (e.g. `h-14 w-14`), so the emoji keeps its inherited font-size inside a fixed box: tiny, top-left aligned, no colour | `premium-icon.tsx:51-69`; used with `h-14 w-14` (`submit-event-modal.tsx:314`), `h-9 w-9` (`share-card-modal.tsx:170`), `h-10 w-10` (`badges/page.tsx:152,187`) | Delete the emoji⇄Lucide hybrid (see §7.4). 12 of 16 badge emojis (🌱📝☀️⚔️🏆💎💰🎬🔱🗓️ …) are unmapped, so the badge grid mixes two icon systems with different sizes |
| P2-6 | `animate-bounce` on AI emoji in the feed and share card (`aura-event-card.tsx:186`, `share-card-modal.tsx:170`) + `animate-pulse` on tier/crown/skull icons — the "unmapped emoji" fallback span also receives `animate-bounce`, bouncing a text glyph | as cited | Keep one motion idiom; never bounce emoji |
| P2-7 | `(app)/layout.tsx:1` sets `export const dynamic` **above** the imports; every app page is therefore forced dynamic with `supabase.auth.getUser()` + a profile SELECT + possible UPDATE per navigation. No `loading.tsx` anywhere, so the sidebar/profile widget pop in late on every route change | `(app)/layout.tsx:1,14-36`; no `loading.tsx` | Move the config below imports, hoist profile fetch into a cached helper (`cache()`/`unstable_cache` keyed by user), add `loading.tsx` skeletons per route group |
| P2-8 | Badges page hangs forever in the loading skeleton if `getUser()` returns no user (`if (!user) return;` before `setLoading(false)`) | `badges/page.tsx:24-27,62-82` | Return an auth/empty state or (better) fetch stats through a server component / action that already 401s |
| P2-9 | Wrapped shows a fully-composed "recap" for a user with **zero** events in 30 days: `+0`, "No positive aura events logged this month. Is it a therapy arc bro? 💀", archetype "The Balanced Civilian" | `wrapped/page.tsx:102-124,238-242,266-270` | Add an empty state ("No aura in the last 30 days — log 3 events to unlock your Wrapped") and gate the deck behind a minimum event count |
| P2-10 | Profile stats are mislabelled: "Total Events" prints `events.length` of a query limited to 20 recent events (`lib/actions/aura-actions.ts:438`) and "Biggest W/L" ignore the rest of history | `profile-client.tsx:90-95,193-197` | Source the stat row from a dedicated aggregate (the analytics action already computes wins/losses/totals) |
| P2-11 | Profile renders `AuraEventCard` **without** `isOwner`, so a user cannot boost their own event from their own profile (the only boost entry point is the dashboard feed) | `profile-client.tsx:295` vs `dashboard-client.tsx:127` | Pass `isOwner`; add a "Boost" affordance on the profile too |
| P2-12 | Leaderboard rows are inert: no link to `/profile/{username}`, no "your rank" row, no duel CTA, and the row prints the *stored* tier beside a *period* aura (`getLeaderboard` daily/weekly overwrites `total_aura` with the period sum, `aura-actions.ts:405-411`) so "🔥 Main Character" can sit next to +40 aura | `leaderboard/page.tsx:106-183` | Wrap rows in `Link`, add a sticky "You · #rank · X to next rank" row (PRD §6.6), label period aura vs lifetime tier explicitly |
| P2-13 | Feed cards are not social entry points: the author avatar/name block is a plain `div` (no profile link), there is no category filter or friends tab despite PRD §6.3, and every card is tinted green/red so nothing reads as special | `aura-event-card.tsx:146-163`; `dashboard-client.tsx:16-20` (3 tabs only) | Link the author; add category pills; make polarity a left rail + numeral colour and reserve `glow-gold` for ±5000+ only (already conditional at `:122-125` — currently drowned out because `glow-win`/`glow-loss` apply to *every* card) |
| P2-14 | Reaction/vote state is not hydrated from the server: `activeReaction`/`userVote` start `null` while the counts include the user's existing reaction, so the UI shows "not reacted" and a re-tap attempts a duplicate insert (server returns `removed`, the chip decrements — the count corrects itself but the first tap feels broken) | `aura-event-card.tsx:51-99` | Have `getPublicFeed` return the viewer's reaction/vote (or fetch once per session) and initialise state from it; disable the chip until hydrated |
| P2-15 | `AdBanner` uses a raw `<a href="/premium">` (full reload, loses client state) and its dismiss state isn't persisted | `ad-banner.tsx:31-36,37-42` | Use `next/link`; persist dismissal in `localStorage` for the session |
| P2-16 | Login/Signup have no inline error surface and no `autoComplete`; password rules are only enforced by `minLength`/JS toast; the signup username check is a client-side SELECT that races the unique index | `login/page.tsx:86-133`, `signup/page.tsx:39-49` | Add `aria-describedby` error slots, `autoComplete="email|current-password|new-password"`, and rely on the DB unique constraint with a friendly catch |
| P2-17 | Onboarding copy says "lowercase letters … only" but the input accepts uppercase (it strips only non-alphanumerics) and no live availability check exists, contradicting the PRD requirement ("availability check in real-time", §6.1) | `onboarding/page.tsx:168` vs `:175`; no debounce/check | Add debounced availability check with ✔/✖ state; enforce lowercase in `onChange` |
| P2-18 | Profile edit note renders literal Markdown asterisks: "at most **twice every 15 days**" | `profile-client.tsx:363-365` | Use `<strong>` or drop the asterisks |
| P2-19 | `?status=FAILED` is checked as `status === "FAILED"` while Cashfree/most gateways return `failed`/`FAILURE` — case-fragile banner | `premium/page.tsx:31-33` | Normalise to lowercase before comparing; add `pending`/`cancelled` states |
| P2-20 | Landing page pricing CTAs always point at `/signup` even when the visitor is logged in (`isLoggedIn` is already known at `:144-151` and used in the navbar/hero only) | `page.tsx:505,528` | Reuse `isLoggedIn` for the pricing buttons ("Manage plan" → `/premium`) |
| P2-21 | The whole marketing page is a client component (`"use client"` at `page.tsx:1`) so the hero, features, tiers and pricing are all client-rendered; no page exports `metadata`, no OG image, no `sitemap`/`robots` | `page.tsx:1`; only `layout.tsx:28-52` has metadata | Split marketing sections into server components with static data; add `metadata` per route + a generated OG image for profiles/events |
| P2-22 | Footer/nav dates use `new Date().getFullYear()` inside client components (harmless), but `page.tsx:573` + `(auth)/layout.tsx:61` + `onboarding/page.tsx:257` duplicate the same footer markup 3× | as cited | Extract one `<SiteFooter />` |
| P2-23 | `timeAgo` returns future-skewed strings for clock skew ("just now" only <60s, then `0m ago`) and is called during render for every card with no `suppressHydrationWarning` — SSR/client can disagree across a minute boundary | `lib/utils.ts:27-37`; `aura-event-card.tsx:160` | Render relative time after mount or round down to a stable bucket |
| P2-24 | Sound plays on **every** chip/tab/theme/log-out interaction with no mute and no persistence, and starts an `AudioContext` on the first user gesture (`playHapticPop` on category select, boost, vote, reaction, bottom-nav Log, palette open/close) | `lib/utils/sound.ts:19-38`; call sites `submit-event-modal.tsx:107,166,232`, `aura-event-card.tsx:74,88,260`, `bottom-nav.tsx:20`, `command-palette.tsx:62,87` | Add a persisted sound toggle (sidebar/profile), default-on but visible; never play on navigation-only actions |
| P2-25 | Long content has no clamping in the feed: `description` and `ai_verdict` render at full length (`aura-event-card.tsx:173-194`) although the column allows 280 chars + a 2-sentence verdict; the only `line-clamp` in the app is on analytics highlights (`analytics/page.tsx:357`) | as cited | `line-clamp-3` + "more" expansion on the card |
| P2-26 | `.glass:hover` applies a **transform + lift to every glass element** including static info panels and the share modal's inner card (`globals.css:187-194`), so non-interactive surfaces jiggle on hover | `globals.css:187-194,213-221` | Scope hover elevation to a `.is-interactive` modifier or to `a/button` ancestors |

---

## 7. Bug register — P3 (code-health items that will bite the redesign)

1. **`any` is the de-facto model layer in UI files.** 30+ `@typescript-eslint/no-explicit-any` errors in `src/app` alone (`analytics/page.tsx:98-103,212,259,301`; `profile-client.tsx:33-35,80,91,94`; `dashboard-client.tsx:24,47`; `leaderboard/page.tsx:21`; `badges/page.tsx:39-40`; `wrapped/page.tsx:58`). Any redesign that renames a field will fail silently. Generate DB types (`supabase gen types`) and delete the `any`s before touching layout code.
2. **Effect-driven resets flagged by React Compiler lint:** `dashboard-client.tsx:60` (`setPage/setEvents/setHasMore` in an effect) and `command-palette.tsx:73,81` (`setSelectedIndex`, `setSearch("")` in effects). Both should be derived state or event handlers. Lint evidence: `react-hooks/set-state-in-effect`.
3. **Deployed `next.svg`/`vercel.svg` etc. in `public/`** are dead create-next-app leftovers; there is no logo/favicon system (`src/app/favicon.ico` only) and no OG image asset, while every share surface depends on the brand mark.
4. **`premium-icon.tsx` must be dismantled, not extended.** It is two systems in one file: a 19-entry emoji→Lucide map (which half the app uses) and a raw-emoji fallback (which the other half hits). The identity work in §9 depends on one deterministic icon system.
5. **Duplicated design knowledge:** category emoji exist in three places (`lib/ai/prompts.ts:44-52`, `analytics/page.tsx:26-34`, plus `premium-icon.tsx:41-48`), tier emoji in five (`sidebar.tsx:33-42`, `aura-event-card.tsx:45-48`, `leaderboard/page.tsx:10-13`, `profile-client.tsx:22-25`, `premium-icon.tsx:72-81`, plus a copy of tier colours in `lib/ai/prompts.ts:33-42`). The redesign must create `lib/design/tokens.ts` + `lib/design/tiers.ts` as the single source, or every future theme pass will drift again.
6. **Radius/opacity chaos:** `globals.css:60` sets `--radius: 1.25rem` but the UI hard-codes `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-[2rem]`, `rounded-[2.25rem]`, `rounded-[2.5rem]` (e.g. `share-card-modal.tsx:96` vs `submit-event-modal.tsx:130` vs `wrapped/page.tsx:333`). Skeleton loaders use `bg-muted/30…/70` with no token.

---

## 8. Lint evidence (UI paths only, `npx eslint src/app src/components`)

**Non-`any` findings (all reproduced):**
- `src/app/page.tsx:190,191,192,193,194,195` — `react-hooks/purity`: `Math.random()` during render (hydration mismatch, P2-3)
- `src/app/(auth)/layout.tsx:14,15,16,17,18` — same (the `useMemo` does not help; it still runs during render)
- `src/components/aura/celebration-effect.tsx:38,39,40,41,42,43+` — same (confetti/skull particle fields)
- `src/app/(app)/dashboard/dashboard-client.tsx:60` — `react-hooks/set-state-in-effect` (P0-4); `:64` — missing `loadEvents` dep
- `src/app/(app)/profile/[username]/profile-client.tsx:81` — `react-hooks/immutability` (P2-4)
- `src/components/layouts/command-palette.tsx:73,81` — `react-hooks/set-state-in-effect`
- Unused: `page.tsx:25` `PremiumIcon`; `sidebar.tsx:5` `Sparkles`; `vs/page.tsx:5,30,67` (4 icons + `router` + `err`); `wrapped/page.tsx:13,15,23,24` (`Share2`, `Trophy`, `playPremiumUpgradeSound`, `QRCodeSVG` — i.e. **the Wrapped share/QR feature was imported and never built**)
- `any` counts in UI files ≈ 30; repo-wide `106 errors / 20 warnings`.

---

## 9. Design research — a distinct identity for AuraMint

### 9.0 What is wrong with the current skin (diagnosis)

| Current | Problem |
|---|---|
| `--primary: 38 92% 50%` (amber #E8A317) + `--accent: 272 72% 57%` (violet #7C3AED) + `cosmic-mesh` + 3 drifting orbs (amber/orange/rose, indigo/purple/pink, teal/emerald/cyan) in `layout.tsx:70-77` | This is **exactly** the generic purple-SaaS + aurora look the brief forbids. The app's brand hue is one of the three orbs, so nothing is ownable. |
| `glass`/`glass-card` blur (28px) on nearly every surface (`globals.css:167-221`) | Glassmorphism everywhere = zero hierarchy, plus a real perf cost on mid-range Android (the primary Indian Gen-Z device). |
| Colour is triple-booked: amber = brand base + premium + boost + "popular" + warnings; emerald/red = aura polarity **and** generic success/danger | No signal survives. |
| `heading` = uppercase + 800 + tracking −0.04 applied to *every* heading and most buttons (`globals.css:431-445`) | Everything shouts, so nothing lands. Typography is temperature-less: Syne (display) + Plus Jakarta (body) is a 2023 template pairing. |
| `grad-text`/`grad-gold` gradients with glow on numbers, headings, wordmark, archetype | Gradient text is the single most recognisable "AI template" tell, and it's the direct cause of the polarity-colour bug (§P0-3). |
| Two icon systems (Lucide + raw emoji) with a broken bridge (`premium-icon.tsx`) | Inconsistent optical weight, size and colour on the same screen (proof: `badges/page.tsx:152`) |
| 6 radii, 40+ type sizes, 5 opacities of "muted" | No measurable system to design against. |

### 9.1 Direction: **"The Mint"** — AuraMint as a mint/assay office for social currency

The product's own name supplies the metaphor the current skin ignores. AuraMint doesn't need a nebula; it needs a **mint**: value is *struck*, *hallmarked*, *assayed*, *serial-numbered* and *recorded in a ledger*. That gives a visual language no competitor in this space (BeReal, Gas, NGL, Yik Yak) and no Vercel-template app owns: **engraved metal + banknote guilloche + patina + brass**, not cosmos. It also gives the tier system a natural artefact (hallmarks), the share card a natural form (a banknote/receipt), and the leaderboard a natural shape (a ranked ledger).

Tagline to design against: **"Get your aura minted."**

### 9.2 Colour system (tokens, replacing `globals.css:34-94`)

```css
/* Ink & paper — canvas */
--ink-950: #0B0E0C;   /* oxide black canvas (was #07070a)  */
--ink-900: #12160F;   /* plate / card                      */
--ink-800: #1B211A;   /* raised plate, borders context     */
--paper-50: #F4EFE3;  /* light mode canvas = banknote paper (was cream+lavender) */
--paper-100:#EAE2D2;
--ink-text: #EDEAE2;  /* body text on ink — warmer than #F8FAFC */

/* Value metal — Brass (prestige ONLY) */
--brass-600: #A88418;
--brass-500: #C9A227;   /* legendary, premium, hallmark fills */
--brass-200: #EBD9A0;
--brass-050: #FBF3DA;

/* Patina — brand + positive */
--patina-700: #16564A;
--patina-600: #1F6F5C;  /* PRIMARY (CTAs, active nav, positive aura) */
--patina-400: #2E9E7A;  /* gain numbers */
--patina-100: #CDE7DC;

/* Oxide — loss */
--oxide-600: #9E3A26;
--oxide-500: #B4442E;   /* negative aura */
--oxide-200: #EBC9BF;

/* Lead — neutral / NPC */
--lead-500: #7A7F87;  --lead-300: #B9BDC2;

/* Engraving blue — rare third hue, fills/maps only */
--engrave-700: #1B3A5C;
```

**Rules**
1. **Delete violet `#7C3AED` and all three gradient orbs** (`layout.tsx:70-77`). The only ambient background allowed is a very low-opacity guilloche rosette (ink-on-ink, ≤6%) plus one brass hairline.
2. **Hue = one meaning.** Patina = brand/positive; Oxide = negative; Brass = prestige/legendary/premium (never a body CTA); Lead = neutral/NPC; Engraving blue = data-viz fills only. Kill the current amber-as-brand **and** amber-as-warning **and** amber-as-premium overload.
3. **Glow for one element per screen** (the aura figure at the reveal). Replace card glows (`glow-win`/`glow-loss` on every feed card, `aura-event-card.tsx:120-126`) with a **polarity rail**: a 3px left edge in patina/oxide + the numeral colour. Keep `glow-gold` (brass) strictly for |points| ≥ 5000.
4. Light mode becomes **paper** (`--paper-50`) with ink text and brass/patina accents — a banknote, not a lavender app. Dark mode is the default (it already is, `layout.tsx:81`) and stays ink.
5. Max 2 hues per screen; the app should be readable in greyscale (test every page in grayscale — polarity must survive via the rail + sign + icon, not colour alone). That's also the colour-blindness fix.

### 9.3 Typography

| Role | Choice | Why / usage |
|---|---|---|
| Display | **Bodoni Moda** 600/700 (fallback **Instrument Serif**) | High-contrast "engraver's serif" = currency/banknote lineage; small-caps for tier names; used for: page titles, tier names, aura figures on share cards, slide headlines. Replaces `Syne` (`layout.tsx:14-19`) — kills the geometric-display template look. |
| UI / body | **Instrument Sans** 400/500/600 | Slightly condensed neo-grotesque with real personality at 12–16px; better numerals than Plus Jakarta; replaces it 1:1 (`--font-sans`). |
| Figures | **JetBrains Mono** 500/700 (already wired, `layout.tsx:21-26`) | Keep — ledger figures, `font-variant-numeric: tabular-nums`, always through `<AuraNumber>`. |
| Micro / labels | Instrument Sans 600, 11px, `tracking-[0.14em]`, UPPERCASE **only here** | Replaces the current all-caps-everything (`globals.css:431-445`). |

**Scale — six steps, no exceptions:** `12 / 14 / 16 / 20 / 28 / 40` (display may go 56 on the hero and share card). Line-height 1.15 display, 1.5 body. `--font-display` must stop being applied via inline `style={{ fontFamily: "var(--font-display)" }}` on 12 elements (e.g. `aura-event-card.tsx:182`, `leaderboard/page.tsx:172`, `premium/page.tsx:109`) — use one `.font-display` utility.

**Enforcement:** a single `<AuraNumber value polarity size>` component owns sign, colour, tabular figures, count-up animation and reduced-motion fallback (this is the permanent fix for §P0-3).

### 9.4 Iconography

- **Rule:** *Lucide for everything the system says; emoji only for things a human or the model said.* Tier sigils, categories, nav, stats, actions = Lucide, 1.75px stroke, 20/24/32 optical sizes. Verdict emoji, reaction emoji, badge flavour = emoji (they are content, and content stays joyful).
- **Tier hallmarks (8 marks, one per tier)** — struck geometric marks instead of emoji: `Negative Aura → Skull`, `NPC → Stone/Tablet`, `Civilian → Person`, `Rising Star → Star`, `Main Character → Flame`, `Legendary → Crown`, `Mythical → Bolt`, `GOD MODE → Sunburst`. Render them inside a hallmark frame (a 1px inset octagon/circle with a notched edge) so they read as stamps, not toolbar icons. Use the **same** mark in: feed card, leaderboard row, sidebar widget, profile header, share card, leaderboard medal rows.
- **Delete** `premium-icon.tsx`. It creates both the size bug (§P2-5) and the two-system problem. Replace with `components/aura/tier-mark.tsx` (Lucide-based) + inline emoji where content demands it (with `role="img"` + `aria-label`).
- Category marks: `Heart / GraduationCap / Briefcase / Dumbbell / PartyPopper / Home / Dices` — already mapped in `premium-icon.tsx:41-48`; promote them to one exported `CATEGORY_META` in `lib/design/` and delete the three duplicate maps.
- **Reaction glyphs** (👑💀🔥😬✨🗿) are the one place emoji must remain, but render them in a "stamped token" chip (1px brass/lead border, no fill) so the reaction bar reads as a minted row instead of six floating emoji.

### 9.5 Motion & sound

- **Vocabulary (4, no more):**
  1. **Press** — the mint strike: `scale 1.06 → 1.0` + 60ms blur(2px) + a 2px brass rule flash under the number. Use for every submit/reveal/boost.
  2. **Flip** — `rotateY 90° → 0` on the aura figure only, for W→L direction.
  3. **Roll** — tabular-figure count-up (already the PRD's "number counter"), 700–900ms, `counterweight` easing (`cubic-bezier(.2,.9,.15,1)`).
  4. **Settle** — a 1px brass hairline that draws left→right (guilloche cadence) as a section enters; replaces `animate-fade-up` on ~20 blocks.
- **Remove:** infinite `animate-float`/`animate-breathe`/`animate-ping`/`animate-pulse`, `animate-bounce` on emoji, drifting orbs, `holo-sweep` on anything but the Legendary hallmark. **Budget: one ambient loop per viewport, one glow per screen, total reveal choreography ≤1.4s** (today the reveal chains five delays up to 1.35s plus a 3s confetti storm, `submit-event-modal.tsx:318-388`).
- **Reduced motion:** gate via `useReducedMotion()` for Framer and extend the CSS block (`globals.css:567-590`) so count-ups snap to the final value and confetti is replaced by a single static stamp frame. This is currently a WCAG 2.3.3 gap.
- **Sound:** keep the synth engine (asset-free = good for India mobile data) but make gains a **struck brass ping** (short 2-oscillator metallic, ~120ms) and losses a **dull thud**, add a persisted mute in the profile/Me surface, and never fire on navigation (`bottom-nav.tsx:20`).

### 9.6 Form language & page-level recommendations

**Global shells**
- **App shell:** sidebar becomes a **ledger spine** — ink plate, brass hairline divider, the aura widget as a struck plate with the tier hallmark, nav items as ledger lines with a 3px active rail (keep `motion layoutId`, it's good). Kill the sidebar's `glass-card` blur (`sidebar.tsx:60`).
- **Mobile bottom nav:** 5 slots = `Feed · Ranks · [LOG] · Wrapped · Me`, with Log as the raised brass **strike button**. Analytics/Theme/Logout move into `/profile` (Me). Fixes §P1-8 and §P0-2 at once.
- **Log sheet:** one global `<LogSheet>` mounted in `(app)/layout.tsx`, bottom-sheet on mobile / centred dialog ≥sm, with `role="dialog"`, Escape, focus trap, `overscroll-contain`, and the provenance line "minted at 14:32 · #0004128" (serial) to sell the metaphor.

**`/` Landing** — rebuild as an **assay receipt**, not a feature grid.
- Hero: headline in Bodoni ("Every moment has an aura. Get it minted."), then a two-panel receipt: left = your moment (textarea), right = the **struck result plate** (hallmark + numeral + verdict + serial). The existing demo (`page.tsx:294-400`) is the right idea; make it the composition centrepiece rather than a floating terminal window.
- Replace the 4 feature cards with a **3-step assay line** (Describe → Stamp → Ledger) and one annotated feed-card specimen.
- Tiers: render from `AURA_TIERS` (§P2-1) as a **hallmark ladder** (8 struck marks ascending).
- Pricing: two plates, brass for Premium, with the real daily limit (§P1-4). Pricing CTA respects `isLoggedIn` (§P2-20).
- Delete the fabricated stats (§P2-2). Replace with "8 tiers · Hinglish verdicts · Free forever, no card".
- Remove the floating gradient orbs and gradient wordmark; wordmark = brass engraved type + a hallmark crown struck in a 1px frame.

**`/dashboard` Feed**
- Header: "The Ledger" + today's mint count; one-line provenance.
- Daily report (`daily-report-card.tsx`) → a **receipt strip**: today's net (signed, patina/oxide), biggest W/L as two stamped cells, streak as a brass notch count. Remove its `glass` + glow, use the rail + numeral.
- Feed tabs → segmented **ledger filters** with the active one underlined in patina (also fixes the missing tablist semantics).
- Card redesign: polarity rail, author as a link with the tier hallmark, verdict in italic Bodoni 15px, vibe tag as a lead-stamped chip, reaction row as stamped tokens, W/L as a small balance-scale pair, and `Boost` styled as a brass press (owner only). Collapse long text (§P2-25).
- Ad → one "house plate" line (self-promo) or a real AdSense slot; **never shown to premium** (§P1-4).

**`/leaderboard`** — a **ranked ledger**: monospace rank serials, hallmark + name + tier, period vs lifetime columns, medals only for top 3 (brass/silver/lead), sticky "You" row with the gap to the next rank, row = link to profile, `Duel` affordance on hover/long-press.

**`/analytics`** — an **assay report**: 30-day bar strip becomes an engraved column chart (patina above the axis, oxide below, no rounded 2px bars), category breakdown as a hallmark legend, vibe tags as stamped chips at one size, boost stats as a brass meter. Its skeleton already exists and is good.

**`/badges`** — a **hallmark sheet**: earned badges are struck plates (octagon hallmark frame, brass ring for legendary), locked ones are un-struck blanks with a lead outline and the requirement in micro-caps. One <BadgeStamp> component; delete the emoji/Lucide mix and the `animate-bounce` (§P2-5/6). Add the empty state.

**`/profile/[username]`** — a **specimen sheet**: header = brass-edged plate with the tier hallmark as a large struck seal, total aura in Bodoni/Mono, tier progress as a **struck notch bar** (not a gradient), stats as four ledger cells, chart restyled (patina line, brass axis-free grid), events as feed cards with `isOwner` passed, badges row linking to `/badges`, `Share profile` + `Duel` actions. Fix the chart accumulator (§P2-4) and mislabelled stats (§P2-10).

**`/premium`** — a **mint certificate**: one brass plate, "AuraMint+ Certificate of Unlimited Minting", a real feature ledger (free vs premium as struck/unstruck rows), the actual daily limit, Cashfree checkout button as the only brass CTA, and a distinct `is_premium` state (certificate + manage/cancel) instead of the always-on upgrade button (§P1-4). Handle `success|failed|pending|cancelled` (§P2-19).

**`/wrapped`** — **the banknote**: this is the one place to be maximally loud. Each slide = a banknote face (guilloche rosette background, serial number, denomination = your monthly net aura in Bodoni, seal = tier hallmark, microprint of the veg/Gen-Z copy). Add the missing share/QR action (already imported and unused in `wrapped/page.tsx:13,24`) → one PNG per slide via `html-to-image`; add the empty state (§P2-9).

**`/vs/[a]/[b]`** — a **duel docket**: two struck plates facing across a brass VS seal, delta rendered as a coin stack / balance beam, the verdict as a stamped ruling. Add real entry points (leaderboard row action, profile action, an "open challenge" share link) and route the loser→winner comparison into the existing share text.

**Auth screens** — banknote vignette frame, one plate, Google as the primary keyhole, labels visible (not placeholder-only), inline errors, fixed "Forgot password?" (§P1-1), and a post-signup **verify screen** + `/onboarding` hand-off (§P1-2). Onboarding = 3 struck steps with live username availability (§P2-17).

**Share card (the artefact that matters most)** — a **minted note**: bright paper or deep ink face, guilloche band, the aura figure as the denomination in Bodoni with patina/oxide ink, verdict as the microprint, serial number + timestamp, tier hallmark as a wax seal, QR in the corner sealed inside a brass ring, and the URL printed as `auramint.app/e/0004128` (origin-derived, §P1-9, §P0-1). Export via `html-to-image` (§P1-5).

### 9.7 Migration order (so the redesign doesn't fight the bugs)

1. **Foundations (no visual change yet):** `lib/design/{tokens,tiers,categories}.ts`; `AuraNumber` + `formatSignedAura`; delete `premium-icon.tsx`; fix the duplicate-sign sites; migrate `grad-text` off numbers.
2. **Correctness P0/P1:** share/QR → `/event/[id]` route; global log modal + nav parity; feed pagination; premium-awareness; modal primitive (dialog behaviour); icon-only `aria-label` sweep; `html-to-image`; mobile Me/Theme/Logout.
3. **Skin, surface by surface:** shell (tokens, fonts, plate/rail/engraving primitives) → feed + card → share card → leaderboard → profile → analytics/badges → wrapped → landing → auth/onboarding.
4. **Retire:** orbs, `cosmic-mesh`, glass hover-lift, `animate-float/breathe/ping`, gradient text, `--accent` violet.

**Definition of done for the redesign:** greyscale-readable polarity; one hue = one meaning; ≤6 type sizes; ≤3 radii; one glow per screen; no `aria-label` gap on icon-only controls; every route reachable from a visible affordance on a 375px viewport; `prefers-reduced-motion` honoured by both CSS and Framer; zero `any` in UI files; lint clean on `src/app` + `src/components`.

---

## 10. Priority summary

| Priority | Count | Headlines |
|---|---|---|
| **P0** | 4 | `/event/[id]` 404 for every share+QR; orphaned pages + dead mobile Log; double-sign/colourless aura numbers; feed pagination duplicates |
| **P1** | 9 | forgot-password self-link; signup never reaches onboarding; two tier sources of truth; premium ignored (ads/upgrade); html2canvas can't rasterise oklch; non-dialogs; unlabelled forms/buttons; mobile can't log out; hard-coded share host |
| **P2** | 26 | fabricated tier ladder + social proof; `Math.random` hydration; post-render mutation in chart; emoji/Lucide hybrid; mislabelled profile stats; inert leaderboard/author links; wrapped on empty data; `?status=FAILED` fragility; missing empty/error boundaries; duplicate `any`-heavy models |
| **P3** | 6 | `any` layer, effect resets, stray create-next-app assets, 3× category / 5× tier duplication, radius/opacity chaos, dead imports |
