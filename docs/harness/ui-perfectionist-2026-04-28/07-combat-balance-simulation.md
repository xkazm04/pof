# UI Perfectionist — Combat & Balance Simulation

> Context: Combat & Balance Simulation (Core Engine (aRPG))
> Files read: 14
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. CombatSimulatorView lives in a parallel design system from every other sim in this context

- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/evaluator/CombatSimulatorView.tsx:114-275
- **Scenario**: This view uses Tailwind named-color utilities (`text-red-400`, `bg-blue-400/10`, `bg-emerald-400/40`, `text-cyan-400`), `SurfaceCard`, `Badge`, `ProgressRing` and the `text-2xs` scale, while every sibling sim under `core-engine/unique-tabs/*` (GASBalance, Predictive, Choreography, Dodge, DamagePipeline) uses the `BlueprintPanel` / `SectionHeader` / `NeonBar` design language and constants from `@/lib/chart-colors`. Two combat-balance surfaces sit side-by-side in the product but read as different apps.
- **Root cause**: Evaluator was built against the generic UI kit before the chart-colors token system existed; it was never migrated. `SEVERITY_STYLE` and `colorMap` (lines 31-35, 482-486) hardcode Tailwind `*-400/10` arithmetic instead of using `STATUS_INFO/WARNING/ERROR` + `withOpacity`.
- **Impact**: Designers debugging combat balance flip between two visual idioms (panels, headers, severity colors, button styling all differ). Token changes won't propagate to this view.
- **Fix sketch**: Replace `SEVERITY_STYLE`/`colorMap` with `STATUS_*` token + `withOpacity(c, OPACITY_10)` style maps. Wrap sections in `BlueprintPanel`/`SectionHeader` (already imported across siblings). Replace ad-hoc `<input type="range" accent-amber-400>` with the shared `StatInput` component (10 sliders open-coded here). Reuse `NeonBar` for the AbilityHeatmap rows (currently a custom `<div className="bg-cyan-400/40">` bar).

## 2. StatInput exists but the same pattern is reimplemented inline ~17 times across the context

- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/evaluator/CombatSimulatorView.tsx:204-224, src/components/modules/core-engine/unique-tabs/GASBalanceSimulator/ScenarioEditor.tsx:78-80,108-112
- **Scenario**: GASBalance defines a clean `StatInput` (icon + label + slider + readout + hint) and uses it 15 times in `ScenarioEditor`. Yet `CombatSimulatorView`'s 7 tuning sliders and `ScenarioEditor`'s `count`/`iterations` numeric inputs each open-code the row layout, slider styling, label width, and number-input styling.
- **Root cause**: `StatInput` was built for ranges only; nobody factored a `NumberInput` sibling, so authors fall back to inline JSX for numeric fields and the evaluator never learned `StatInput` exists (different folder).
- **Impact**: Slider thumb color (`accent-current` vs `accent-amber-400`), label widths (w-16, w-20, w-24, w-28), readout widths (w-10, w-14), and `text-2xs` vs `text-xs` drift between rows. Any future UX tweak (keyboard nudge, focus ring, hint tooltip) must be done N times.
- **Fix sketch**: Promote `StatInput` to a shared `core-engine/_design` primitive and add a sibling `NumberInput` with the same icon+label+readout chrome. Migrate `CombatSimulatorView` tuning sliders and the `count`/`level`/`iterations` `<input type="number">` blocks to it. Pre-existing `count` input in `ScenarioEditor` (line 78) and the `iterations` input (line 110) are the same component twice with different widths — collapse them.

## 3. Three nearly-identical SVG hover-tooltip charts diverge in tooltip chrome and styling

- **Severity**: High
- **Category**: visual-consistency
- **File**: src/components/modules/core-engine/unique-tabs/GASBalanceSimulator/SensitivityChart.tsx:95-103, src/components/modules/core-engine/unique-tabs/GASBalanceSimulator/LevelSweepChart.tsx:113-125, src/components/modules/core-engine/unique-tabs/GASBalanceSimulator/HistogramChart.tsx:53-74
- **Scenario**: Three charts in the same folder render an SVG, attach a `MouseMove` to find the closest data point, and float a tooltip. Each builds its own tooltip box: Sensitivity uses `bg-surface-1 border border-border` with a custom `borderColor` override, LevelSweep uses `bg-surface-1 border border-border` (no color tint), Histogram uses `bg-[var(--surface-deep)]` with custom `border` style. Padding (`px-2 py-1` vs `px-2 py-1.5`), border radius (`rounded` vs `rounded-md`) and shadow chrome diverge.
- **Root cause**: Each chart was authored independently; no `<ChartTooltip>` primitive exists, so the same shape was rebuilt three times.
- **Impact**: Hovering across the GAS Balance dashboard, tooltips visibly shift in size, corner radius and tint — a polish regression in what is otherwise the most considered surface.
- **Fix sketch**: Extract a `<ChartCrosshairTooltip color={...} fields={[{label,value,color}]}>` component. Standardize on `rounded-md`, `px-2 py-1.5`, `bg-surface-1`, `border` tinted via `withOpacity(color, OPACITY_25)`, and `shadow-lg`. Fold the three current implementations into it; keep the `tooltipOnRight` flip logic shared.

## 4. RatingBadge's pattern is duplicated as Badge variants and as inline severity pills

