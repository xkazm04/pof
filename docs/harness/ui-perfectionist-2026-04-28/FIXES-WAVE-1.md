# UI Perfectionist — Wave 1 Fix Summary

> 6 commits, primitives ready for wave 2/3 adoption.

## Commits

| # | commit  | finding                              | file changed                                                  |
|---|---------|--------------------------------------|---------------------------------------------------------------|
| 1 | a5e53d9 | 29.1 + 26.5 (Button / WizardButton)  | src/components/ui/Button.tsx (+ 4 wizard panels, -WizardButton.tsx) |
| 2 | 4c90d50 | 29.3 (motion taxonomies)             | src/lib/motion.ts                                             |
| 3 | 5dceeca | 29.5/29.6 (chart-colors opacity)     | src/lib/chart-colors.ts                                       |
| 4 | f562702 | 10.1 (DZIN_TOKENS / CSS contract)    | src/lib/dzin/core/theme/tokens.ts, src/lib/dzin/core/theme/state.css |
| 5 | 6bf94ae | 11.1 (DZIN_SPACING.compact)          | src/lib/dzin/animation-constants.ts                           |
| 6 | f70cc94 | 29.4 (Card re-export)                | src/components/ui/Card.tsx (deleted)                          |

## What was fixed

**Fix 1 — Button completes WizardButton's API.** The shared `Button` had no
`disabled` styling, no `loading` state, no icon slot, and no semantic intent. The
project-setup wizard had forked it as `WizardButton`. We folded WizardButton's
API into `Button` (intent: `primary | danger | warning | info`, `loading +
loadingLabel`, `leftIcon + rightIcon`, baked-in `disabled:opacity-40
disabled:cursor-not-allowed`, `aria-busy`), migrated all 4 WizardButton call
sites, and deleted the fork.

**Fix 2 — motion.ts has one canonical taxonomy.** Four overlapping motion-config
systems (DURATION/SPRING/STAGGER/EASE_OUT, MOTION_CONFIG, ANIMATION_PRESETS) had
conflicting numbers — three different "snappy" springs, two different "standard
entrance" easing curves. Pick `DURATION + EASE_OUT/EASE_FILL + SPRING + STAGGER`
as canonical. `MOTION_CONFIG` and `ANIMATION_PRESETS` are kept as `@deprecated`
aliases re-pointing at the canonical tokens; consumer surface keeps working but
the source-of-truth no longer disagrees with itself.

**Fix 3 — chart-colors opacity scale slimmed.** Cull 19 near-overlapping opacity
tokens to a 6-stop canonical scale (`OPACITY_5/10/20/40/60/80`) plus the
`OPACITY_0` endpoint. Off-grid tokens (`OPACITY_22/37/56/87`) become deprecated
aliases pointing at the nearest canonical stop. Mid-grid tokens
(`OPACITY_2/3/4/6/8/12/15/25/30/50/90`) are kept with literal values preserved
but marked `@deprecated`. No consumer call-site rewrites in this commit — that
is wave 2's adoption work.

**Fix 4 — DZIN_TOKENS reflects the CSS contract.** `state.css` had hard-coded
`#06b6d4` fallbacks for `--dzin-accent` (LLM highlight + typewriter cursor) that
silently broke custom themes overriding only the accent var. Drop the fallbacks
(the variable IS the contract). Document the alias policy in `tokens.ts` (prefer
`surface*` overrides for global retheme, `panel*` only for component-specific
exceptions) and the density-shadowing of `--dzin-panel-header-height`.

**Fix 5 — DZIN_SPACING.compact and .micro symmetric with .full.** `compact`
exposed only `wrapper + divider`; `micro` exposed only `wrapper`. Add the
symmetric token set to `compact` (`card`, `gap`, `gridGap`, `sectionMb`,
`contentMt`, `pipelineMt`) at ~75-80% scale of full, and the `card + gap` pair
to `micro`. Compact-density panels now have token-driven spacing instead of
inline magic numbers.

**Fix 6 — Card re-export deleted.** `src/components/ui/Card.tsx` was a 3-line
re-export `{ SurfaceCard as Card }` with zero importers (1242 callers go
directly to `SurfaceCard`). Delete it; `SurfaceCard` is the canonical card
primitive.

## Patterns established (catalogue items 1-6)

1. **Button is the single button primitive.** No fork. Variant (visual treatment)
   and intent (semantic colour) are orthogonal props; loading and icons are
   first-class slots; disabled has baked-in styling.

2. **Motion timing has one canonical token set.** `DURATION + EASE_OUT/EASE_FILL
   + SPRING + STAGGER` is the source of truth. `MOTION_CONFIG` /
   `ANIMATION_PRESETS` survive as `@deprecated` aliases pointing at canonical
   tokens — never extend them; new code uses canonical.

3. **Chart-color opacity scale is 6 canonical stops.** `OPACITY_5/10/20/40/60/80`
   are the canonical scale (plus `OPACITY_0` endpoint). All other opacity tokens
   are `@deprecated`. New code lands on the canonical six.

4. **DZIN tokens are CSS-var-backed and contract-explicit.** The JS map is var
   *names*, not values. Hex fallbacks in `state.css` are removed — overriding
   `--dzin-accent` is enough to retheme. Alias policy is documented in
   `tokens.ts`.

5. **DZIN_SPACING is symmetric across densities.** All three density buckets
   (`micro | compact | full`) expose the same spacing role names so consumer
   panels pick them up uniformly.

6. **SurfaceCard is the canonical card primitive.** No second-name re-export
   alias; consumers go direct. (Compound subcomponents `.Header/.Body/.Footer`
   remain a wave 2/3 follow-up if and when adopted.)

## What remains

Consumer adoption (other-wave fixes) lands these primitives in waves 2-3:

- Wave 2 will rewrite chart-colors call sites off the `@deprecated` opacity
  tokens onto the canonical six.
- Wave 2/3 will progressively migrate `MOTION_CONFIG` / `ANIMATION_PRESETS`
  consumers onto the canonical motion tokens.
- Wave 2 will sweep compact-density panels for inline `p-2`/`gap-2`/`mb-2`
  literals and route them through the new `DZIN_SPACING.compact.*` tokens.
- Wave 3 may extend `Button` with intent-driven hero variants if the project-
  setup audit (finding 26.5 hero CTA) demands it.
