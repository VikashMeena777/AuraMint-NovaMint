# AuraMint — Redesign Implementation Report ("The Mint")

Front-end redesign of the marketing, auth and app-chrome surfaces.
Plan: `_audit/design-plan.md`. Direction + bug register: `_audit/ui-research.md`.
No commit, no push, no browser used. No `package*.json` change (main installed
`@radix-ui/react-dialog`, `@radix-ui/react-slot`, `class-variance-authority`, `cmdk`; all four are
imported by the new primitives).

---

## 1. What shipped

### 1.1 Foundations

| File | Change |
|---|---|
| `src/app/globals.css` | Full retheme to The Mint. New token set: patina `#1F6F5C` (brand/positive), brass `#C9A227` (prestige only), oxide `#B4442E` (negative), lead (neutral), engraving blue (data fills); paper `#F4EFE3` light canvas, oxide `#0B0E0C` dark canvas. Violet `#7C3AED` and every gradient/orb/glass/blur token is gone. Radius scale collapsed to 2/4/6/8/10/12px. New unlayered primitives: `.plate`, `.plate-{brass,positive,negative,receipt,flush}`, `.rail[-positive/-negative/-brass]`, `.hallmark[-lg/-lead/-positive/-negative]`, `.label-micro`, `.label-brass`, `.serial`, `.engraved`, `.rule`, `.rule-brass`, `.leader`, `.guilloche[-corner]`, `.perforated-top/-bottom`, motion vocabulary (`.animate-settle/-strike/-fade-up/-fade-in/-overlay-in/-plate-in`). All legacy class names are kept and rethemed (see §3). |
| `src/app/layout.tsx` | Fonts → Instrument Serif (display, 400 + italic), Instrument Sans (UI), JetBrains Mono (figures) via `next/font/google` with only the used weights. `<MotionProvider>` (client) wraps everything in `MotionConfig reducedMotion="user"`; `<SessionProvider>` shares one cookie-derived session read. Removed: the three drifting gradient orbs and the global grain overlay. Added: skip link (`#content`), woven-ledger body field, theme-aware `viewport.themeColor`, honest metadata (no fabricated claims), token-styled toaster. |
| `components.json` | shadcn config (new-york, RSC, `src/app/globals.css`, `@/` aliases, lucide icons) so future `npx shadcn add` lands in `src/components/ui`. |

### 1.2 Primitives (`src/components/ui/`, all new)

`button.tsx` (CVA + Radix Slot + Framer press idiom), `card.tsx` (Plate/PlateHeader/PlateTitle/…),
`dialog.tsx` (Radix Dialog + `DialogSheetContent` bottom-sheet/drawer), `input.tsx`
(Input/Textarea/PasswordInput with a labelled, `aria-pressed` visibility toggle), `field.tsx`
(`Field` render-prop with correct `label`/`aria-describedby`/`aria-invalid` wiring + `FormBanner`),
`command.tsx` (shadcn/cmdk `CommandDialog`), `animated-icon.tsx`, `aura-number.tsx` (sign + polarity
colour + tabular figures + reduced-motion-safe roll-up), `receipt.tsx` (assay receipt: torn edges,
dot-leader rows, total, deterministic barcode, serial), `tier-mark.tsx` (the single tier → Lucide
hallmark map, 8 marks), `theme-toggle.tsx`, `session-link.tsx`, `step-line.tsx`, `assay-demo.tsx`.

### 1.3 Landing (`src/app/page.tsx`) — now a Server Component with two client islands

Exports real `metadata` (was a client page with none). Sections: sticky header → hero with a
labelled **specimen receipt** → interactive **assay** (deposit a moment ⇄ struck receipt with serial,
verdict, vibe tag, direction and a rolled aura figure) → three-step assay line → annotated ledger
entry → **hallmark ladder rendered from `AURA_TIERS`** (the only real ladder) → pricing plates →
final CTA → footer.

- **Fabricated metrics deleted**: "50K+ Events Logged", "12K+ Active Users", "4.8★ App Rating" are
  gone; the hero facts are product truths (8 tiers, ±10,000 per entry, free forever/5 logs a day,
  Hinglish verdicts). Verified in the rendered HTML: zero occurrences of `50K+`, `12K+`, `4.8★`.
