# Quality Evaluation Engine — Bug + UI Scan

> Total: 9

> Note: all four scoped files have been refactored from single-file components into folders since the context map was written. Every file inside each folder was read in full:
> - `EvaluatorModule.tsx` -> `EvaluatorModule/{index.tsx, TabControls.tsx, types.ts}`
> - `DeepEvalResults.tsx` -> `DeepEvalResults/{index.tsx, constants.tsx, FindingRow.tsx, ModuleSection.tsx, ModuleSelectorPanel.tsx, ProgressPanel.tsx, ResultsSection.tsx, useDeepEvalResults.ts}`
> - `BatchReviewPanel.tsx` -> `BatchReviewPanel/{index.tsx, constants.ts, ModuleRow.tsx}`
> - `AggregateQualityDashboard.tsx` -> `AggregateQualityDashboard/{index.tsx, helpers.ts, types.ts, HeatmapGrid.tsx, ModuleDetailPanel.tsx, QualityDiscrepancyBanner.tsx, StaleReviewsPanel.tsx, SummaryPanels.tsx, WorstModulesPanel.tsx, MetricCard.tsx, Sparkline.tsx, StatusRow.tsx}`
>
> Root-cause tracing for finding #1 also touched `src/lib/evaluator/deep-eval-engine.ts`, which backs `DeepEvalResults` but sits outside the module-view scope.

## Bug findings

### 1. Cancelling a deep eval silently corrupts the regression baseline
- **Severity**: Critical
- **Category**: bug
- **File**: src/components/modules/evaluator/DeepEvalResults/useDeepEvalResults.ts:80-108 (root cause: src/lib/evaluator/deep-eval-engine.ts:280-310)
- **Scenario**: User selects all 17 evaluable modules, clicks "Run Deep Eval", then clicks Cancel partway through (e.g. after 3 of 17 modules finished). `handleCancel` calls `cancelDeepEval()`, which aborts the internal `AbortController`.
- **Root cause**: `runDeepEval`'s catch block (deep-eval-engine.ts:288-310) handles the `AbortError` by setting `progress.status = 'cancelled'` but then still **resolves** (not rejects) with a `DeepEvalResult` whose `modulesEvaluated: moduleIds` is the *original full requested list*, not the subset actually completed before the abort. Back in `useDeepEvalResults.applyScanResult`, `scope` is computed as `evalResult.modulesEvaluated.filter(m => !evalResult.failedModules.includes(m))` — and modules cut short by cancellation are neither in `failedModules` nor missing from `modulesEvaluated`, so they're treated as "successfully evaluated with zero findings." The comment directly above (`applyScanResult`, line ~85-88) states the exact invariant this violates: "'In scope' must mean successfully evaluated... merging it would wipe its baseline and report every prior finding as falsely RESOLVED."
- **Impact**: Every module that hadn't been reached yet when Cancel was pressed has its real prior findings (from the last full scan) wiped from the baseline and silently reported as RESOLVED on the next scan/diff. The corrupted baseline is also persisted server-side via the `/api/evaluator/results` POST, so the damage survives a reload. A partial, user-aborted scan is indistinguishable from a clean completed one to every downstream consumer.
- **Fix sketch**: Track which modules actually reached `'done'`/`'error'` in `passStatuses` before the abort and return that as `modulesEvaluated` on the cancelled path (or add a distinct `cancelledModules` list); in `applyScanResult`, exclude any module whose scan didn't fully complete from `scope`, exactly like `failedModules` already is.

