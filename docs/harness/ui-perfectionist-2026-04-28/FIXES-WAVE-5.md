# UI Perfectionist — Wave 5 Fix Summary

> 4 commits, 4 findings partially closed.

Wave 5 of the scan-fix pipeline. Built on the design-system foundation laid by waves 1–4 (chrome primitives, dashboard headers, section labels, tab factories, module topology). Focus this wave was reusable SVG primitives — extracting the shared math that 4+ contexts had been reinventing for state-graph canvases, flow-graph wires, arc/heatmap helpers, and chart axes. Visual fidelity was prioritized over completeness: where call sites diverge significantly, only the common math is shared and the JSX stays local.

## Per-commit table

| # | Hash    | Subject                                                                  | Files | Findings closed |
|---|---------|--------------------------------------------------------------------------|-------|-----------------|
| 1 | e6ae67e | extract shared graph-edge math to ui/svg                                 | 3     | 15.1 (partial)  |
| 2 | 10132c8 | extract cubic-bezier wirePath to ui/svg                                  | 2     | 12.5 / 05.1 (partial) |
| 3 | 144380b | extract arcPath() to ui/svg/arc-helpers                                  | 3     | 18.5 (partial)  |
| 4 | 900d4d0 | extract HorizontalGridLines for chart axes                               | 3     | 20.4 (partial)  |
| 5 | (this doc) | wave-5 fix summary                                                    | 1     | —               |

## What was fixed

### Fix 1 — Shared graph-edge math (finding 15.1)

`AnimationStateMachine.tsx` (1074 LOC) and `StateMachineEditor.tsx` (1393 LOC) both implement state-machine canvases with byte-identical edge geometry: unit normal along the edge, perpendicular bidirectional offset (±1.5 when a reverse edge exists), endpoint inset (8 units from each node center), and midpoint for label placement. Per the wave-5 caveat (visual fidelity is critical here), full `StateGraphCanvas` extraction was not attempted — the JSX around the math is significantly divergent (sim mode, hover states, selection states, dead-end markers, sparkles for montage states, etc.). Instead, extracted just the shared math as `computeEdgeGeometry()` in `src/components/ui/svg/graph-edges.ts`. Both call sites now import and call the helper; their JSX is unchanged.

### Fix 2 — `wirePath` cubic-bezier helper (findings 12.5, 05.1)

Several flow-graph editors hand-rolled the same horizontal cubic-bezier wire math: `cpOffset = min(80, |dx| * 0.4)`. Extracted as `wirePath(from, to, options?)` in `src/components/ui/svg/wire-path.ts`. Migrated `gas-blueprint/WiringGraphEditor.tsx`. Per the wave-5 caveat: gas-blueprint's `RelationshipWebEditor.tsx` uses straight `<line>` segments (not bezier) and a divergent simple-rect node API vs WiringGraphEditor's pin-based nodes — only the bezier math is shared, node JSX intentionally stays local. `ui-hud/EnemyHealthBarFSM.tsx` and `ui-hud/MenuFlowDiagram.tsx` migrations are followups.

### Fix 3 — `arcPath()` annular-wedge helper (finding 18.5)

`FlankAngleHeatmap.tsx` and `TacticalCoverAnalysis.tsx` both shipped a byte-identical (modulo intermediate-variable style) `arcPath` helper for SVG annular wedges (donut sectors): `M outerStart → A outer-arc → L inner → A inner-arc-back → Z`. Extracted to `src/components/ui/svg/arc-helpers.ts`. Note: the wave-5 brief also called out `DraggableForwardArrow`, `GradientLegend`, and `CompassTicks` as duplicated, but no such components exist in the codebase under those names — only `arcPath` is concretely shared. `SquadChoreographyEditor` and `AttackRingVisualizer` don't currently render arcs (no `arcPath` usage at scan time).

### Fix 4 — `HorizontalGridLines` chart-axis primitive (finding 20.4)

`DifficultyArcChart.tsx` and the trend sparkline inside `AggregateQualityDashboard.tsx` both hand-rolled the same y-mapping + horizontal-gridline pattern: `y = bottom - ((value - min) / range) * plotH`, then `<line x1={left} y1={y} x2={right} y2={y} stroke="var(--border)" strokeWidth={0.5} />` per integer/category value. Extracted as `<HorizontalGridLines>` in `src/components/ui/svg/ChartAxes.tsx` — a thin renderer with optional left-side tick labels. Per the wave-5 caveat (this is a "leave the codebase better than you found it" win, not a complete dedupe pass): `WeightDistribution.tsx` is a donut chart with no axes, so it doesn't apply. `<ChartTooltip>` was not extracted — the cited sites don't actually share a positioned-div tooltip pattern.