- **Fabricated tier bands deleted**: the old `Sigma / Chad`, `Clown Behavior`, `Aura Debt` ladder is
  replaced by the eight `AURA_TIERS` with their real min/max (e.g. `GOD MODE — 5,000,000 and above`)
  and their real descriptions.
- **Demo honesty**: the interactive assay says on its own face that it scores locally from a fixed
  rule table, and points at the AI verdict behind sign-in. All scoring happens in the submit handler
  (no render-phase randomness → the baseline `react-hooks/purity` errors are fixed).
- Pricing uses the real plan: free = 5 entries a day (the enforced `plan-actions.ts` limit), plus =
  ₹99/month or $1.99, with the real feature ledger from the premium page. CTAs are session-aware
  (`SessionLink`): guests → `/signup`, members → `/dashboard` or `/premium`.

### 1.4 Shell chrome

| File | Change |
|---|---|
| `layouts/sidebar.tsx` | Ledger spine: solid ink plate, brass hairline, struck balance widget (TierMark + `AuraNumber` + streak + AuraMint+ chip), primary "Log a moment" (broadcasts `open-submit-modal`) and a tappable "Search the ledger" (broadcasts `auramint:open-palette`), ledger-line nav with hovered/active animated icons and the `layoutId` active rail, labelled Theme + Sign out. Now covers the previously orphaned `/analytics`, `/badges`, `/wrapped`. `PremiumIcon` no longer imported. |
| `layouts/bottom-nav.tsx` | Five slots `Feed · Ranks · LOG · Wrapped · You`. LOG always works: it broadcasts `open-submit-modal`, answered by the global log sheet mounted in `(app)/layout.tsx` (the app agent added it), so the mobile centre button is no longer dead off-feed. "You" opens a real dialog sheet with Profile, Analytics, Badges, Wrapped, AuraMint+, Search, Theme and Sign out — mobile logout/theme now exist (audit P1-8) and the orphaned routes are reachable (P0-2). |
| `layouts/command-palette.tsx` | Rebuilt on `CommandDialog` (Radix + cmdk): Escape, focus trap, focus return, scroll lock, `aria-modal`, live filtering, `CommandEmpty`, shortcut hints. Covers every route plus Log a moment / theme / sign out; opens on ⌘/Ctrl-K **and** on tap from the sidebar or the mobile sheet. The two `react-hooks/set-state-in-effect` errors are gone (state resets in the open/close handler, not in an effect); the previous wrong event string (`open-aura-log-modal`, which nothing listened for) is replaced by the shared `OPEN_LOG_EVENT` constant. |
| `layouts/site-header.tsx`, `layouts/site-footer.tsx` | New marketing chrome: sticker-free solid header with anchors `#assay / #how / #hallmarks / #premium`, theme toggle, session-aware CTA, Radix-sheet mobile nav; one footer shared by landing and auth (audit P2-22), all links real. |
| `layouts/events.ts` | The two broadcast contracts (`open-submit-modal`, `auramint:open-palette`) in one place. |
| `providers/motion-provider.tsx`, `providers/session-provider.tsx` | `MotionConfig reducedMotion="user"` in a client island; one shared `getSession()` (cookie-read, optimistic, explicitly not authorization) behind `useSession()`. |

### 1.5 Auth

| File | Change |
|---|---|
| `(auth)/layout.tsx` | Server Component banknote vignette (rosette asset + assurances list) instead of 40 random "stars" — the five `react-hooks/purity` errors are gone with it. Form plate + shared footer, `id="content"` for the skip link. |
| `(auth)/login/page.tsx` | Visible labels, `autoComplete`, inline field errors (`aria-describedby`), a `role="alert"` banner, Google button, and explicit explanation for the OAuth callback failure path (`/login?error=auth_failed` from `src/app/auth/callback/route.ts`) with a one-tap route into recovery. `redirect`/`next` are honoured through a client mirror of `safeRedirectPath` (rejects `//host`, `\`, schemes). "Forgot password?" is no longer a self-link: it opens a real recovery request that mails `/auth/callback?next=/reset-password`, and it never reveals whether an address exists. |
| `(auth)/signup/page.tsx` | Same treatment plus: advisory username check with the DB constraint as the source of truth (duplicate races become inline messages), stronger inline validation, and a **verify-your-email state** with a resend action and a prefilled sign-in link instead of silently bouncing to `/login`. |
| `(auth)/reset-password/page.tsx` | **New route** completing recovery: exchanges a stray `?code=`, reads the recovery session, sets the new password with `updateUser`, and handles the expired/already-used link with a "request a new one" path instead of a dead end. |

### 1.6 Assets

`public/auramint-rosette.svg` (19.7 KB, three hypotrochoid families + spoke/dot rings, generated
parametrically for this project), `public/auramint-coin.svg` (bevelled octagonal collar with a struck
compass mark), `public/auramint-receipt-edge.svg` (serration + out-of-phase guilloche weave).
The unreferenced create-next-app leftovers (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`,
`window.svg`) are deleted from `public/` (audit P3-3).