### 2. Dashboard fetch failures are swallowed, showing stale data as if healthy
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/evaluator/AggregateQualityDashboard/index.tsx:33-47
- **Scenario**: `/api/feature-matrix/aggregate` or `/api/feature-matrix/history` intermittently fails (e.g. DB lock, transient 500) while the user has the Quality tab open and hits refresh.
- **Root cause**: `fetchData`'s `catch` block only does `console.error(...)`; it never sets any error/stale flag. `finally { setIsLoading(false) }` always runs, so the loading spinner disappears and the dashboard renders using whatever `aggregates`/`historyMap` state it already had (empty on first load, or stale on a refresh) with zero visual indication anything went wrong.
- **Impact**: A quality/health dashboard that is specifically meant to catch regressions can itself silently regress to "everything looks fine" (empty heatmap or last-known-good data) on a transient backend failure, with no signal for the user to distinguish "genuinely healthy" from "couldn't load."
- **Fix sketch**: Add an `error` state set in the catch block and render a visible inline banner (same pattern already used in `BatchReviewPanel`'s `error` state) instead of failing open to silence.

### 3. Batch-review polling has no request sequencing — stale response can overwrite fresher state
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/BatchReviewPanel/index.tsx:28-49
- **Scenario**: The panel polls `/api/feature-matrix/batch-review` every 3s while `isRunning`. Under a slow/backed-up server, an earlier poll's response can arrive after a later poll's response (classic out-of-order network resolution).
- **Root cause**: `pollStatus` is a bare `apiFetch` + `setBatch(data.batch)` with no request token, sequence number, or `AbortController` to discard out-of-order responses. Every resolved fetch unconditionally overwrites `batch` state regardless of when it was issued.
- **Impact**: The module progress list / percentage can briefly flicker backwards (e.g. show 40% again after having shown 60%), and in the worst case a stale "running" snapshot can overwrite a genuinely "completed" one, leaving the Abort button visible or the completion banner hidden after the batch has actually finished.
- **Fix sketch**: Track an incrementing request id (or use `AbortController` per poll) and ignore any response whose id isn't the latest issued.

### 4. Progress bar and status text disagree when a module is "skipped"
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/BatchReviewPanel/index.tsx:95-98, 184, 193-206
- **Scenario**: A batch review run ends with `batch.status === 'completed'` but one or more modules have `status: 'skipped'` (a real, defined `ModuleReviewStatus` per `BatchReviewPanel/constants.ts`).
- **Root cause**: `completed`/`errored` counts only tally `'completed'` and `'error'` statuses; `pct` and the two-segment progress bar are built purely from those two buckets (`(completed / total)` + `(errored / total)`). Skipped modules are counted in `total` but contribute to neither segment.
- **Impact**: The status label reads "Complete" (driven off `batch.status`) while the progress bar visibly stops short of 100% and stays that way forever — a straightforward visual contradiction that reads as a stuck/broken batch even though the batch genuinely finished.
- **Fix sketch**: Include a third `skipped` segment in the bar (as already done conceptually for `completed`/`errored`), or fold `skipped` into the "resolved" bucket used for both the percentage and the bar so 100% is reachable.

### 5. Per-module extra eval passes are invisible in the live progress grid
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/DeepEvalResults/ProgressPanel.tsx:51-58, 92-96
- **Scenario**: `getPassesForModule` (module-eval-prompts.ts) appends module-specific extra passes beyond the standard 4 (deep-eval-engine.ts's own comment cites `arpg-combat`'s `combat-trace` pass as an example). While that module is being deep-evaluated, its 5th pass runs and can error.
- **Root cause**: `ProgressPanel`'s column header and each `ModuleProgressRow` iterate only over the fixed, module-agnostic `EVAL_PASSES` constant (`['ground-truth','structure','quality','performance']`), not the per-module pass list actually stored as keys in `progress.passStatuses[moduleId]`. The `grid-cols-6` layout is also sized exactly for "module + 4 passes + 2 spacer cells," leaving no room for a 5th status cell even if it were rendered.
- **Impact**: If a module's extra pass silently errors mid-run, the live progress UI shows that module as if all its (visible) passes are running/done fine — the failure only surfaces later, after the scan completes, buried in the final findings/failedModules list rather than in real time.
- **Fix sketch**: Derive the displayed pass columns per-row from `Object.keys(passes)` (or from `getPassesForModule(moduleId)`) instead of the global `EVAL_PASSES`, and make the grid template dynamic (or switch to flex-wrap) so extra columns actually fit.

## UI findings

### 6. 27-tab horizontal-scroll bar is a discoverability dead end
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/EvaluatorModule/index.tsx:78-119, TabControls.tsx:23-102
- **Scenario**: The Evaluator module exposes 27 tabs across 5 labeled groups (Analysis, Quality, Simulation, Pipeline, Intelligence), all rendered as a single `overflow-x-auto` row of `w-3 h-3` icon + `text-xs` label chips with only an 8px fade + chevron as an overflow affordance.
- **Root cause**: `ScrollableTabBar` (TabControls.tsx) has no responsive fallback — at any viewport width most of the 27 tabs are off-screen and only discoverable by scrolling or hovering for a tooltip; there's no dropdown/menu alternative, no way to jump directly to a group, and no persistent indication of how many tabs exist beyond the visible slice.
- **Impact**: New users are unlikely to discover tabs like "Wrapped," "Digest," or "Roadmap" unless they scroll the entire bar; the flat 27-way list also gives every tab equal visual weight regardless of how often it's used, working against the section dividers that already exist in the markup.
- **Fix sketch**: Collapse to a grouped dropdown/menu at narrow widths (breakpoint-driven), or add a "jump to group" affordance keyed off the existing `TabDivider` labels so the section structure that's already encoded in the JSX becomes navigable, not just visual.

### 7. Fixed 4-column grids ignore viewport width
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/AggregateQualityDashboard/HeatmapGrid.tsx:75, src/components/modules/evaluator/DeepEvalResults/ModuleSelectorPanel.tsx:52
- **Scenario**: Both the quality heatmap and the deep-eval module selector render `grid-cols-4` unconditionally, regardless of container width.
- **Root cause**: Neither grid uses responsive Tailwind variants (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` or similar); at narrower windows/panels (the app is desktop-first but panels can be resized/split) cells become cramped, truncating module labels and squeezing the sparkline/star-rating rows.
- **Impact**: On any container narrower than the grid's implicit design width, cell content overlaps or truncates rather than reflowing — the opposite of the mobile-first, breakpoint-aware pattern used elsewhere in the design system.
- **Fix sketch**: Add responsive column-count breakpoints to both grids, or switch to an auto-fit/auto-fill CSS grid (`grid-cols-[repeat(auto-fit,minmax(180px,1fr))]`) so column count derives from available width instead of being hardcoded.

### 8. Hardcoded hex colors bypass the shared design-token system
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/AggregateQualityDashboard/ModuleDetailPanel.tsx:53, HeatmapGrid.tsx:100-101, src/components/modules/evaluator/BatchReviewPanel/ModuleRow.tsx:43
- **Scenario**: Most severity/status coloring in this context correctly flows through `@/lib/chart-colors` tokens (`STATUS_ERROR`, `statusBg`, `statusBorder`, `SEVERITY_TOKENS`, etc.), including in the very same files. But a few spots hardcode a raw `#ef4444` (the "Review Module" button and the selected-cell ring/border) or `text-[#f87171]` (the batch-row error label) instead of reusing `STATUS_ERROR`.
- **Root cause**: These specific spots were written (or later edited) without going back through the token layer, likely because the token value happens to visually match today.
- **Impact**: If the design system's error/critical color is ever retuned (e.g. for contrast or theme reasons), these three spots silently fall out of sync with every other error-colored element in the same views, producing a visible two-tone inconsistency for what should be one semantic color.
- **Fix sketch**: Replace the raw hex literals with `STATUS_ERROR` / `statusBorder(STATUS_ERROR)` / `statusBg(STATUS_ERROR)`, matching the pattern already used a few lines away in the same files (e.g. `WorstModulesPanel.tsx`).

### 9. "Fix" loading state is global, not per-finding
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/DeepEvalResults/useDeepEvalResults.ts:35-40, FindingRow.tsx:116-132, ModuleSection.tsx:94-108
- **Scenario**: A user with Deep Eval results open across multiple expanded modules clicks "Fix" on one finding in Module A while findings in Module B are also visible.
- **Root cause**: `fixCli` is a single shared `useModuleCLI` instance (`sessionKey: 'deep-eval-fix'`) for the entire `DeepEvalResults` view, and `isFixRunning` (from `fixCli.isRunning`) is threaded uniformly into every `FindingRow` and every module's "Fix Critical/High" batch button via `ResultsSection` → `ModuleSection` → `FindingRow`. There is no per-finding or per-module identifier tracked alongside the running flag.
- **Impact**: The instant one fix prompt is sent, every other Fix button on the page — across every module and every finding, not just the one clicked — switches to its spinner state and disables. A user watching a different module's Fix button has no way to tell "my fix is running" from "someone else's fix is running and mine is just blocked," which reads as the whole page being busy rather than one targeted action.
- **Fix sketch**: Track which finding/module id is currently associated with the in-flight CLI send (e.g. store the target id alongside `fixCli.isRunning`) and only show the spinner/disabled state on that specific row/button; other Fix buttons can stay enabled (or show a lighter "queued" affordance) rather than all going dark simultaneously.
