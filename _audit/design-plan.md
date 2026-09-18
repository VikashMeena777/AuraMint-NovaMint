# AuraMint — Full Redesign Plan: "The Mint"

Design brief + implementation plan for the front-end redesign of the marketing, auth and app-chrome
surfaces. Written before any code edit. Owner: UI agent (landing / auth / shell chrome / tokens /
primitives). Companion documents: `_audit/ui-research.md` (direction + bug register),
`_audit/backend-plan.md` (non-UI).

---

## 1. Sources read before planning (AGENTS.md requirement)

| Source | What it changed |
|---|---|
| `AGENTS.md` + `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` | `next/font/google` self-hosts; font variables on `<html>`; only the four weights actually used are requested (requesting many weights bloats the build). |
| `.../01-getting-started/11-css.md` | Tailwind v4 via `@import "tailwindcss"` + `@theme` in one global stylesheet; no `tailwind.config`. |
| `.../03-api-reference/03-file-conventions/page.md`, `layout.md`, `route-groups.md` | `(auth)` group layout is a plain layout (can be a Server Component); metadata can only be exported from Server Components → the landing page must stop being `"use client"` (research P2-21). |
| `.../03-api-reference/04-functions/graceful-error-handling`, `use-search-params.md` | `useSearchParams()` still requires a `<Suspense>` boundary in a page; `?error=` handling stays client-side. |
| `_audit/ui-research.md` | §9 direction "The Mint"; §4–§7 bug register; §8 lint baseline. |
| `src/lib/ai/prompts.ts` | The only real tier ladder (`AURA_TIERS`, 8 tiers) and the 7 categories. |
| `src/lib/actions/plan-actions.ts` | The only real free-tier limit: **5 aura logs/day**, unlimited for premium. |
| `src/app/(app)/premium/page.tsx` | The real price (₹99/month, $1.99 international) and the real feature ledger. |
| `src/app/auth/callback/route.ts` | Failure path is `redirect("/login?error=auth_failed")`; success path honours a validated `next` param. |
| `src/lib/supabase/middleware.ts` | Protected routes redirect to `/login?redirect=<path>`. |
| `src/lib/actions/safety.ts` | `safeRedirectPath` — the client must not re-implement redirect validation, only mirror the same-origin rules. |

## 2. Diagnosis (kept from the research, one paragraph)

The current skin is the generic AI-SaaS stack: amber + violet, three drifting gradient orbs,
glassmorphism on every surface, uppercase-800 headings everywhere, gradient text on numbers, and a
fabricated tier ladder and social proof. None of it belongs to AuraMint. The product's own name
supplies the missing metaphor: AuraMint is a **mint / assay office for social currency**. Value is
struck, hallmarked, assayed, serial-numbered and recorded in a ledger.

## 3. Design language (non-negotiable rules for every screen in scope)

1. **Solid engraved plates, never glass.** Surfaces are opaque plates with a 1px rule; depth comes
   from a hairline + inner top highlight, not from blur. No `backdrop-filter` anywhere in the new
   work. (Legacy `.glass` classes are rethemed to solid plates so unowned pages inherit the fix.)
2. **One hue = one meaning.** Patina `#1F6F5C` = brand + positive. Oxide `#B4442E` = negative.
   Brass `#C9A227` = prestige only (legendary tier, premium, hallmark frames, serials) — never a
   body CTA. Lead `#7A7F87` = neutral / NPC. Engraving blue `#1B3A5C` exists for data fills only.
   Purple `#7C3AED` is deleted from the token set.
3. **Greyscale-readable polarity.** Sign (`+`/`−`) + rail + numeral colour; colour is never the
   only channel.
4. **Typography, six steps.** Instrument Serif = display only (page titles, tier names, numerals on
   share plates). Instrument Sans = UI/body. JetBrains Mono = every figure (tabular). Micro labels
   are the only uppercase text: 11px, `0.14em` tracking, ≥60% opacity (WCAG AA at 375px).
5. **Motion vocabulary of four** — Strike (scale + a brass rule flash), Flip (aura figure only),
   Roll (tabular count-up), Settle (1px hairline drawn left→right). No infinite float/breathe/ping,
   no drifting orbs, no bounce on emoji. One ambient loop per viewport, one glow per screen.