- **Severity**: Medium
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/DodgeTimelineEditor/RatingBadge.tsx:6-25, src/components/modules/evaluator/CombatSimulatorView.tsx:31-35,540-546
- **Scenario**: `RatingBadge` is a polished pill (dot + label + tinted bg + textShadow glow) keyed by 3 ratings. The Combat alerts list (`AlertsSection`) renders effectively the same pill shape inline using a hardcoded `SEVERITY_STYLE` map and `<AlertTriangle>` instead of a dot — same visual idea, different build.
- **Root cause**: `RatingBadge` was scoped narrowly to dodge ratings; severity/alert pills weren't unified with it.
- **Impact**: Status pills in the same product (one labeled "Generous/Tight/Punishing", one labeled "info/warning/critical") render with different chrome (dot vs icon, glow vs no glow, padding 0.5 vs 2). New status types will spawn a 4th variant.
- **Fix sketch**: Generalize `RatingBadge` to `<StatusBadge tone={'success'|'warning'|'error'|'info'} icon? glow? label/>`. Make `RATING_STYLES` and `SEVERITY_STYLE` consumers of it. Bonus: the `Badge` component used in `CombatSimulatorView` (`<Badge variant="success">`) is a third spelling — pick one home.

## 5. SensitivityChart skips empty-state rendering during the first frame, causing a layout pop

- **Severity**: Medium
- **Category**: polish
- **File**: src/components/modules/core-engine/unique-tabs/GASBalanceSimulator/SensitivityChart.tsx:30-31,69-71
- **Scenario**: The component returns the empty container if `pts.length < 2` and otherwise gates the SVG behind `containerW > 0`. On first paint with valid data, `containerW` is 0 until the ResizeObserver fires, so the chart shows an empty min-height box, then snaps the SVG in. There is no skeleton, label, or fade.
- **Root cause**: ResizeObserver-driven width is async; component has no explicit "measuring" or "no data" affordance.
- **Impact**: A perceptible flash of empty space on first mount and on every mode change that remounts the chart. Adjacent charts (LevelSweep) get explicit `width`/`height` props and don't have this.
- **Fix sketch**: Render a faint placeholder (axis-only grid + "Computing..." label) while `containerW === 0`, or measure synchronously with `useLayoutEffect` + `getBoundingClientRect`. Better: accept a `width` prop like `LevelSweepChart` does and let the parent own the responsive layer.

## 6. SurvivalHeatmap cells skip cell-level keyboard focus and ARIA semantics

- **Severity**: Medium
- **Category**: accessibility-polish
- **File**: src/components/modules/core-engine/unique-tabs/PredictiveBalanceSimulator/SurvivalHeatmap.tsx:42-53
- **Scenario**: Heatmap cells reveal stats only via `onMouseEnter`/`onMouseLeave`. There's no `tabIndex`, no `aria-label` on the cell, and the hover panel is the only way to read TTK/DPS/EHP. Keyboard users get a percentage and nothing else; screen readers announce just `"42%"` with no row/column context.
- **Root cause**: Built mouse-first; the hovered-detail panel below the table substitutes for a tooltip but isn't reachable.
- **Impact**: Designers presenting balance to a stakeholder over screenshare can't tab through cells; a11y review will flag this whole panel.
- **Fix sketch**: Make each `<td>` (or wrap in `<button>`) focusable with `tabIndex={0}`, add `aria-label="Lv X vs Y: 42% survival, 4.2s TTK"`, and trigger `setHovered` on focus too. Add `role="img"` + descriptive `aria-label` to the table for the high-level summary.

## 7. SpatialGrid and the GAS sliders both color-code by stat but the palettes don't match

- **Severity**: Medium
- **Category**: visual-consistency
- **File**: src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/SpatialGrid.tsx:109,129,145, src/components/modules/core-engine/unique-tabs/GASBalanceSimulator/ScenarioEditor.tsx:50-64
- **Scenario**: `SpatialGrid` colors enemies by `ARCHETYPE_COLORS[archetypeId]`. `ScenarioEditor` colors the same conceptual stats (Strength, HP, Armor) using `ACCENT_ORANGE`, `STATUS_ERROR`, `MODULE_COLORS.core`. The Combat Simulator tuning sliders use a single `accent-amber-400` for everything. Three sims, three rules for "what color should this stat be."
- **Root cause**: No central stat→color registry; each sim picks colors locally, sometimes by archetype, sometimes by stat domain, sometimes by mood.
- **Impact**: Cross-referencing "Player HP at level 12" between Choreography and GAS Balance breaks because the color encoding shifts. Color becomes decoration rather than signal.
- **Fix sketch**: Add `lib/combat/stat-colors.ts` with `STAT_COLORS = { health, armor, strength, ... }` and reuse across `StatInput` (replace per-call `color={...}`), `LevelSweepChart`'s `METRICS`, and the choreography legend. Document the mapping in `chart-colors.ts`.

## 8. FlowNode hardcodes a 44-char label truncation instead of using CSS

- **Severity**: Low
- **Category**: polish
- **File**: src/components/modules/core-engine/unique-tabs/DamagePipelineDiagram/FlowNode.tsx:140-143
- **Scenario**: Detail subtitles get truncated with `node.detail.length > 44 ? node.detail.slice(0, 42) + '...' : node.detail`. Because SVG `<text>` doesn't support `text-overflow: ellipsis`, this is reasonable, but the truncation is character-count-based not pixel-based — wide letters like "WW" overrun NODE_W=200 while narrow "iii" wastes space. There's also no title/`<title>` for full text on hover.
- **Root cause**: Quick fix for SVG's lack of CSS overflow.
- **Impact**: Some nodes still overflow the box visually; users can't see the truncated text without expanding.
- **Fix sketch**: Add `<title>{node.detail}</title>` inside the `<motion.g>` so hover reveals full text. For better fit, measure with `getComputedTextLength()` after mount or use a `<foreignObject>` containing a CSS-truncated `<div>` (matching what tooltips already do elsewhere).
