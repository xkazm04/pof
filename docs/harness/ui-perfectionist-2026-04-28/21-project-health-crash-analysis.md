# UI Perfectionist — Project Health & Crash Analysis

> Context: Project Health & Crash Analysis (Quality & Evaluation)
> Files read: 11
> Total: 5 — Critical: 0, High: 2, Medium: 2, Low: 1

## 1. Severity vocabulary fragmentation across four sibling subsystems
- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/types/crash-analyzer.ts:25; src/types/codebase-archeologist.ts:11; src/lib/asset-code-oracle.ts:23; src/types/performance-profiling.ts:5
- **Scenario**: Each lib in this context defines its own severity scale: crash analyzer uses `critical | high | medium | low`, archeologist uses `critical | warning | info`, asset oracle uses `error | warning | info`, profiling uses `critical | high | medium | low` (renamed `OptimizationPriority`). Downstream UI badges (severity pills in CrashAnalyzerView, archeologist findings list, oracle violations panel, triage cards) cannot share a single `<SeverityBadge>` component — each pillar gets its own colour map and its own translation table.
- **Root cause**: No shared `Severity` enum or token mapping at the type layer. Each module was authored independently and picked whatever vocabulary fit the local mental model.
- **Impact**: Inconsistent badge colours and labels across Quality & Evaluation dashboards (e.g. `warning` is yellow in archeologist but doesn't exist in crash analyzer; `error` only appears in oracle). Adds duplicate Tailwind class maps in every consumer view, and makes cross-context aggregation (e.g. "all critical issues") brittle.
- **Fix sketch**: Define a single `src/types/severity.ts` exporting the canonical 4-level scale (`critical | high | medium | low` plus an explicit `info`) and a normalizer mapping each legacy vocabulary onto it. Migrate the four type files to alias from this module. UI then has one `<SeverityBadge severity={normalize(x)} />` with one token map. Keep legacy aliases for one release to avoid a big-bang refactor.

## 2. Chart colour baked into project-health domain type
- **Severity**: High
- **Category**: Design System (token leak into lib/)
- **File**: src/types/project-health.ts:53-54
- **Scenario**: `Milestone.color: string` lives on the domain type returned by `/api/project-health`. The API/engine is forced to invent a hex/Tailwind class for each milestone, which then arrives in the store and gets pushed straight into chart props. This is a presentation concern leaking into data.
- **Root cause**: The original implementation needed Recharts to colour milestone markers and wired it through the type rather than introducing a `useMilestoneColor(milestone)` selector or a deterministic palette derived from `id`/`name`.
- **Impact**: Re-skinning the dashboard (dark mode tweak, brand refresh) requires a server change. The colour cannot react to theme/contrast at render time. Other consumers of `Milestone` (sidebars, tooltips, status pills) inherit a chart-specific colour they may not want.
- **Fix sketch**: Drop `color` from `Milestone`. Add `src/lib/projectHealth/milestoneColors.ts` with a stable mapping `milestoneId → tokenName` (or hash-based palette assignment) consumed only by chart components. If predictable assignment matters, expose `colorIndex: number` instead of a raw colour string so the UI owns the actual value.

## 3. Status sentinel mismatch between sibling enums
- **Severity**: Medium
- **Category**: Visual Consistency
- **File**: src/types/project-health.ts:6, src/types/project-health.ts:101
- **Scenario**: `ModuleHealthStatus` is `healthy | warning | critical | not-started` while `SubsystemSignal.status` (rendered side-by-side in the same dashboard) is `healthy | warning | critical | inactive`. The "neutral / no data" state is named two different things, so any shared `<HealthDot>` or status-icon component has to special-case both.
- **Root cause**: The two enums were authored at different times and the neutral sentinel was named ad hoc each time.
- **Impact**: Two separate icon/colour maps in the dashboard for the same visual concept (grey "no signal" pill). Future status taxonomy changes (e.g. adding `degraded`) have to be done twice.
- **Fix sketch**: Pick one neutral term — `inactive` is the more honest one for both ("module never scanned" and "subsystem not reporting" are both inactive, not absences). Update `ModuleHealthSummary` and any consumer mapping. Consider extracting a shared `HealthStatus` type next to the new `Severity` type.

## 4. Confidence and percentage values shipped as raw floats with no formatter
- **Severity**: Medium
- **Category**: Polish / Component Architecture
- **File**: src/types/crash-analyzer.ts:90; src/lib/crash-analyzer/sample-crashes.ts:261, :283, :312, :330, :348, :365, :383
- **Scenario**: `CrashDiagnosis.confidence` is a `0–1` float (e.g. `0.95`, `0.88`, `0.82`). `ProjectHealthSummary.budgetHitRate` is a `0–100` percent. `ModuleHealthSummary.healthScore` is `0–100`. Each consumer view has to remember "is this 0–1 or 0–100?" and apply its own `*100` / `toFixed(0)` / `%` suffix. The crash sample data even has `0.9` (which renders as `"90%"` not `"9%"`) — easy footgun for any UI dev who forgets the multiplier.
- **Root cause**: No shared formatters. Domain types don't carry a unit hint, so every TSX site reinvents the rendering.
- **Impact**: Inconsistent "98%" vs "0.98" vs "98.0%" formatting risk across CrashAnalyzerView and ProjectHealthDashboard. Localization (decimal separators) has nowhere to live.
- **Fix sketch**: Add `src/lib/format/percent.ts` with `formatPercent01(x)` and `formatPercent100(x)` plus a `formatConfidence(x)` that returns "High / Medium / Low" buckets in addition to the numeric. Either standardize all percent-like fields on 0–100 in the types (preferred — matches how UI users think) or keep 0–1 for probability fields and document it via a branded type `Probability = number & { __brand: 'p01' }`.

## 5. Frame budget magic number duplicated across CSV parser and triage scoring
- **Severity**: Low
- **Category**: Design System (numeric tokens)
- **File**: src/lib/profiling/csv-parser.ts:310, :347; src/lib/profiling/triage-engine.ts (uses `summary.frameBudgetMs` everywhere)
- **Scenario**: `16.67` (the 60fps frame budget) is hardcoded in `csv-parser.ts` (`budgetMs = 16.67`, then again in `emptySummary()`'s `frameBudgetMs: 16.67`). Other thresholds — `2000` draw calls, `500MB` peak memory, `3ms` GC pause, `95%` budget hit rate — are also literal magic numbers scattered through `triage-engine.ts`. Any UI surface that visualizes thresholds (e.g. "your project is at 78% of budget") will pick its own constants and drift.
- **Root cause**: No `src/lib/profiling/thresholds.ts` constants module. The engine inlines thresholds at use sites.
- **Impact**: Low today (logic-only), but the moment a chart axis or threshold marker is drawn in CrashAnalyzerView/ProjectHealthDashboard, it will hardcode the same numbers a third time. Re-targeting 30fps/120fps requires a sweep.
- **Fix sketch**: Extract `PROFILING_THRESHOLDS = { FPS_60_BUDGET_MS: 16.67, FPS_30_BUDGET_MS: 33.33, DRAW_CALL_TARGET: 2000, MEMORY_PEAK_WARN_MB: 500, GC_PAUSE_WARN_MS: 3, BUDGET_HIT_RATE_TARGET: 95 }` into a single module imported by both parser and triage engine, and re-exported for any future chart axis/marker/threshold-line component.
