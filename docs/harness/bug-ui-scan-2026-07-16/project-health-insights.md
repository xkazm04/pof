# Project Health & Insights — Bug + UI Scan

> Total: 10

> Note: All four scoped files have been refactored from single files into folders. Every sub-file in each folder was read in full:
> - `ProjectHealthDashboard.tsx` -> `ProjectHealthDashboard/{index.tsx, HealthHeader.tsx, HealthRadarChart.tsx, ModuleScoreTrend.tsx, OverallScoreSparkline.tsx, RadialScoreGauge.tsx, RegressionAlerts.tsx, ScanHistoryTimeline.tsx, SelectedModuleDetail.tsx, TopRecommendations.tsx, constants.ts, helpers.ts, types.ts}`
> - `HolisticHealthView.tsx` -> `HolisticHealthView/{index.tsx, useHolisticHealthView.tsx, OverviewTab.tsx, QualityTab.tsx, VelocityTab.tsx, MilestonesTab.tsx, MilestoneDetailCard.tsx, MilestoneRow.tsx, ModuleHeatCell.tsx, PerformanceStatCard.tsx, SignalCard.tsx, SubTab.tsx, charts.tsx, constants.ts, types.ts}`
> - `InsightCard.tsx` — still a single file, unchanged.
> - `WeeklyDigestView.tsx` -> `WeeklyDigestView/{index.tsx, DailyActivity.tsx, ModuleLeaderboard.tsx, SparklineBar.tsx, constants.ts, helpers.ts}`

## Bug findings

### 1. "Scan Project" button has no click handler — a dead control
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/evaluator/ProjectHealthDashboard/HealthHeader.tsx:48
- **Scenario**: User opens the Project Health dashboard, sees the primary "Scan Project" button (styled identically to every other active button in the dashboard, not visually disabled unless `isScanning`), and clicks it expecting a scan to start.
- **Root cause**: The `<button>` only has `disabled={isScanning}` and a `title` tooltip ("Scan functionality requires CLI integration"); there is no `onClick` at all, so the click is silently swallowed with zero feedback.
- **Impact**: The dashboard's headline call-to-action does nothing. Users get no error, no toast, no disabled affordance beyond a hover-only tooltip — classic success theater (button looks live, isn't).
- **Fix sketch**: Either wire the button to the real scan trigger (if one exists elsewhere in the module) or render it `disabled` with a persistently visible "Coming soon" badge/label instead of a hover-only title, so the affordance matches the actual capability.

### 2. Regression alerts never clear themselves once the regression resolves
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/ProjectHealthDashboard/index.tsx:54-91
- **Scenario**: Scan N shows a module dropped 15 points → alert added. User doesn't dismiss it. Scan N+1 shows the module fully recovered (no regression versus N).
- **Root cause**: The `useEffect` only calls `setRegressionAlerts(alerts)` inside the `if (alerts.length > 0)` branch (line 83). When the newly computed `alerts` array is empty, nothing runs, so the previous (now-stale) alert list is left untouched in state.
- **Impact**: Stale "Overall health dropped…" / "<module> dropped…" banners persist indefinitely after the underlying issue is fixed, until the user manually clicks the per-alert dismiss (X). This misleads users into thinking a resolved regression is still live.
- **Fix sketch**: Always call `setRegressionAlerts(alerts)` (drop the `length > 0` guard) so stale alerts are replaced with the fresh (possibly empty) set on every new scan.

### 3. Burndown/burnup charts divide by a checklist total that can be zero, producing NaN coordinates
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/HolisticHealthView/charts.tsx:89,98 (AreaChartSimple), 126,133,140 (BurndownChart)
- **Scenario**: A brand-new project with no checklist items yet (`summary.totalChecklistItems === 0`) has milestones/burn history that still render (e.g. one degenerate data point), so `VelocityTab`/`MilestonesTab` mount `AreaChartSimple`/`BurndownChart` with `total = 0`.
- **Root cause**: Both components compute point Y-coordinates as `(value / total) * (h - 16) - 8` etc. with no guard against `total === 0`, unlike `BarChartSimple`/`LineChartSimple` in the same file which both defend with `Math.max(..., 1)`.
- **Impact**: `NaN` coordinates silently break the SVG polyline/polygon (nothing renders, or renders at `NaN,NaN` — invisible, no error surfaced) instead of showing an empty/zero chart.
- **Fix sketch**: Guard with `const safeTotal = total || 1;` (matching the pattern already used in `BarChartSimple`/`LineChartSimple`) before dividing.

