# Progression & Save Systems — zen-perf scan
> Context: Progression, World & Bestiary / Progression & Save Systems
> Total: 5
> Severity: critical=0 high=1 medium=3 low=1

## 1. BudgetAlerting recomputes linear-regression projections + nested lookups every render
- **Severity**: high
- **Lens**: both
- **Category**: missing memoization / O(n·m) over static data
- **File**: src/components/modules/core-engine/sub_save/schema/BudgetAlerting.tsx:39
- **Scenario**: The component renders whenever its parent `SaveDataSchema` re-renders (tab switches, feature-visibility toggles, any ancestor state). Every render reruns all of the work below against module-level constant data that never changes.
- **Root cause**: The entire `SECTION_BUDGETS.map` body (lines 39–119) does, per section per render: a linear `FILE_SIZE_SECTIONS.find` (line 40), a `GROWTH_HISTORY.map` to build the history array (line 46), and `projectGrowth(history)` — an O(n) least-squares regression (data-budget.ts:39). The two header tallies (lines 17–24) each run another full `.filter` + `.find` pass (O(budgets × sections)). The footer (line 130) then runs `projectGrowth` a *second* time for **all 5 sections** plus two `reduce`s. None of it is wrapped in `useMemo`, and every input is a frozen constant.
- **Impact**: ~3× redundant regression passes + ~3 nested-loop scans on every render of a panel whose output is 100% static. Pure wasted CPU/GC on each parent re-render.
- **Effort**: 2 · **Value**: 7
- **Fix sketch**: Hoist the per-section derived rows (status, projected, history, maxVal) and the header tallies into a single module-level constant (or one `useMemo([])`), since all inputs are compile-time constants. Reuse the computed `projected` in the footer instead of recomputing `projectGrowth` for every section again.

## 2. Slider drags re-render the entire Curves subtree (unmemoized prop-less siblings)
- **Severity**: medium
- **Lens**: performance
- **Category**: unnecessary React re-renders
- **File**: src/components/modules/core-engine/sub_progression/index.tsx:104
- **Scenario**: Dragging the Base XP / Exponent `RangeSlider` fires `setBaseXp`/`setCurveExp` continuously. Each tick re-renders `ProgressionCurve`, which re-renders every child of the `curves` tab.
- **Root cause**: `MultiCurveOverlay` (line 131), `MilestoneTimeline` (135) and `FeatureGrid` (138) take **no props derived from the sliders**, yet none are `React.memo`-wrapped, so they re-render on every slider tick along with `MainChartArea`. `MultiCurveOverlay` rebuilds a 5-series normalized SVG line chart (`filter` + `flatMap`, MultiCurveOverlay.tsx:15-16) on each tick for output that cannot change. `MainChartArea`/`XpCurveChart` legitimately must update, but the prop-less siblings are pure waste.
- **Impact**: 3+ non-trivial SVG/grid components rebuilt dozens of times per drag gesture; visible jank potential on lower-end machines, all avoidable.
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: Wrap `MultiCurveOverlay`, `MilestoneTimeline`, and the `FeatureGrid` panel (or split the slider-driven chart pair into its own subcomponent) in `React.memo`. They have stable/empty props so memoization fully isolates them from slider churn.

## 3. Inline chart geometry recomputed twice per render in DR & danger-zone charts
- **Severity**: medium
- **Lens**: both
- **Category**: duplicated computation in render
- **File**: src/components/modules/core-engine/sub_progression/analysis/DiminishingReturnsVisualizer.tsx:79
- **Scenario**: Each render of the visualizer maps `attr.curve` to point coordinates three separate times — the polyline (line 79-83), the area polygon (88-94), and the dot circles (98-105) — each recomputing `(c.points/100)*100` and `safeDivide(c.marginalValue, maxMarginal)*90` for the same points. `PowerCurveDangerZones.tsx:70-105` has the identical pattern: `normalizedIndex` + `safeDivide` recomputed across four separate `.map` passes over `playerPower`/`enemyDifficulty`.
- **Root cause**: No `useMemo` and no shared point-array; the SVG-coordinate math is inlined per element group rather than computed once. (Ironically, `chartMath.ts` already centralizes the *guards* but not the laid-out points.)
- **Impact**: 3–4× redundant trig/division per data point on every render; also the duplicated coordinate expressions are an SRP/readability smell that invites drift between the line and its dots.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Compute a single `points: {x,y}[]` array via `useMemo` (keyed on the selected attribute / power arrays) and feed polyline, polygon, and circles from it. Optionally promote a `chartPoints(values,…)` helper into `chartMath.ts` alongside the existing sparkline helpers to dedupe both components.

## 4. Interactive state hooks render purely static, non-functional UI controls
- **Severity**: medium
- **Lens**: architecture
- **Category**: dead interactivity / misleading state
- **File**: src/components/modules/core-engine/sub_save/advanced/DataRecoveryTool.tsx:15
- **Scenario**: `DataRecoveryTool` holds `recoveryStep` state with clickable step pills (lines 33-62) and a confidence gauge — but `recoveryOverall`, `gaugeToken`, and `RECOVERY_RESULTS` are all derived from frozen constants and are **independent of `recoveryStep`**. Clicking a step only restyles the pill; nothing downstream changes. `AutoSaveConfig.tsx:14` similarly holds `intervalSeconds` state driving a slider whose value feeds nothing but its own label, while every adjacent toggle (combat-save, compression, triggers) is hardcoded read-only data.
- **Root cause**: Mock/showcase panels were built with real `useState` interactivity scaffolding but never wired to a model, leaving stateful controls that imply behavior they don't have.
- **Impact**: Misleading UX (controls look functional but aren't) and needless re-render surface; reviewers can't tell mock from live. Low runtime cost but real clarity/maintenance debt.
- **Effort**: 2 · **Value**: 4
- **Fix sketch**: Either downgrade the non-functional pills/sliders to plainly static read-only displays (drop the `useState`), or annotate them clearly as demo-only. At minimum, remove the click handler on the recovery step pills that produces no observable effect beyond styling.

## 5. Dead clamp branch in generateChartData level loop
- **Severity**: low
- **Lens**: architecture
- **Category**: dead code
- **File**: src/components/modules/core-engine/sub_progression/_shared/data.ts:35
- **Scenario**: Inside `generateChartData`, the loop runs `for (let lvl = 1; lvl <= MAX_LEVEL; lvl += 5)`, then line 35 computes `const levelToUse = lvl > MAX_LEVEL ? MAX_LEVEL : lvl;`. The loop guard already guarantees `lvl <= MAX_LEVEL`, so the conditional can never take the true branch.
- **Root cause**: Leftover defensive clamp from an earlier loop shape (likely `lvl += 5` could overshoot in a prior version); now unreachable.
- **Impact**: Negligible runtime, but it implies a clamping concern that doesn't exist and muddies the loop. Pure removable noise.
- **Effort**: 1 · **Value**: 2
- **Fix sketch**: Replace `levelToUse` with `lvl` directly in the `push` (level + `calculateXpForLevel`), deleting the dead ternary. If overshoot is actually a future concern, change the guard to `Math.min(lvl, MAX_LEVEL)` and document it — but currently it is unreachable.