6. **`prefers-reduced-motion` is honoured twice**: CSS (`@media` block) and React
   (`<MotionConfig reducedMotion="user">` in the root layout), so every `motion.*` in the app obeys
   the OS setting without each component remembering.
7. **Guardrails from the brief**: no purple, no orbs, no glass blur, no float loops, no emojis as
   UI chrome (emoji stay only where content demands them), no fabricated metrics or tier bands.
8. **Assets are original SVG**: a guilloche rosette, a struck coin mark, and a receipt/paper edge
   SVG drawn for this project (no icon-pack art, no traced artwork).

## 4. Token system (`src/app/globals.css`)

Both themes keep the existing HSL-triple convention so unowned pages keep working, and add explicit
hex metal tokens for the engraving primitives.

| Token | Light (paper) | Dark (oxide) |
|---|---|---|
| `--background` | `#F4EFE3` paper | `#0B0E0C` oxide |
| `--foreground` | `#14170F` ink | `#EDEAE2` warm ink |
| `--card` / `--popover` | `#FBF8F0` raised plate | `#12160F` plate |
| `--primary` | patina `#1F6F5C` | patina `#2E9E7A` (contrast on ink) |
| `--brass` (new) | `#A88418` | `#C9A227` |
| `--destructive` | oxide `#B4442E` | `#D2604A` |
| `--border` | ink @ 12% | ink-50 @ 14% |
| `--ring` | patina | brass |
| `--radius` | `4px` (plates are near-square, not pill) | same |

`--aura-positive` / `--aura-negative` / `--aura-gold` are retained as aliases onto patina / oxide /
brass because unowned pages reference them.

## 5. Files owned and produced

### Rewritten
| File | Change |
|---|---|
| `src/app/globals.css` | Full retheme (tokens above), plate/rail/hallmark/guilloche utilities, motion vocabulary, compat layer. |
| `src/app/layout.tsx` | Fonts → Instrument Serif + Instrument Sans + JetBrains Mono; `MotionConfig reducedMotion="user"`; session provider; skip link; remove the three drifting orbs and the grain overlay; metadata refresh (no fabricated numbers, correct OG copy). |
| `src/app/page.tsx` | **Server Component** (metadata + honest static content) composing the header, hero, assay demo, assay line, specimen, hallmark ladder from `AURA_TIERS`, pricing plates from the real plan limits, CTA and footer. |
| `src/app/(auth)/layout.tsx` | Server Component banknote vignette frame (no random starfield → fixes `react-hooks/purity`); shared mint panel; footer. |
| `src/app/(auth)/login/page.tsx` | Labelled inputs, `autoComplete`, inline error slots, OAuth + `?error=auth_failed` callback-failure banner, `redirect`/`next` support, real password-recovery request mode. |
| `src/app/(auth)/signup/page.tsx` | Same treatment + post-signup "verify your email" state (no silent bounce to /login), friendly duplicate-username handling. |
| `src/components/layouts/sidebar.tsx` | Ledger spine: solid ink plate, brass hairline, struck aura widget with Lucide tier hallmark, ledger-line nav with active rail, labelled Theme/Logout, no `PremiumIcon`. |
| `src/components/layouts/bottom-nav.tsx` | 5 slots `Feed · Ranks · LOG · Wrapped · You`; Log always does something (event on the feed, `/dashboard?log=1` elsewhere); "You" opens an accessible sheet with Analytics, Badges, Duels, Premium, theme, sign-out (fixes mobile logout/theme, P1-8, and surfaces the orphaned routes, P0-2). |
| `src/components/layouts/command-palette.tsx` | Rebuilt on the exported `CommandDialog` primitive (Radix Dialog + cmdk): Escape, focus trap, scroll lock, `aria-modal`, live-region result count, corrected event string, full route coverage. |
| `src/components/providers/theme-provider.tsx` | Unchanged API; adds a shared `ThemeToggle` consumer contract note + typed props. |

