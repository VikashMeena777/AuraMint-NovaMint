# UI final pass — Analytics

Scope of this pass: `src/app/(app)/analytics/page.tsx` only.
`src/components/ui/aura-number.tsx` was **not** edited in this pass (sign semantics were already
repaired and verified by the main agent before this resumed). No build was run, no browser was used,
and no live/mutating action was performed against Supabase.

---

## 1. Files changed

| File | Change |
| --- | --- |
| `src/app/(app)/analytics/page.tsx` | Full re-skin onto the Mint plate/primitives system; polarity, honesty and a11y repairs |
| `_audit/ui-final-pass.md` | This evidence file |

Nothing else was written. In particular `src/components/ui/aura-number.tsx`,
`src/components/aura/mint.ts`, `src/components/aura/primitives.tsx` and
`src/components/ui/animated-icon.tsx` are read-only dependencies here.

---

## 2. Defect: zero trend day treated as a win

**Before** (`page.tsx`, pre-pass):

```tsx
const isPositive = day.net >= 0;                 // zero takes the positive branch
...
isPositive
  ? "bg-emerald-500/60 group-hover:bg-emerald-500"
  : day.net === 0
    ? "bg-muted-foreground/20"                   // unreachable: >= 0 already caught zero
    : "bg-red-400/60 group-hover:bg-red-400"
```

`net >= 0` made the `day.net === 0` neutral branch dead code, so a day with no net movement was
painted in the win hue (and, in the tooltip, coloured as a win).

**After**: polarity is decided once, in one place, with zero as its own case:

```tsx
function trendPolarity(net: number): Polarity {
  if (net > 0) return "positive";
  if (net < 0) return "negative";
  return "neutral";
}
```

Every consumer (bar fill, tooltip ink, stat-card tone, net/avg icons) reads from `trendPolarity`, so
the `>= 0` shortcut cannot return through a second call site. Zero-day bars render in the lead hue at
a 2% floor, so "no movement" is visible rather than absent.

The win-rate stat and its icon follow the same rule: a net of exactly `0` uses `Activity` and the
lead tone, not `TrendingUp` / patina.

## 3. Defect: win/loss percentages were taken from a different denominator than the labels

**Before**: the labels printed `stats.totalWins` / `stats.totalLosses`, but the two bars were sized
from `stats.winRate` and `100 - stats.winRate`, where `winRate` is computed over **all** events
(including zero-point ones) while the labels count only the adapter's win/loss buckets. With any
zero-point entries present the printed counts and the drawn percentages disagreed.

**After**: shares are derived from the same counts the labels print:

```tsx
const scoredOutcomes = stats.totalWins + stats.totalLosses;
const hasScored = stats.totalGain > 0 || stats.totalLoss > 0;
const winShare  = hasScored ? (stats.totalWins  / scoredOutcomes) * 100 : 0;
const lossShare = hasScored ? (stats.totalLosses / scoredOutcomes) * 100 : 0;
```

Each bar is captioned with its own percentage and the plate notes the scored-entry count, so the
figures are self-consistent.

## 4. No-data honesty

* **Win rate** reads an em dash (`—`), not `0%`, when there is no scored outcome.
* **Win/loss split**: when nothing has been scored yet, the plate prints honest copy instead of
  drawing two empty rails — "Every entry so far landed on zero, so there is no win or loss share to
  report yet." or "No scored entries yet — log a win or a loss to see the split."
* **Category breakdown**: an empty `categoryBreakdown` now prints "No categorised entries yet.
  Categories appear once events carry one." instead of rendering an empty `<ul>`.
* A redundant closing "best case / worst case" line was removed; with zero losses it would have read
  "worst case 0", which is not a fact about the ledger.

## 5. Keyboard-accessible trend detail

The 30-day trend previously exposed its values only through a CSS `group-hover` tooltip — invisible to
keyboard and screen-reader users, and unreachable on touch.

* Each day is now a real `<button type="button">` carrying an accessible name built from the day,
  its net and its event count (`dayAriaLabel`): e.g. *"Sep 3: loss of 120 aura, 4 events"*. Zero and
  empty days have their own wording ("no net change" / "no events logged") rather than a sign.
* The tooltip becomes visible on `group-hover` **and** `group-focus-within` (the wrapper carries
  `group`), so tabbing the chart reveals the same detail the pointer gets. Tooltip content is
  `aria-hidden` because the button's name already carries it — no double announcement.
