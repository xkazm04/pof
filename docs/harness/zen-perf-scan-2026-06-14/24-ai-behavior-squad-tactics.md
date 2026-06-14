# AI Behavior & Squad Tactics — zen-perf scan
> Context: AI, Build & Packaging Systems / AI Behavior & Squad Tactics
> Total: 5
> Severity: critical=0 high=1 medium=3 low=1

## 1. Coverage heatmap does a full O(segments × points) nearest-point scan, unmemoized derivations on hover
- **Severity**: high
- **Lens**: performance
- **Category**: O(n²) grid / missing memoization
- **File**: src/components/modules/game-systems/TacticalCoverAnalysis.tsx:226
- **Scenario**: The `heatmapArcs` memo (line 226) builds 72 arc segments and, for **each** segment, runs `points.reduce(...)` across the entire point cloud (sampleCount × rings) to find the angularly-closest point — an O(72 × N) inner loop. With the defaults that's ~72 × 72 ≈ 5,200 angle-diff computations per recompute, and it recomputes whenever `getScore` changes (i.e. every `scoreMode` switch) since `getScore` is in its dep array. Worse, two other per-frame derivations are **not** memoized at all: the "Best Positions" list re-runs `[...points].sort((a,b) => getScore(b) - getScore(a))` (line 739) and the LOS-trace `points.filter(...)` (line 464) on **every render**, including every `hoveredPoint` enter/leave on any of the 70+ dots.
- **Root cause**: The nearest-point search is brute force (the arc segment index already maps linearly to an angle bucket, so the closest sample can be found by direct index math, not a scan). The sort and filter live in JSX, outside any `useMemo`, so React re-derives them on each hover state change.
- **Impact**: Hovering a single cover dot re-sorts and re-filters the whole cloud and re-reconciles the SVG; on the `scoreMode` toggle the 72×N arc scan also reruns. Visible jank on the densest score modes; wasted CPU on pure hover.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: (1) Replace the per-segment `reduce` with direct bucketing — map each point's `angle` to a segment index once, keep a max-score per bucket. (2) Wrap the "Best Positions" sorted slice and the LOS-trace filtered list in `useMemo` keyed on `[points, getScore]`. (3) Move `hoveredPoint` rendering so hover does not invalidate these derivations (see finding #3).

## 2. AttackRing visualizer clips out of its viewBox at high AttackDistance (scale constant mismatch)
- **Severity**: medium
- **Lens**: both
- **Category**: rendering correctness / magic constant
- **File**: src/components/modules/game-systems/AttackRingVisualizer.tsx:44
- **Scenario**: `scale = MAX_DRAW_RADIUS / 300` (line 44) with a comment that says "200 units = MAX_DRAW_RADIUS" — neither matches the actual control range. The `AttackDistance` slider (line 294) allows values up to **500**. With `polarSvgLayout(340, 50)` → center 170, `MAX_DRAW_RADIUS` 120, so `scale = 0.4`. At `attackDist = 500`, `outerR = 200`, ring points land at 170 ± 200 = −30…370 and the distance label is drawn at `x = SVG_CENTER + outerR + 4 = 374` — all well outside the 0–340 viewBox and clipped.
- **Root cause**: The hard-coded `/ 300` divisor was never reconciled with the slider's max (500) or the layout's drawable radius (120). There is no clamp/normalization tying the world-space max to the SVG radius.
- **Impact**: Dragging the slider past ~300 UU silently pushes the ring and its labels off-canvas — the visualization stops representing its own parameters. A "real C++ defaults" teaching surface that lies above 300.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Derive `scale = MAX_DRAW_RADIUS / sliderMax` (500), or `MAX_DRAW_RADIUS / Math.max(attackDist, someFloor)` so the ring always fits, and fix the stale comment.

