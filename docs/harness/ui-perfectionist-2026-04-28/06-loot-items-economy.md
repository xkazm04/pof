# UI Perfectionist — Loot, Items & Economy

> Context: Loot, Items & Economy (Core Engine (aRPG))
> Files read: 19
> Total: 9 — Critical: 1, High: 4, Medium: 3, Low: 1

## 1. Rarity colour scale forks across three sibling tabs
- **Severity**: Critical
- **Category**: design-system
- **File**: src/components/modules/core-engine/unique-tabs/LootTableVisualizer/data.ts:37-43, src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/constants.ts:17-23, src/components/modules/core-engine/unique-tabs/AILootDesigner/constants.ts:38-44
- **Scenario**: A user toggles between Loot Table Visualizer, Item Economy Simulator, AI Loot Designer, Item Catalog, and Affix Crafting Workbench. The five rarity tiers (Common…Legendary) are visually re-coloured in each tab. LootTableVisualizer maps `Rare = STATUS_INFO` (blue), AILootDesigner agrees, but ItemEconomySimulator binds `rare = MODULE_COLORS.core`, which renders rare items in the core-module accent (orange-ish) instead of blue. Even more jarring: the legend dot on a Trading Card and the legend dot on a Rarity Stack chart can disagree side-by-side.
- **Root cause**: There is no shared `RARITY_PALETTE` / `getRarityColor()` token. Each unique-tab redeclares its own `RARITY_COLORS` record from `chart-colors` primitives; some maps are typed `Record<Rarity, string>` (`'Common'…`) and others `Record<ItemRarity, string>` (`'common'…`), so a unified helper never emerged.
- **Impact**: Breaks the single most load-bearing semantic axis in an aRPG UI — players read rarity by colour. Also breaks data viz: a Rare drop in the treemap, a Rare bar in RarityStackChart, and a Rare card in the catalog will show as three different hues, undermining cross-tab calibration. This is the kind of inconsistency a designer would catch in 5 seconds of side-by-side review.
- **Fix sketch**: Promote a single source: `src/lib/rarity-palette.ts` exporting `RARITY_PALETTE: Record<Rarity, { color, glow, label, weight }>` plus `getRarityColor(name)`. Normalise on capitalised names, with a `toRarityKey()` helper for the lowercase `ItemRarity` variants. Replace the three local maps. Add a unit/visual-regression test pinning the canonical palette so future diverges fail loudly.

## 2. EconomySimulatorView bypasses the chart-colors token system entirely
- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/evaluator/EconomySimulatorView.tsx:33-54, 103-178, 339-567
- **Scenario**: While every sibling visualizer (PowerCurveChart, RarityStackChart, AffixHeatmap, DropTreemap, WeightDistribution, TradingCard) consumes `ACCENT_*` / `STATUS_*` / `withOpacity()` from `@/lib/chart-colors`, the headline Economy Simulator view is wall-to-wall hard-coded Tailwind classes: `bg-amber-500/10`, `border-amber-500/30`, `text-amber-400`, `bg-emerald-400/40`, `text-violet-400`, `text-red-400`, `bg-blue-400/10`. The header ring uses a hard `bg-gradient-to-br from-amber-500/20 to-orange-500/20`.
- **Root cause**: This view was authored against raw Tailwind palette utilities, then SurfaceCard/Badge primitives were added later but the chart-color tokens never replaced the literals. `SEVERITY_STYLE` is a literal table of nine Tailwind class strings that duplicates `ALERT_COLORS` already declared in `ItemEconomySimulator/constants.ts`.
- **Impact**: Theme changes (dark/light, brand re-skin) cannot reach this view. Any tweak to `STATUS_WARNING` updates every other chart but leaves the Economy view stuck at amber-400. The "amber/red/emerald/violet" vocabulary collides with the rarity legend below it.
- **Fix sketch**: Replace literal Tailwind colour utilities with the project's CSS variables (`text-status-warning`, etc.) or inline `style={{ color: STATUS_WARNING }}`. Move `SEVERITY_STYLE` to a shared `severity-tokens.ts` consumed by both this view and `AlertCard`. Reuse `ItemEconomySimulator/constants.RARITY_COLORS` for rarity dots.