### New
| File | Purpose |
|---|---|
| `src/components/providers/motion-provider.tsx` | Client wrapper so `MotionConfig` (reduced motion) can live in a Server Component root layout. |
| `src/components/providers/session-provider.tsx` | One cookie-derived `getSession()` per page load, shared by header/pricing/sidebar-adjacent islands; optimistic only, never authorization. |
| `src/components/ui/button.tsx` | CVA + `@radix-ui/react-slot` + `motion` press idiom. |
| `src/components/ui/card.tsx` | `Plate`, `PlateHeader`, `PlateTitle`, `PlateBody`, `PlateRail` primitives (solid, ruled). |
| `src/components/ui/dialog.tsx` | Radix Dialog primitives + a bottom-sheet variant, exported for reuse by any modal (P1-6). |
| `src/components/ui/input.tsx` / `label.tsx` / `textarea.tsx` / `field.tsx` | Labelled, described, error-aware form primitives (`aria-describedby`, `aria-invalid`). |
| `src/components/ui/command.tsx` | `CommandDialog` (shadcn idiom) used by the palette and reusable for future pickers. |
| `src/components/ui/animated-icon.tsx` | Lucide icon + Motion micro-interaction, `useReducedMotion` aware; used by nav, buttons, feature line, sidebar. |
| `src/components/ui/tier-mark.tsx` | The single tier → Lucide mark map + hallmark frame (8 marks), used by sidebar, landing ladder, ledger specimens. |
| `src/components/ui/aura-number.tsx` | Sign + colour + tabular figures + reduced-motion-safe count-up. Used by the landing demo and shell widget. |
| `src/components/ui/receipt.tsx` | Assay-receipt primitives: plate with perforated edge, dot-leader ledger rows, serial line, guilloche band. |
| `src/components/ui/assay-demo.tsx` | The interactive landing demo (client island): moment → struck plate, honestly labelled as a local sketch. |
| `src/components/layouts/site-header.tsx` | Landing navigation: brass wordmark + hallmark, real anchor links, session-aware CTA, mobile sheet. |
| `src/components/layouts/site-footer.tsx` | One footer for landing + auth (research P2-22). |
| `src/app/(auth)/reset-password/page.tsx` | Real recovery completion: reads the callback session, validates the new password, updates it, handles expired links. |
| `components.json` | shadcn configuration (new-york style, tailwind v4 CSS entry, `@/` aliases, lucide icons). |
| `public/auramint-rosette.svg`, `public/auramint-coin.svg`, `public/auramint-receipt-edge.svg` | Original engraved SVG assets (replacing the create-next-app leftovers in use). |

## 6. Surface plans

### 6.1 Landing (`/`)
`SiteHeader` → **Hero** ("Every moment has an aura. Get it minted.") with the ink plate + one
guilloche rosette ≤6% opacity + one brass hairline; **Assay** two-panel receipt (moment textarea ⇄
struck result plate with serial, hallmark, verdict and timestamp); **Three-step assay line**
(Describe → Strike → Ledger) replacing the four feature cards, with animated Lucide icons;
**Specimen** ledger card annotated; **Hallmark ladder** rendered from `AURA_TIERS` (8 rows, real
min/max, real descriptions); **Pricing plates** (Free: 5 logs/day + ad-supported; AuraMint+
₹99/month or $1.99, unlimited logs, extra-savage verdicts, 5 boosts/month, priority leaderboard,
premium cards, full analytics, all badges, 6 themes, ad-free, early access) with session-aware CTA;
**Final CTA** + `SiteFooter`. Fabricated "50K+/12K+/4.8★" stats are deleted and replaced with
product truths: 8 tiers, Hinglish verdicts, free forever/no card, 5 logs a day.

### 6.2 Auth (`/login`, `/signup`, `/reset-password`)
One plate per screen on a banknote vignette. Google keyhole primary, labelled email/password fields
with `autoComplete`, inline error text wired via `aria-describedby`, `role="alert"` summary for
callback failure (`?error=auth_failed`), `?redirect=`/`?next=` honoured through `safeRedirectPath`
client-side mirroring (same-origin path only). Forgot-password opens a real request form
(`resetPasswordForEmail` with `redirectTo=/auth/callback?next=/reset-password`); the reset page
completes the recovery session via `updateUser`, with explicit expired-link handling.