* A visual readout below the chart mirrors the focused/hovered day, and a `<details>` disclosure
  provides a full 30-row `<table>` text alternative (day / gain / loss / net / events) with a
  `<caption>` and `scope` on both header and row cells.
* The chart wrapper is `role="group"` with `aria-label="Daily net aura for the last 30 days"`.
* The trend plate opts out of the primitive's `overflow-hidden` (`className="overflow-visible"`) so
  the tooltip is never clipped at the plate edge.

## 6. Mint semantics and typography

* `.glass-card` is gone; surfaces are the `Plate` primitive from
  `src/components/aura/primitives.tsx` (`bg-card border border-border/70 shadow-sm`).
* Emerald/red gradients removed. Polarity now uses the metals only: patina
  (`#1F6F5C` / dark `#2E9E7A`) for wins and positive net, oxide (`#B4442E` / dark `#E0795F`) for
  losses and negative net, lead for neutral, brass (`#8A6E14` / dark `#C9A227`) reserved for the
  premium chip and the crown/prestige highlight.
* Category bar fills moved to the third hue, engrave (`#1B3A5C` / dark `#5C8DB5`), because those
  bars encode volume, not direction. The seven hardcoded category hexes (rose/blue/violet/emerald/
  amber/pink/indigo) are deleted; category identity now comes from the `categoryMeta` Lucide marks
  in `mint.ts`, and the rainbow emoji map is gone (emoji are not used for system meaning in this
  design).
* Typography: the `text-[9px]` / `text-[10px]` micro sizes are replaced by `SectionLabel` (11px
  micro) and 12/14/20px body and figure sizes; figures use `AuraNumber`.
* Copy: "Your cosmic performance dashboard" → "Every strike and write-off on your ledger, assayed
  over the last 30 days." Empty and error states use Mint ledger language.

## 7. Consistent `AuraNumber` and `AnimatedIcon` usage

Figures that are aura values now render through the shared number renderer (the
`@/components/aura/aura-number` adapter over `@/components/ui/aura-number`), which owns sign,
grouping and polarity ink: net aura and average points (size `md`), total gain, total loss, category
totals, highlight points, and each row of the trend table (size `sm`).

* Balances are not this page's business; the only balances on the page are `profile.total_aura`,
  which is not rendered here.
* Total loss is passed as `-Math.abs(stats.totalLoss)` so the minus is real and not a decorative
  glyph — consistent with the repaired shared sign rule.
* The two neutral cases (`netAura === 0`, `avgPoints === 0`) pass
  `colorClassName="text-muted-foreground"` explicitly, overriding the shared component's
  arbitrary-value neutral class with the semantic token (see §9.1).
* `AnimatedIcon` is used for the stat, category, boost and highlight marks with the sanctioned
  idioms (`press`, `strike`, `nudge`). Stat icons are controlled: the card tracks its own hover and
  passes `hovered`, so the icon motion is driven by the plate being hovered, not by hovering the
  16px glyph.

## 8. Motion with a reduced-motion contract

`useReducedMotion()` is read once as `reducedMotion`. Every reveal, bar growth and icon transform is
guarded:

```tsx
initial={reducedMotion ? false : { opacity: 0, y: 8 }}
transition={reducedMotion ? { duration: 0 } : { duration: 0.28, delay: i * 0.04, ease: "easeOut" }}
```

With reduced motion the elements are painted at their final state (`initial={false}`), bar widths and
heights jump straight to value, and `framer-motion`'s own `useReducedMotion` inside `AnimatedIcon`
drops its transforms. Motion is meaningful only: staggered plate reveals on entry, bar growth on
mount, icon response to hover/active. There are no loops and no decorative drift.

## 9. Verification

Commands run (no build, no dev server, no browser, no network mutation):

```text
npx eslint "src/app/(app)/analytics/page.tsx"              -> exit 0, no findings
npx tsc --noEmit --incremental false                       -> 1 error, 0 in analytics/page.tsx
```

### 9.1 Regression check on the shipped polarity function

No test runner is configured for this repo (`package.json` scripts are `dev`, `build`, `start`,
`lint` only; there is no vitest/jest/vitest config), and a Next.js page module may not carry the
extra named exports a test file would need. So the check extracts the *shipped source text* of
`trendPolarity` from `page.tsx`, evaluates it, and asserts the truth table — it exercises the real
function body rather than a re-typed copy:

