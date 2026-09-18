# AuraMint — Motion pass ("more alive, still premium")

Scope: `src/components/ui/animated-icon.tsx`, new `src/components/icons/**`, new
`src/components/ui/mint-motion.tsx` (+ scoped `mint-motion.module.css`),
`src/app/page.tsx`, `src/components/layouts/**`, `src/components/ui/assay-demo.tsx`.
No `globals.css`, no `package.json`, no backend, no other agent's file touched.
No browser, no deployment, no commit, no live writes. Evidence: scoped lint, `tsc`,
SSR render tests, dev-server HTML. Build gate left to main (as instructed).

---

## 1. What was actually broken

`AnimatedIcon` shifted the whole static Lucide glyph around (`y`, `scale`,
`rotate` on a wrapper span). It never animated an icon's own parts, it responded
only to `whileHover`/`whileTap` (so keyboard focus produced nothing), and every
server-rendered section of the landing page had to ship a static glyph because a
Lucide component reference cannot cross the server → client boundary.

## 2. Files and what changed

### 2.1 `src/components/icons/marks.tsx` (new — 33 animated marks)

First-party animated SVG parts on Lucide's own 24×24 geometry (same path data the
app already renders, ISC/`lucide-react`), so nothing changes size or silhouette.
Each part is a `motion.*` element declaring `rest / hover / focus / active`
variants; Framer's variant propagation drives them from the host, so the marks
take **no props and no timers**. `part()` guarantees all four labels exist (a
missing label is how a part gets stuck in its last pose).

Signature marks: `stamp` (die lifts, then drives down), `sun` (eight rays extend
along their own vectors), `search` (lens draws, handle pulls), `gauge` (needle
sweeps on a `transform-box: view-box` pivot), `rotate-ccw` (one full turn back),
`menu` (bars compress), `flame` (one finite flicker), `crown`, `trophy`,
`landmark`, `layers`, `sparkles`, `zap`, `chart` bars, `medal`, `gift`, `gem`,
`ghost`/`skull`/`user`/`star`, `palette`, `ban`, `eye`, `rocket`, `pen-line`,
`book-open-text`, `badge-check`/`shield-check` (check draws), `log-out`,
`layout-dashboard`, `move-right`/`arrow-right`.

Two geometry rules were applied so no part clips the view box: pivots are
declared explicitly (`fill-box` for a part's own box, `view-box` for a point in
the drawing), and every travel distance was checked against the stroke radius
(0.875 units at `strokeWidth 1.75`).

### 2.2 `src/components/icons/registry.tsx` (new)

The join between a Lucide glyph and its mark: `markForIcon(icon)` is a `Map`
keyed by component identity (client call sites keep passing `icon={Stamp}`), and
`iconForMark(name)` resolves the string form.

### 2.3 `src/components/icons/mint-icon.tsx` (new)

`<MintIcon name="gauge" />` — the server-component door into the same animated
icon. `name` is a string, so it crosses the RSC boundary; the resolution happens
on the client. `name` is typed as the registry union, so a typo fails `tsc`.

### 2.4 `src/components/ui/animated-icon.tsx` (rewritten, API preserved)

Props unchanged (`icon`, `className`, `idiom`, `active`, `hovered`,
`strokeWidth`); existing call sites compile untouched.

- **Real parts.** If the icon has a mark, `AnimatedIcon` draws the mark inside
  its own `<svg>` (same stroke props) and the host span holds still, so only the
  parts move. Unregistered icons keep the four whole-glyph idioms, which gained a
  `focus` label so the state machine has no missing keys.
- **Hover and keyboard focus both work.** On mount the component finds the
  *control the icon belongs to* (`closest("a, button, [role=button], summary,
  label, input")`) and listens for `pointerenter/leave`, `pointerdown/up/cancel`
  and `focusin/focusout` on it. Focus only engages when the host actually matches
  `:focus-visible` (guarded in `matchesFocusVisible`, so a mouse click does not
  read as focus), which is exactly the keyboard effect the old version lacked.
- **Tap feedback** is the `pointerdown → active` state (plus the existing button
  `whileTap`), and it still works in `hovered`-controlled mode (sidebar rows).
- **No nested interactivity.** The wrapper stays an `aria-hidden` span; the
  registry only ever renders `motion.path/circle/rect`. Asserted in tests.
- **Reduced motion.** `useReducedMotion()` (coerced: `prefersReduced === true`,
  which is the `boolean | null` fix) short-circuits the listeners, pins the label
  to `rest`, and passes `reduced` into the marks so stroke draws (`pathLength`,
  `pathOffset`) do not run either — Framer's `reducedMotion="user"` only strips
  transforms, not draws, so this needed an explicit gate. `MotionConfig` in
  `providers/motion-provider.tsx` and the global reduced-motion CSS still stand
  as the second and third layers.

### 2.5 `src/components/ui/mint-motion.tsx` + `mint-motion.module.css` (new)

- **`Reveal`** — staggered section entry that is *visible by default*. It arms an
  element only **after the first paint and only when that element starts below
  the fold** (`getBoundingClientRect().top < innerHeight * 0.92` → leave it
  alone). Arming is a `classList.add` inside the effect, not React state, so the
  `react-hooks/set-state-in-effect` class of error cannot come back, and the SSR
  HTML / no-JS output is never hidden. An `IntersectionObserver` disarms it once
  and disconnects. `prefers-reduced-motion` returns before arming; the module CSS
  also neutralises `.armed` under the media query.