## Patterns established (catalogue items 26–29)

- **26. `computeEdgeGeometry(from, to, options?)`** (`src/components/ui/svg/graph-edges.ts`) — shared math for graph-edge endpoints + midpoint between two nodes positioned in percentage coordinates. Handles bidirectional perpendicular offset and per-end inset. Returns `null` for coincident nodes.
- **27. `wirePath(from, to, options?)`** (`src/components/ui/svg/wire-path.ts`) — horizontal cubic-bezier wire path-string for flow-graph editors. Control-point offset is proportional to horizontal distance, capped at 80 by default.
- **28. `arcPath(cx, cy, innerR, outerR, startAngle, endAngle)`** (`src/components/ui/svg/arc-helpers.ts`) — closed annular-wedge SVG path for heatmap/radial visualizers. Standard SVG angle convention (0 = +x axis).
- **29. `<HorizontalGridLines>`** (`src/components/ui/svg/ChartAxes.tsx`) — thin SVG component for horizontal gridlines + optional Y-tick labels. Owns the "min at bottom, max at top" linear y-mapping.

## What remains (followups / skipped)

### Skipped this wave

- **Fix 5 (finding 04.1) — `_shared.tsx` reinvention dedupe — SKIPPED.** `affix-workbench/PowerBudgetRadar.tsx` ships a 160×140 (non-square) bespoke radar with integrated budget bar + ghost overlay; `_shared.tsx`'s `RadarChart` is square and takes `RadarDataPoint[]`. The API mismatch (parallel arrays + ghost vs. single object array) means migration would force a square aspect ratio and lose the ghost-styling. Similarly, `DebugDashboard/system/CircularGauge.tsx` wraps the gauge in `BlueprintPanel` + `NeonBar` + status pill (NOMINAL/WARNING/CRITICAL) with `ACCENT`-driven theming, none of which `LiveMetricGauge` provides. Per wave-5 rule #7 ("if a primitive's API would diverge significantly... extract just the COMMON CORE"), neither is a clean replacement. Followup: extend `_shared.tsx`'s `RadarChart` to accept ghost overlays + non-square dimensions, then migrate.
- **Fix 4 (finding 13.4) — pan/zoom hook — SKIPPED.** `LevelFlowEditor.tsx` has pan-only logic (no zoom). `StreamingZonePlanner.tsx` has neither pan nor zoom. With effectively one consumer, building a generic `usePanZoom` hook = gold-plating per rule #6. Followup if a second pan-only consumer appears or `LevelFlowEditor` grows zoom.

### Followups (within the partially-closed findings)

- **15.1 full `StateGraphCanvas` extraction** — only the edge math was shared this wave. The marker `<defs>`, the node `<rect>`/`<button>` rendering, and the entry-indicator chrome are still duplicated between `AnimationStateMachine` and `StateMachineEditor`. A future pass could try a `<StateGraphCanvas>` primitive once the divergent overlays (sim, hover, dead-end) are factored into named props or render-slots — but it's a nontrivial refactor at >2400 LOC across the two files.
- **12.5 / 05.1 wire-using flow-graph migrations** — `EnemyHealthBarFSM.tsx`, `MenuFlowDiagram.tsx`, and `RelationshipWebEditor.tsx` (if it ever switches to bezier) should pick up `wirePath()` next.
- **18.5 arc-using game-systems migrations** — when `SquadChoreographyEditor` or `AttackRingVisualizer` add arcs they should use `arcPath()`. `GradientLegend` / `CompassTicks` / `DraggableForwardArrow` were called out by the brief but don't actually exist as duplicated components — if those concepts surface later they can be added to `ui/svg/`.
- **20.4 more chart sites** — `LootTableVisualizer/WeightDistribution.tsx` is a donut and out of scope for `HorizontalGridLines`. Other chart sites (e.g. evaluator dashboards beyond `AggregateQualityDashboard`) may benefit from `<HorizontalGridLines>` adoption; not exhaustively swept this wave.
- **`<ChartTooltip>`** — the brief proposed extracting a positioned-div tooltip primitive. Skipped because the cited sites don't currently share a tooltip structure; revisit when a real shared shape emerges.

`tsc --noEmit` was 0 before each commit and remains 0 after the wave.