```text
shipped trendPolarity(0) = neutral
old >=0 rule      (0) = positive
trendPolarity truth table OK (5 cases)      # 150 -> positive, 1 -> positive,
                                            # -40 -> negative, -1 -> negative, 0 -> neutral
```

This is the zero-day defect pinned as an executable assertion: the shipped rule and the old
`>= 0` rule are evaluated side by side and must differ at `0`.

Structural sweep of the rewritten file (all must be absent):

```text
grep -nE "glass-card|glass|cosmic|emerald|red-400|red-500|violet|indigo|text-\[9px\]|text-\[10px\]|formatAuraPoints|categoryColors|categoryEmojis|isPositive|100 - stats"
  -> NONE FOUND
```

### 9.2 Test and build caveats

* **No committed test file was added.** Adding one would require touching files outside this pass's
  ownership, and there is no runner for it to execute. See §10.4.
* **No build was run**, per instruction, and none is needed to validate this change: the page has no
  new dependency, no route or data-fetch change, and the mutation surface is unchanged.

## 10. Unresolved points

### 10.1 Shared neutral ink still bypasses the semantic token

`src/components/ui/aura-number.tsx` still colours the neutral case with
`text-[hsl(var(--muted-foreground))]` rather than the semantic `text-muted-foreground` class. It was
out of scope for this pass, so it is unfixed there.

Two notes for whoever picks it up:

* The premise in the task brief ("vars are oklch") does not match this codebase. In
  `src/app/globals.css`, `--muted-foreground` is an HSL triplet (`80 8% 34%` light, `51 8% 64%`
  dark) and `@theme` maps the utility as `--color-muted-foreground: hsl(var(--muted-foreground))`.
  So `hsl(var(--muted-foreground))` does compute, and the neutral case is not visibly broken — it is
  a semantic-duplication and single-source-of-truth problem, not a rendering failure.
* The fix is one class swap (`text-[hsl(var(--muted-foreground))]` → `text-muted-foreground`).
  Within this page's scope the two reachable neutral cases are already overridden at the call site
  via `colorClassName` (§7), so Analytics renders correctly either way.

### 10.2 Zero-point events are counted as wins by the adapter (not owned here)

`getAnalyticsData` in `src/lib/actions/aura-actions.ts` classifies with `points >= 0` for wins in
three places (daily gain bucket, category `wins`, and the `wins`/`losses` split). A ledger of only
zero-point entries therefore yields `winRate === 100` and `totalWins === totalEvents` from the
adapter.

This page now refuses to draw a share from it (`hasScored` gate, §3/§4), so Analytics is honest. The
underlying rate is still ≥0-biased for every other consumer that reads `stats.winRate`. The real fix
belongs in the adapter, which is outside this pass's ownership.

### 10.3 A sibling file has a type error introduced outside this pass

```text
src/components/ui/animated-icon.tsx(183,17): error TS2322:
  Type 'boolean | null' is not assignable to type 'boolean | undefined'.
```

`<Mark reduced={reduceMotion} … />` passes `useReducedMotion()`'s `boolean | null` into a prop typed
`boolean`. `reduced={Boolean(reduceMotion)}` (or `?? false`) resolves it. That file is owned by the
animated-icon workstream and is being edited concurrently — it was 76 lines when this pass read its
API and is now 183+. It was deliberately **not** edited here.

Effect on this pass: none. `tsc` reports `0` errors in `analytics/page.tsx`, and the `AnimatedIcon`
props this page uses (`icon`, `idiom`, `hovered`, `className`) typecheck against the current file.
Effect on the repo: `tsc --noEmit` is not clean until that one line is fixed, so a build gate would
fail on it rather than on Analytics.

### 10.4 No isolated regression harness for UI logic

The polarity check in §9.1 evaluates the shipped source, but it is an ad-hoc command recorded here,
not a committed test. A durable option — once test files are in scope — is to lift `trendPolarity`
(and the share maths) into a small pure module and cover it with a real runner. Until then, this
document is the record of the check.

### 10.5 Percentages are rounded to integers

`winShare` / `lossShare` are rendered with `Math.round`. Two small shares can therefore both display
`0%` while the counts beside them are non-zero, and the pair may not sum to exactly 100. This is a
presentation choice (integer percentages on a compact plate) and not a data error — both shares are
still computed from the same denominator (§3). If an exact complement is ever required, round one
share once and print the other as `100 - rounded`, so the two always add up.