## 3. Three different chart axis/grid implementations across the four visualizers
- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/PowerCurveChart.tsx:46-114, src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/RarityStackChart.tsx:21-66, src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/AffixHeatmap.tsx:31-79, src/components/modules/evaluator/EconomySimulatorView.tsx:322-497
- **Scenario**: PowerCurveChart hand-rolls SVG axes with `pad = { top: 20, right: 20, bottom: 30, left: 50 }`, `fontSize: 11`, grid at 25% intervals. RarityStackChart uses a different pad (`{10, 20, 25, 40}`), shares `fontSize: 11` but renders no grid. AffixHeatmap uses `cellSize: 22`, `labelW: 50`, no axes. The Economy Simulator's GoldFlowChart, WealthDistributionChart, and SupplyDemandSection skip SVG entirely and use stacked Tailwind divs (`flex items-end`, `h-32`, `h-20`, `h-28`) for bar charts — three different hard-coded chart heights for charts of equivalent semantic weight.
- **Root cause**: No `<ChartFrame>` / `<ChartAxis>` / `<ChartBar>` primitive exists. Each chart re-implements padding, tick labels, gridlines, legend chips, and tooltip popovers from scratch.
- **Impact**: Visual inconsistency between adjacent panels; reading two charts requires re-anchoring the eye to a new tick density and font size. Tooltip behaviour also drifts: PowerCurve has none, GoldFlow has a `hidden group-hover:block` div, AffixHeatmap uses `<title>`, RarityStack uses `<title>`. Also doubles the maintenance cost of any axis tweak.
- **Fix sketch**: Extract `<ChartFrame width height pad>` plus `<XAxis ticks tickFormat>` / `<YAxis>` / `<GridLines>` / `<ChartTooltip>` into `components/charts/`. All four visualizers consume them. Tooltips standardise on a single `<DataTooltip>` component (the SurfaceCard-styled one in GoldFlowChart is the best base). Bar widths compute from the frame, not magic-number `h-32`/`h-20`/`h-28`.

## 4. AffixCraftingWorkbench has two divergent definitions of category colour
- **Severity**: High
- **Category**: visual-consistency
- **File**: src/components/modules/core-engine/unique-tabs/AffixCraftingWorkbench/constants.ts:67-79
- **Scenario**: `CATEGORY_COLORS.defensive = ACCENT_EMERALD` (green) but the function `getCategoryColor('defensive')` returns `STATUS_INFO` (blue) on line 77. Components that read the map directly (e.g. category dots in pool filters) will paint a defensive affix green; components that call the helper (`AffixPoolPanelProps.getCategoryColor` consumer) paint the same affix blue on the same screen.
- **Root cause**: Helper was added later as an "ergonomic accessor" without keeping it in sync with the map; the helper also flips `utility` from `ACCENT_CYAN` to `ACCENT_EMERALD`, so the contradiction is two-axis.
- **Impact**: Inside a single tab, an affix chip and an affix pool row can disagree on category colour. Defeats colour-as-classification for the workbench's primary categorisation.
- **Fix sketch**: Delete `getCategoryColor`, point all consumers at `CATEGORY_COLORS[cat]`. Or invert: keep the helper, have the map call it. Add a TS test (`expect(getCategoryColor(k)).toBe(CATEGORY_COLORS[k])` for every key) to lock parity.

## 5. TraitSlider is a bespoke range-input rebuild that won't compose with the rest of the slider surface
- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/ItemDNAGenomeEditor/TraitSlider.tsx:12-82
- **Scenario**: Genome editor uses a hand-built slider: invisible native `<input type="range">` overlaid on a `NeonBar`, plus a tracked thumb `<motion.div>` positioned via `left: calc(${pct}% - 5px)`, plus a separate `<input type="number">` mirror, plus tag chips. Every other tab in the loot/economy surface (DropSimulator, ItemEconomySimulator config, AffixCraftingWorkbench) uses different slider patterns or none. There is no shared `<Slider>` primitive.
- **Root cause**: NeonBar was treated as a render layer rather than wrapped in a slider primitive; the focus ring is a manual `outline + outlineOffset` keyed off a `:focus-visible` check inside `onFocus`.
- **Impact**: Keyboard semantics drift (the manual focus visibility check is fragile under shift-tab and programmatic focus), screen-reader users get no `aria-valuemin/max/now` because the native input is `opacity-0` without an `aria-label`. The number-input mirror clamps but doesn't re-emit on blur for `NaN` cases, leaving stale values briefly. Adding sliders elsewhere will mean re-creating this same scaffolding.
- **Fix sketch**: Build `<TokenSlider value min max step color label suffix onChange>` in `components/ui/`. It owns: track, NeonBar fill, accessible native input with `aria-label` + `aria-valuetext`, animated thumb, optional numeric mirror, focus ring. Replace TraitSlider with `<TokenSlider color={config.color} suffix="%" label={config.label}>`. Reuse in DropSimulator (rollCount), Economy config, pity threshold input.

## 6. Hard-coded SVG dimensions break responsive at small viewports
- **Severity**: Medium
- **Category**: responsive
- **File**: src/components/modules/core-engine/unique-tabs/LootTableVisualizer/simulation/DropTreemap.tsx:23, src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/PowerCurveChart.tsx:16-17, src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/RarityStackChart.tsx:14-15, src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/AffixHeatmap.tsx:26-29, src/components/modules/core-engine/unique-tabs/ItemDNAGenomeEditor/DNAStrand.tsx:13-15
- **Scenario**: SVG charts declare fixed `width={520}` / `width={260}` / `width=120` etc. PowerCurveChart and RarityStackChart use `className="w-full"` on the SVG so the viewBox scales — but DropTreemap caps at `max-w-[260px]`, AffixHeatmap relies on horizontal scroll, and DNAStrand is fixed `260×120` with no responsive wrapper. The treemap text hide-thresholds (`rect.w > 30`) are computed against the unscaled coordinate system, so on small screens labels can be hidden when they'd actually render fine.
- **Root cause**: Each chart hand-picked a "comfortable laptop width" rather than measuring its container. No shared `useChartSize(ref)` hook.
- **Impact**: At narrow widths (sidebars open, split-view) the treemap becomes a postage stamp while the heatmap scrolls, breaking visual rhythm of the simulator scroll surface. DNAStrand will stretch oddly inside flex containers.
- **Fix sketch**: Add a `useResizeObserver`-based `useChartSize` hook that yields `{ width, height }` from the parent. Charts pick one dimension responsive (width) and scale internally. Treemap's label-visibility threshold then applies in pixel space after layout, not raw coords.