## 3. Hover state lifted to the parent forces full re-render of large SVG diagrams
- **Severity**: medium
- **Lens**: performance
- **Category**: unnecessary re-renders
- **File**: src/components/modules/game-systems/SquadChoreographyEditor.tsx:81
- **Scenario**: `hoveredMember` lives at the top of `SquadChoreographyEditor` (line 81) and is threaded into `FormationView`. Every pointer-enter/leave on any squad dot (line 516) or member row (line 635) sets it, re-rendering the entire editor: the whole formation `<svg>` (grid rings, compass, every member `<g>`, legend) plus both side panels and the role-composition list re-reconcile. `FormationView` is a plain function component (line 364) with no `React.memo`. The identical pattern repeats in `FlankAngleHeatmap` (`hoveredPoint`, line 89) and `TacticalCoverAnalysis` (`hoveredPoint`, line 191), where the full SVG subtree re-reconciles on each hover even though `points`/`heatmapArcs` are memoized.
- **Root cause**: Highlight-on-hover is modeled as top-level React state instead of being localized to the hovered element, so a purely visual O(1) change invalidates an O(members)/O(points) render tree.
- **Impact**: Constant reconciliation churn while moving the cursor over the diagrams; combines with finding #1 to make hover the most expensive interaction in the view.
- **Effort**: 5 · **Value**: 5
- **Fix sketch**: Either split the member/point glyph into a memoized child that receives `isHovered` and short-circuits, or drive the highlight via CSS `:hover`/a data-attribute on the SVG group so no React state changes on hover at all.

## 4. Five `useState` slots in TacticalCoverAnalysis are frozen — no setter is ever called
- **Severity**: medium
- **Lens**: architecture
- **Category**: dead state / misleading UI
- **File**: src/components/modules/game-systems/TacticalCoverAnalysis.tsx:184
- **Scenario**: `sampleCount`, `rings`, `minRadius`, `maxRadius`, and `coverCheck` are declared as `useState(DEFAULT_…)` (lines 184-188) but the setters are discarded (`const [x] = useState(...)`) and never wired to any control. The "Generator Params" panel (lines 652-664) renders them as if they were configurable EQS knobs, yet they can never change — unlike the sibling `AttackRingVisualizer`, which actually exposes equivalent sliders.
- **Root cause**: Controls were scaffolded as state for future sliders that were never built; the state survived as inert ceremony. The values are compile-time constants masquerading as component state.
- **Impact**: Misleading (the params look adjustable), and the `useState` indirection adds noise and forces these into the `points` memo dep array (line 199) for no reason. Pure dead code that obscures intent.
- **Effort**: 1 · **Value**: 4
- **Fix sketch**: Demote the five to `const` module/local values (they already alias the `DEFAULT_*` constants), drop them from the `points` memo deps, and label the panel as read-only defaults — or wire real sliders if interactivity was intended.

## 5. `flankColor` / `coverColor` heatmap-ramp wrapper duplicated across three components
- **Severity**: low
- **Lens**: architecture
- **Category**: duplicated logic
- **File**: src/components/modules/game-systems/FlankAngleHeatmap.tsx:28
- **Scenario**: `flankColor(angleDeg)` is defined identically in `FlankAngleHeatmap.tsx:28` and `SquadChoreographyEditor.tsx:60` (both `heatmapScale(Math.min(angleDeg / 180, 1))`), and `TacticalCoverAnalysis.tsx:174` defines `coverColor(score)` which is the same `heatmapScale(clamp01(x))` ramp with a different normalization. The `SquadChoreographyEditor` copy even carries a comment saying it must match `FlankAngleHeatmap` — a maintenance coupling enforced only by a comment.
- **Root cause**: A trivial shared helper (normalize-then-`heatmapScale`) was inlined per component instead of living beside `heatmapScale` in `chart-colors`. This sits alongside the project's existing extraction work (`polar-layout`, `arc-helpers`, `eqs-geometry`, `useDragAngle`) — the same cleanup pattern, one helper short.
- **Impact**: Three copies of an angle→color ramp that must be kept in lockstep by convention; a future tweak to the flank ramp risks silent drift between the squad diagram and the heatmap.
- **Effort**: 2 · **Value**: 3
- **Fix sketch**: Add `flankAngleColor(deg)` (and reuse for the 0-1 cover case) next to `heatmapScale` in `@/lib/chart-colors`; import it in all three components and delete the local copies.