## 2. Verification

| Check | Result |
|---|---|
| `npx eslint src/app/page.tsx src/app/layout.tsx "src/app/(auth)" src/components/layouts src/components/providers src/components/ui` | **exit 0, 0 problems** (baseline in these paths: 8 errors — 6 × `react-hooks/purity`, 2 × `react-hooks/set-state-in-effect` — plus 3 unused warnings) |
| `npx tsc --noEmit` | **exit 0, zero errors project-wide** (earlier intermediate runs still reported errors in files other agents were editing; those are resolved) |
| `npx next build` | **succeeds end to end** — compiled, type-checked, pages generated. `/`, `/login`, `/signup`, `/reset-password` are now prerendered as **static (○)**; the old landing was a client component on a dynamic route. `/dashboard`, `/analytics`, `/leaderboard`, `/wrapped`, `/premium`, `/profile`, `/event/[id]` are dynamic (ƒ) |
| Dev-server smoke test (`next dev`, curl of the SSR HTML) | `/` 200, `/login` 200, `/signup` 200, `/reset-password` 200, `/dashboard` 307 → `/login` when unauthenticated. No runtime/RSC errors in the dev log |
| Rendered-HTML assertions on `/` | "Assay receipt" present; zero `50K+`/`12K+`/`4.8★`/`Sigma / Chad`/`Clown Behavior`/`Aura Debt`; all eight real tier names present; `₹0`, `₹99`, `1.99` present; "5 a day" present; zero `violet-*`/`indigo-*`/`backdrop-blur`/`animate-breathe`/`orb-drift` in the markup |
| Rendered-HTML assertions on `/login` | `for="login-email"`, `for="login-password"`, `autoComplete`, `inputMode`, `aria-invalid`, `aria-required` all present |
| Rendered CSS | 100 `color-mix(in srgb …)` rules emitted (arbitrary tone values compile), `auramint-rosette.svg` referenced, `@media (prefers-reduced-motion: reduce)` block emitted |
| Button label/target audit | Icon-only controls carry `aria-label` (16 on the landing alone); every input has a `<label>`; nav/action targets are ≥44px (`min-h-11`/`min-h-14`/`size-11`/`size-12`) |

### Originality

The 21st.dev catalogue was searched for *metadata only* (no paid component code was retrieved): the
"Receipt Pricing" pattern (monospace ledger, dot leaders, serrated edge, barcode) confirmed the
assay-receipt idiom was worth building, and it is implemented here from scratch against this
project's own tokens (`src/components/ui/receipt.tsx`). The three SVG assets are generated
parametrically for this project (hypotrochoid rosette, struck coin mark, serrated guilloche band) —
no icon-pack art, no traced work, no copied source.

Note: an earlier intermediate state had `motion.create` + a `divide`/`border` conflict and a
transform-animated centred dialog; both were caught and fixed during implementation (the dialog
entrance is now opacity-only so the centring translate cannot be overwritten by keyframes).

## 3. Compatibility contract for unowned pages

Every legacy class name still resolves; only its treatment changed:

- `.glass`, `.glass-card`, `.glass-grain` → solid plates; blur removed; hover elevation is scoped to
  `a/button/.is-interactive` (audit P2-26).
- `.glow-win` / `.glow-loss` → a 3px patina/oxide inset rail (not a bloom), `.glow-gold` → brass
  hairline + rail, `.glow-brand` → 1px patina inset rule.
- `.cosmic-mesh` → static patina/brass wash; `.dot-grid` / `.line-grid` → engraved grid; `.grain*`,
  `.noise`, `.grain-overlay` → a static paper-weave texture (no `feTurbulence` noise wallpaper).
- `.animate-float*`, `.animate-breathe`, `.float`, `.star`, `.aura-orb`, `.orb-drift-*` → keep their
  names but no longer animate (the rules set `animation: none`), satisfying "no float loops" without
  breaking pages that still ask for them; `.aura-orb` becomes a static brass ring, `.star` a speck.