## 7. Drop Simulator chip row will wrap awkwardly because chips have no min/max width policy
- **Severity**: Medium
- **Category**: polish
- **File**: src/components/modules/core-engine/unique-tabs/LootTableVisualizer/simulation/DropSimulator.tsx:149-176
- **Scenario**: After a roll the five rarity result chips render via `flex flex-wrap gap-2` with each chip sized by content (label + count + deviation). On `1000` rolls every chip has a deviation suffix like `+12 above`; on `10` rolls many chips read `as expected`. Widths therefore differ by ~30-50px chip-to-chip, producing a ragged 2-line wrap on medium viewports. The chip uses `rounded-lg border` (8px radius) while every other chip in the surrounding tabs uses `rounded` or `rounded-md` (4-6px) — the radius drift is also visible.
- **Root cause**: No grid sizing; deviation label varies in length; radius chosen inline rather than from a chip token.
- **Impact**: Scanability of rarity totals suffers — eye must re-find the count in each chip after a wrap. Inconsistent radii read as visual noise.
- **Fix sketch**: Switch to `grid grid-cols-5 gap-2` (or `auto-fit minmax(120px,1fr)`); fix chip min-width via a `<RarityChip>` component pinned to `min-w-[140px]`. Standardise radius to `rounded-md`. Move chip into `_shared.tsx` so DropSimulator, MonteCarloSim, RollResultCard, and DropsPerHour all share it.

## 8. RollResultCard composes its own border + corner-bracket shell instead of a hover-only Card primitive
- **Severity**: Medium
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/ItemDNAGenomeEditor/RollResultCard.tsx:42-67, src/components/modules/core-engine/unique-tabs/ItemCatalog/catalog/TradingCard.tsx:38-97
- **Scenario**: RollResultCard renders affix entries each with `<CornerBrackets>` + `1px solid withOpacity(...)` + a coloured dot + name + value + tag — essentially the same chrome as TradingCardTooltip's affix list (lines 82-93) but coded independently with different opacities (`OPACITY_10` vs `OPACITY_8`), different paddings (`px-2 py-1` vs `px-2 py-1`), different radii (`rounded-md` vs `rounded-md`) but a different brackets-vs-no-brackets choice.
- **Root cause**: Affix-row visual is a recurring atom in the loot surface (DropSimulator results, DroughtCalculator legend, AffixPoolPanel rows, TradingCard tooltip, RollResultCard) but no `<AffixRow>` primitive exists.
- **Impact**: Five tabs render conceptually identical affix rows with five subtly different paddings, radii, and decoration sets; they feel like five different design languages instead of one game's UI.
- **Fix sketch**: Define `<AffixRow color name value tag mutation? brackets?>` in the ItemCatalog or a new `loot-atoms.tsx`. Migrate RollResultCard, TradingCard tooltip, AffixPoolPanel, and CraftLog to it. Document in `_design.tsx` so future tabs pick it up.

## 9. Rarity stat row "Avg per 100 kills" loses precision but copies the rate cell verbatim
- **Severity**: Low
- **Category**: polish
- **File**: src/components/modules/core-engine/unique-tabs/LootTableVisualizer/core/WeightDistribution.tsx:128-138
- **Scenario**: The drill-down detail grid prints `Drop Rate: 2.00%` and `Avg per 100 kills: 2` for a Legendary tier. With weight=2/100 the values are identical strings to the eye (`2`), making the "per 100 kills" cell informationally redundant. The "Affixes" cell can also overflow horizontally because the grid is `grid-cols-2` with no min/max-width on the right column.
- **Root cause**: Same `(weight / TOTAL_WEIGHT) * 100` formula re-used in adjacent rows without rephrasing for low weights; affixes string is a comma-join with no truncation.
- **Impact**: Drill-down feels low-effort; for a Legendary tier the panel reads as "2.00% / 2 / Godslayer" which is information-poor. On long affix lists (Common's 4 affixes) the row wraps and breaks the grid alignment.
- **Fix sketch**: Replace "Avg per 100 kills" with "Avg per 1 hour" using `DROPS_PER_HOUR_GAUGE.current * pct`, or "1-in-N" formulation (`1-in-50`). For affixes, render as wrapping chips (reuse the chip from finding 7) with `gap-1 flex-wrap`, optionally truncated with "+N more".