### 4. Module leaderboard assumes `moduleActivity[0]` is the max — unsorted input silently corrupts bar widths
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/WeeklyDigestView/ModuleLeaderboard.tsx:13; src/components/modules/evaluator/WeeklyDigestView/helpers.ts:180 (same assumption duplicated in the PNG-export renderer)
- **Scenario**: The API/store ever returns `moduleActivity` in a non-session-sorted order (e.g. alphabetical, or insertion order) — nothing in this component enforces or verifies sort order.
- **Root cause**: `const maxSessions = moduleActivity[0].sessions;` is used as the normalization denominator for every bar's width, assuming index 0 holds the true maximum without sorting or `Math.max(...)`.
- **Impact**: If the first entry isn't actually the max, some bars compute `barWidth > 100%` (visually overflowing/clipped) while the true top module reads short — the leaderboard would misrepresent relative activity, and the PNG export (`helpers.ts`) reproduces the same bug so shared/copied digests carry the same distortion.
- **Fix sketch**: Compute `const maxSessions = Math.max(...moduleActivity.map(m => m.sessions), 1);` in both places (or sort defensively by `sessions` descending before rendering) instead of trusting positional index 0.

### 5. Hardcoded (non-unique) SVG gradient IDs are a latent multi-instance collision
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/evaluator/ProjectHealthDashboard/ModuleScoreTrend.tsx:49; src/components/modules/evaluator/ProjectHealthDashboard/OverallScoreSparkline.tsx:24
- **Scenario**: Any future feature renders two `ModuleScoreTrend` (or two `OverallScoreSparkline`) instances in the same DOM at once — e.g. a side-by-side module comparison, a split view, or even React 18 double-invoke in dev/StrictMode edge cases with portals.
- **Root cause**: `<linearGradient id="module-trend-fill">` / `id="overall-sparkline-fill"` are static string literals referenced via `url(#...)`, not namespaced per instance (e.g. with `useId()`).
- **Impact**: SVG `id` must be document-unique; duplicate IDs cause browsers to resolve `url(#id)` to whichever element got the ID first, silently making one instance's gradient fill wrong or transparent — a time-bomb that only surfaces when the component is reused in a not-yet-built layout.
- **Fix sketch**: Generate the id via `React.useId()` (or pass a unique `idSuffix` prop) so each mounted instance gets its own gradient id.

## UI findings

### 6. Two incompatible score→color scales are both "the" score color in the same dashboard
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/ProjectHealthDashboard/RadialScoreGauge.tsx:35-38 vs src/components/modules/evaluator/ProjectHealthDashboard/helpers.ts:6-11
- **Scenario**: A module scores 50. In the radial gauge header it renders amber (`score <= 60` band, 31-60 = warning). In `SelectedModuleDetail`, `ScanHistoryTimeline`, and `HealthRadarChart` (all of which call `scoreColor()`), the same 50 renders as the "blocker" color (40-59 band) — a third, different hue from the gauge's amber.
- **Root cause**: `RadialScoreGauge` hand-rolls its own 3-band grading (`MODULE_COLORS.evaluator` red / `STATUS_WARNING` amber / `STATUS_SUCCESS` green with breakpoints at 30/60) instead of reusing the shared `scoreColor()` helper (4-band, breakpoints at 40/60/80, includes a distinct `STATUS_BLOCKER` hue) that every other widget in the same file tree uses.
- **Impact**: The same numeric score is color-coded differently depending which widget the user is looking at in the same view — breaks the "color = meaning" contract that a health dashboard depends on for at-a-glance scanning.
- **Fix sketch**: Have `RadialScoreGauge` call the shared `scoreColor()` from `./helpers` instead of maintaining its own inline threshold/color logic.