- `.grad-text`, `.grad-gold` → solid brass ink (kills gradient-text-as-brand and the double-sign/
  colour bug surface they fed).
- `.heading` → display serif, sentence case, weight 400, tracking −0.02em; `.mono` → tabular
  JetBrains; `.label-micro` → the only uppercase type.
- `.aura-input`, `.aura-btn-secondary`, `.aura-divider`, `.golden-focus`, `.border-holographic`,
  `.shimmer`, `.glow-hover-card` all retained with Mint styling.
- Radius utilities were re-scaled in `@theme`, so unowned `rounded-xl/2xl/3xl` now render as 8/10/12px
  plates instead of 20/28px pills.

Cascade note for future work: `.plate`, `.label-micro`, `.hallmark`, `.aura-input` and the rail
classes are **unlayered** CSS, so they beat Tailwind utilities of equal specificity. That is
deliberate (a tone change must not be silently re-overridden), and it means colour/radius overrides
on those classes belong in `globals.css` (see `.plate-brass`, `.label-brass`, `.hallmark-lg`).

## 4. Cross-scope items (not edited — for the coordinator)

1. **Duplicate primitive sets.** The app agent built a parallel kit in `src/components/aura/`
   (`primitives.tsx`, `mint-dialog.tsx`, `tier-mark.tsx`, `aura-number.tsx`, `mint.ts`, `hooks.ts`)
   with its own hard-coded palette hexes, while this scope built `src/components/ui/*` on the CSS
   tokens. Both work today (no import collisions), but tier marks, aura numbers, plates and the
   palette now exist twice. Recommend one follow-up pass to keep `src/components/ui/*` (token-driven)
   and have `components/aura/*` import from it.
2. **Skip link target.** The root layout now renders "Skip to content" → `#content`. `/` and the auth
   routes define it; `src/app/(app)/layout.tsx` does not yet — please ask the app agent to add
   `id="content"` to its `<main>` so the link works inside the app shell.
3. **Free-tier number mismatch.** Enforcement is 5 logs/day (`plan-actions.ts`); the premium page
   still says "3/day". The landing prints 5 (the enforced value). `premium/page.tsx` belongs to
   another agent.
4. **`premium-icon.tsx` is still imported by `badges/page.tsx`.** The sidebar no longer uses it; it
   cannot be deleted from this scope without breaking that page. Whoever owns badges should switch to
   `src/components/ui/tier-mark.tsx`.
5. **Duels are now reachable** — the app agent added a `/vs/{viewer}/{username}` link on the
   leaderboard (there is still no `/vs` index route, which is fine; a duel needs two handles). No
   action needed from this scope.
6. **Post-signup onboarding hand-off.** The signup page now ends on a verify-email state (honest), but
   middleware still sends verified new users to `/dashboard` rather than `/onboarding` (audit P1-2).
   That is `src/lib/supabase/middleware.ts` + `(app)/onboarding`, both out of scope.
7. **OAuth new users** land on `/dashboard` (the callback default) rather than `/onboarding`;
   changing the callback default affects returning users too, so it needs an explicit product call.
8. **Sound.** This scope plays no sound at all (the old landing did on every chip/tap). A persisted
   mute now exists in the app agent's `sound-toggle.tsx`; wiring it into the shell is theirs.
9. **Password recovery depends on the Supabase email template.** The flow assumes the recovery email's
   link goes through `/auth/callback` (set by `resetPasswordForEmail({ redirectTo })`). If the
   project's recovery template hard-codes a different `redirectTo`, the `/reset-password` page will
   correctly show its expired-link state — worth a config check by whoever owns Supabase settings.

## 5. Known limitations

- Not verified in a real browser (per instructions). Verification is static + SSR-HTML + lint + type
  + build; the interactive paths (dialog focus trap, count-up, sheets) rely on Radix/cmdk/Framer
  semantics and should get one manual pass by main.
- The landing assay is intentionally a local rule table, labelled as such; it does not call the AI.
- `SessionProvider` uses `getSession()` (cookie, no network) for optimistic UI only; it is never used
  as an authorization check.
- `.perforated-*` serrations rely on CSS `mask-image` (widely supported; including `-webkit-`
  prefixes). In a browser without mask support the receipt degrades to a straight edge, not a broken
  layout.