### 6.3 Shell chrome
Sidebar = ledger spine (solid ink plate, brass hairline, struck aura widget, railed nav, labelled
theme/logout). Bottom nav = 5 slots with the strike button; the "You" sheet exposes Analytics,
Badges, Duels, Premium, theme and sign-out on mobile. Command palette keeps ⌘/Ctrl-K but is now a
real dialog with focus trap and a discoverable trigger (a small search affordance in the sidebar and
the mobile sheet) so it is not keyboard-only.

## 7. Compatibility contract (unowned pages must not break)

Every legacy class is kept but rethemed: `.glass`, `.glass-card`, `.glass-grain`, `.noise`, `.grain`,
`.grain-overlay`, `.cosmic-mesh`, `.dot-grid`, `.line-grid`, `.glow-win`, `.glow-loss`, `.glow-gold`,
`.glow-brand`, `.border-holographic`, `.glow-hover-card`, `.aura-input`, `.aura-btn-secondary`,
`.aura-divider`, `.heading`, `.heading-fluid-hero`, `.mono`, `.grad-text`, `.grad-gold`,
`.animate-float*`, `.animate-breathe`, `.animate-fade-up`, `.animate-fade-in`, `.float`, `.star`,
`.aura-orb`, `.orb-drift-*`, `.golden-focus`, `.shimmer`.
`cosmic-mesh`/`orb-drift-*`/`.aura-orb`/`.animate-breathe` keep their names but become static,
non-blurred, non-looping treatments (no infinite animation), and `.grad-text`/`.grad-gold` become
solid brass ink rather than gradient text. New radius scale: `--radius` 4px with `sm` 2px, `md` 6px,
`lg` 8px so unowned `rounded-*` utilities stay coherent.

## 8. Motion & accessibility budget

- `MotionConfig reducedMotion="user"` at the root (client island) + the CSS `@media` block.
- One ambient loop per viewport maximum; none in the new code.
- Focus visible everywhere (`:focus-visible` ring in patina, 2px, 2px offset); all icon-only
  controls get `aria-label`; every input gets a `<label>`.
- Minimum 44×44px touch targets for every nav/action control (mobile bottom nav, sheet, header).
- Landing and auth ships zero `Math.random()` at render (fixes the baseline `react-hooks/purity`
  errors) — any variation is content, not decoration.

## 9. Lint deltas owned by this work

| Baseline finding | Fix |
|---|---|
| `src/app/page.tsx:190-195` `react-hooks/purity` (starfield) | Starfield deleted; demo scoring happens in the event handler. |
| `src/app/page.tsx:25` unused `PremiumIcon` | Import removed. |
| `src/app/(auth)/layout.tsx:14-18` `react-hooks/purity` | Random starfield deleted; layout becomes a Server Component. |
| `src/components/layouts/command-palette.tsx:73,81` `react-hooks/set-state-in-effect` | Rebuilt: derived filtered state, reset in the open handler, not in effects. |
| `src/components/layouts/sidebar.tsx:5` unused `Sparkles` | Removed. |
| Unused imports / `any` in files I do not own | Left to their owners; listed in the report. |

## 10. Out of scope (explicitly not touched)

`src/app/(app)/**` (feed, profile, analytics, badges, leaderboard, premium, wrapped, vs,
onboarding), `src/components/aura/**`, `src/lib/**`, `src/app/(app)/layout.tsx`, `package*.json`,
`eslint.config.mjs`, `next.config.ts`, SQL. Cross-scope dependencies are reported to the
coordinator instead of being edited.

## 11. Definition of done

1. `/`, `/login`, `/signup`, `/reset-password` render on The Mint tokens, in both themes, at 375px
   and 1440px, with no glass, no orbs, no purple and no infinite animation.
2. Every link on the redesign resolves to a real route; every form control is labelled; every
   icon-only control has an accessible name; every dialog is a real dialog.
3. `npx eslint` clean for the owned files; `npx tsc --noEmit` clean.
4. `_audit/design-report.md` lists the changes, the compat contract, the verification evidence and
   the cross-scope follow-ups.