- **`HeroSpecimen`** — the dimensional hero artwork and the finite press
  choreography. A struck collar (hairline, inner highlight, contact shadow) holds
  the coin inside a real `<button type="button">` with `aria-describedby`; a
  decorative impact ring sits behind it (`opacity: 0` at rest, so nothing is
  hidden); the specimen receipt is a sibling, so there is no interactive element
  inside a control. Pressing (or Enter/Space) runs one sequence: the die drives
  down (0.09s), springs back, the ring expands and fades (0.62s). The paper
  re-mounts keyed on the press count, so `animate-strike` and the two settled
  brass rules replay, the serial advances through a **deterministic** list
  (`#0048213 → #0048214 → #0048219 → #0048221`), and the "Struck" overprint
  stamps in. Nothing is random, nothing loops. An `aria-live` region announces
  the new serial; the coin settles once on mount with a transform-only keyframe
  (no opacity, so the hero can never be blank); under reduced motion the coin
  stays still and only the serial/overprint change.

### 2.6 `src/app/page.tsx`

- Hero's static receipt replaced by `<HeroSpecimen rows={specimenRows}
  total={1600} serials={specimenSerials} />` (same specimen content, same
  honesty caption) inside a `Reveal`.
- Every section wrapped in `Reveal` with index-based delays (80/90/120ms) and
  `h-full` where equal-height plates matter. All copy, all claims, the real
  `AURA_TIERS` ladder, ₹0/₹99 and the enforced "5 logs a day" are unchanged.
- **Real icons everywhere**: facts, premium feature ledger (both plates),
  annotation list, hero CTA, final CTA and the hallmark stamp now use
  `<MintIcon name=... />`; the four fact/premium/annotation icon lists are typed
  `MarkName[]`, so the names are checked at compile time (16 unique names).

### 2.7 `src/components/layouts/**`

- `site-header.tsx`: menu trigger and the sheet's "Start free" use `AnimatedIcon`
  (`Menu` press, `Sparkles` strike); the sheet nav gained per-destination
  animated marks; nav items still animate on hover *and* focus because the icon
  listens to its own `<a>`.
- `sidebar.tsx`: `Stamp`, `Search`, `LogOut` and the streak `Flame` are now
  `AnimatedIcon`s (nav rows already were, and now carry real parts: dashboard,
  trophy, chart, medal, gift, user, gem). `hovered`-controlled hover is
  preserved, press feedback added.
- `bottom-nav.tsx`: the centre LOG button and the "You" trigger are
  `AnimatedIcon`s with `focus-visible` rings and `motion-reduce:` on the tap
  transform; sheet links use `AnimatedIcon` (`slide`).
- `site-footer.tsx`: deliberately unchanged — no interactive icon affordances
  there, and the footer is the calm end of the page.

### 2.8 `src/components/ui/assay-demo.tsx`

Strike and Clear buttons use the `stamp` and `rotate-ccw` marks; the struck
receipt gained a `Struck` overprint (finite `animate-plate-in`) and a settled
rule. The busy `Loader2` spinner is untouched — a pending action is the one place
a spinner is honest.

## 3. Constraints honoured

No cursor followers, no shimmer, no tint/blur overlays, no constant spinning, no
infinite loops: every animation is finite and provoked by entry, hover, keyboard
focus or press. The existing `animate-*` classes and the global reduced-motion
block are the only global-CSS dependency, and `globals.css` was not edited. The
one new stylesheet is scoped (`mint-motion.module.css`).

## 4. Evidence

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **exit 0, zero errors project-wide** (the `Mark reduced={reduceMotion}` `boolean \| null` error was hit and fixed by coercing `useReducedMotion()`; `tsc` is clean) |
| Lint (all source) | `npx eslint src` | **exit 0, no diagnostics** |
| SSR render tests | `node --test _audit/motion-tests.mjs` | **8 passed, 0 failed** |
| Dev-server SSR (no browser) | `npx next dev -p 3499` + `curl /` | **200**, 153,740 bytes; `/login` 200, `/signup` 200, `/dashboard` 307 (unauthenticated, as before); **no errors or warnings in the dev log** |

Rendered-HTML assertions on `/` (all present): `hero-press-note` (id +
`aria-describedby`), `auramint-coin.svg`, `Struck`, `#0048213`,
`Specimen · today's ledger`, `awaiting first strike`, `aria-live="polite"`,
`transform-box:view-box` ×7, `fill-box` ×92, `pathLength` ×5 (the stroke-draw
parts really are in the server HTML because Framer writes the initial values),
`MintIcon` crown geometry `M11.562 3.266`, stamp geometry, `reveal` ×28.
**Absent**, as required: `style="opacity:0"` (nothing is hidden) and the `armed`
class (no pre-reveal state in SSR).

`_audit/motion-tests.mjs` covers: a registered icon emits its own parts and no
nested control; an unregistered icon keeps the plain glyph; draw-type marks emit
`pathLength`; `MintIcon` resolves by name; every name used by the page exists in
the registry; `HeroSpecimen` SSRs the whole receipt visible with a real button
and an empty live region; `Reveal` renders children visible; the landing keeps
`5 logs a day` / `₹0` / `₹99` / `AURA_TIERS` and still contains none of the
fabricated metrics.

## 5. Known limits (for main's build + manual pass)

1. Not verified in a real browser: focus-visible engagement, the press sequence's
   timing feel, `:has`-free hit areas and the CSS-module cascade are pinned by
   static evidence only. `next build` was not run (per instruction) — main's build
   gate is still required.
2. The mark registry only animates the 33 named icons it covers; any other Lucide
   glyph falls back to the whole-glyph idioms (by design, visible in tests).
3. `Reveal` arms below-fold content after paint. If a visitor scrolls a
   *pre-armed* section into view during hydration the section fades in — that is
   the intended reveal, and reduced motion skips arming entirely.
4. `theme-toggle.tsx` and `step-line.tsx` were not edited (outside the file
   scope); `step-line` already gained the animated parts through its existing
   `AnimatedIcon` usage.