### 7. Status pills are implemented three different ways across one context
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/ProjectHealthDashboard/RegressionAlerts.tsx / TopRecommendations.tsx / SelectedModuleDetail.tsx (inline `style={{color, backgroundColor}}` from `PRIORITY_COLORS`) vs src/components/modules/evaluator/HolisticHealthView/*.tsx (shared `<Badge variant="success|warning|error|default">` component)
- **Scenario**: A user moving from the "Health" tab (`HolisticHealthView`, uses `Badge`) to the "Evaluator health" panel (`ProjectHealthDashboard`, uses hand-built pills with inline styles and hardcoded padding/radius/typography) sees two visually distinct pill styles for the same semantic concept (priority/status).
- **Root cause**: `ProjectHealthDashboard`'s sub-components never adopted the shared `Badge` component (`@/components/ui/Badge`) that `HolisticHealthView` uses consistently for the same "severity chip" concept; instead each file re-implements padding/rounding/uppercase/tracking by hand from `PRIORITY_COLORS`.
- **Impact**: Inconsistent chip sizing, corner radius, and font-weight between two panels of the same "Project Health & Insights" context — a design-system fragmentation that will drift further as more severities/priorities are added.
- **Fix sketch**: Extend `Badge` (or a `PriorityBadge` wrapper around it) to accept the priority palette and swap the inline-styled spans in `RegressionAlerts`/`TopRecommendations`/`SelectedModuleDetail`/`InsightCard` for it.

### 8. Daily-activity sparkline tooltip has no edge-collision handling
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/WeeklyDigestView/SparklineBar.tsx:26-31, consumed by DailyActivity.tsx:19-30
- **Scenario**: On a narrow viewport (mobile width, or the digest panel embedded in a narrower sidebar), hovering/focusing the first or last day's bar shows the tooltip.
- **Root cause**: The tooltip is centered on its bar via `left-1/2 -translate-x-1/2` with `whitespace-nowrap` and no boundary detection; the first/last of 7 equally-spaced flex columns puts the tooltip's centered content partly outside the card (or viewport) with no fallback alignment.
- **Impact**: The tooltip for the leftmost/rightmost day can be clipped by the card edge or `overflow` ancestor, hiding part of the "Sessions / Successful / Rate" content exactly where a user is looking.
- **Fix sketch**: Add edge-aware alignment (e.g. `justify-self`/`translate` swap for first/last index, or clamp with a CSS `clamp()`/JS measurement), matching the pattern many design systems use for edge tooltips.

### 9. Five stat cards collapse into an awkward 2-column grid across a wide range of common widths
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/HolisticHealthView/index.tsx:112
- **Scenario**: `grid-cols-2 lg:grid-cols-5` renders 5 cards (Completion, Quality, Performance, Velocity, Module Health). Below the `lg` breakpoint (< 1024px) — which includes tablets and many laptop windows that aren't maximized — the layout is 2 columns, leaving the 5th card alone on a 3rd row.
- **Root cause**: There's no intermediate step (`sm:grid-cols-3` / `md:grid-cols-4`) between the 2-col mobile default and the 5-col desktop layout, unlike other multi-card rows in the app that step through 2 → 3/4 → N.
- **Impact**: A visually unbalanced, half-empty last row on a very common range of viewport widths (roughly 640-1024px), which reads as broken/unfinished layout rather than intentional design.
- **Fix sketch**: Add a `md:grid-cols-3` (or `sm:grid-cols-4`) step so the 5-card row degrades gracefully instead of jumping straight from 2 to 5 columns.

### 10. Two independently hand-built circular-progress renderers coexist for the same "score ring" concept
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/ProjectHealthDashboard/RadialScoreGauge.tsx (custom `polarToCart`/`arcPath` SVG arc math) vs `@/components/ui/ProgressRing` (used throughout HolisticHealthView for the identical "score out of 100" concept)
- **Scenario**: The Project Health header shows a big score via `RadialScoreGauge`'s bespoke 270° arc; a few tabs over, `HolisticHealthView`'s "Overall Completion"/"Quality"/"Performance" stat cards show the same kind of value via the shared `ProgressRing` component.
- **Root cause**: `RadialScoreGauge` reimplements arc geometry, stroke, glow (`drop-shadow`), and center-text layout from scratch instead of extending/parameterizing the shared `ProgressRing` (e.g. adding a "large centered gauge" variant/size).
- **Impact**: Two gauges for the same concept have subtly different visual language (stroke width, glow, arc sweep, color banding) inside one context, and any future fix/polish (e.g. accessibility labeling, animation, dark-mode contrast) has to be applied twice and will likely drift out of sync.
- **Fix sketch**: Extend `ProgressRing` with the options `RadialScoreGauge` needs (270° sweep, larger center text, glow) and delete the bespoke implementation, or explicitly document why a separate component is warranted.
