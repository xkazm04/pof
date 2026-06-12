# Quality Evaluation Engine — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Batch-review "Abort" (and the 10-min timeout) never kills the underlying CLI execution
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/app/api/feature-matrix/batch-review/route.ts:41`
- **Scenario**: If the user clicks Abort while a module review is in flight (or a review hangs past the 600s timeout at line 49), `waitForExecution` merely stops *waiting*: it unsubscribes and returns `'aborted'`/`'error'`. The route imports only `startExecution`/`getExecution`/`subscribeToExecution` — it never calls `abortExecution` (which exists and is exported at `src/lib/claude-terminal/cli-service.ts:333`).
- **Root cause**: The design assumes "stop observing the execution" equals "stop the execution". The Claude CLI process spawned by `startExecution` keeps running to completion in the background after the batch is marked aborted/errored.
- **Impact**: Abort is success theater — the UI shows "Aborted" while the orphaned CLI session keeps burning tokens for minutes; on timeout the module is marked `error` while the review actually continues (and its `<<<CALLBACK>>>` payload is never processed even if it succeeds, so the work is paid for and discarded).
- **Fix sketch**: Import `abortExecution` and call it in the `result === 'aborted'` branch, in the timeout path of `waitForExecution`, and in the POST `action === 'abort'` handler for `mod.executionId` of the currently running module.

## 2. BatchReviewPanel polling interval is never (re)created on mount/resume — progress freezes and the recovery path is swallowed
- **Severity**: High
- **Lens**: bug
- **Category**: state-corruption (stale UI)
- **File**: `src/components/modules/evaluator/BatchReviewPanel.tsx:61`
- **Scenario**: Start a batch, then switch to another evaluator tab (the panel unmounts — `EvaluatorModule.tsx:173` renders it conditionally) or let the module suspend, then come back. The mount/resume effect calls `pollStatus()` exactly once; the `setInterval` is only ever created inside `startBatch` (line 84). The panel now shows "Reviewing… N%" with an Abort button, frozen forever. Same on page reload during a running batch. Worse: clicking Abort after the batch has actually finished server-side gets a 400 (`No active batch to abort`), `apiFetch` throws (`src/lib/api-utils.ts:78`), and the `catch { /* silent */ }` skips the follow-up `pollStatus()` — so even the escape hatch does nothing visible.
- **Root cause**: Polling lifecycle is tied to the *start* action instead of the *observed state*. `useSuspendableEffect`'s cleanup clears `pollRef` on suspend, and the resume path has no "if running, resume interval" logic.
- **Impact**: Frozen progress UI; "Review All Modules" stays hidden (stale `isRunning === true`), blocking the user from the feature until a lucky refetch; silent-catch makes the stuck state unrecoverable without a reload that happens to land after batch completion.
- **Fix sketch**: In the mount/resume effect, after the initial `pollStatus()`, create the interval whenever the fetched batch is `running` (e.g. derive `shouldPoll` from `batch?.status` in an effect that owns the interval). Remove interval creation from `startBatch`. In `abortBatch`, run `pollStatus()` in a `finally` so a 400 still refreshes state.

## 3. A *completed* scan with errored passes wipes the module's baseline and fabricates "Resolved" findings
- **Severity**: High
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/lib/evaluator/deep-eval-engine.ts:176`
- **Scenario**: During a full deep eval, one module's passes all fail (HTTP `!response.ok` at line 176, or fetch/parse throws at line 191) — the engine marks them `error`, `continue`s, and the run still finishes with `status: 'completed'` and zero findings for that module. `applyScanResult` (DeepEvalResults.tsx:127-129) then calls `mergeBaseline(previous, currentFlat, scope)` with the errored module *in scope*, which drops all of its prior baseline findings (`regression-diff.ts:131`), and `diffScans` reports every one of them as RESOLVED.
- **Root cause**: "Module was in scope" is conflated with "module was successfully evaluated". Pass-level errors are recorded in `passStatuses` but discarded after the run — neither `DeepEvalResult` nor the baseline merge knows the module produced no findings because it *failed*, not because it is clean. This is distinct from the known 2026-06-09 #4 (cancel/error of the whole run): here the run status IS `completed`, so the proposed "only persist when completed" fix does not cover it.
- **Impact**: Corrupted regression baseline persisted to localStorage + a false "N resolved" celebration banner; the next scan then floods the user with false "New" findings for issues that never went away.
- **Fix sketch**: Have `runDeepEval` return per-module success info (e.g. `failedModules: string[]` derived from `passStatuses`). In `applyScanResult`, exclude failed modules from the `scope` passed to `mergeBaseline`/`diffScans`, and surface "M modules failed to evaluate" in the summary bar.

## 4. Progress grid renders 7 cells per row in a `grid-cols-6` grid — every status row shifts one column
- **Severity**: Medium
- **Lens**: bug
- **Category**: wrong-display (regression from adding the ground-truth pass)
- **File**: `src/components/modules/evaluator/DeepEvalResults.tsx:535`
- **Scenario**: Run any deep eval. The per-module pass grid declares `grid-cols-6`, but the header emits 1 module cell + 4 pass labels (`EVAL_PASSES` now has 4 entries — `module-eval-prompts.ts:18`) + 2 filler `<span/>`s = 7 cells, and each `ModuleProgressRow` (lines 571-584) likewise emits 7. Every row overflows by one cell, so with 13 modules the grid degrades into a diagonal scramble: status icons appear under the wrong pass headers and next to the wrong module names.
- **Root cause**: The grid was sized for the original 3 passes (1 + 3 + 2 fillers = 6). When `ground-truth` was added to `EVAL_PASSES`, the column count and filler spans were not updated. (`combat-trace` is additionally never shown as a column even while it runs, though it counts toward `totalSteps`.)
- **Impact**: The progress panel actively misinforms — users see "error"/"done" icons attributed to the wrong module/pass while deciding whether to cancel an expensive run.
- **Fix sketch**: Derive columns from the pass list: `gridTemplateColumns: \`minmax(0,1.5fr) repeat(${EVAL_PASSES.length}, 1fr)\`` and delete the filler `<span/>`s (both header and row). Optionally append a combat-trace column for modules that have it.

## 5. "Improved" feature status is excluded from Overall Progress and all completion bars
- **Severity**: Medium
- **Lens**: bug
- **Category**: wrong-results
- **File**: `src/components/modules/evaluator/AggregateQualityDashboard.tsx:181`
- **Scenario**: A module with e.g. 4 `implemented` + 4 `improved` of 10 features shows `pctComplete` 80% on its heatmap cell tint (line 119 counts improved), but the "Overall Progress" KPI (line 181: `implemented / total` only), the Project Completion bar (lines 248-274: implemented/partial/missing segments only — improved renders as an empty gap that reads as "unknown"), the per-cell mini bar (lines 422-450), and the detail panel's Feature Status rows (lines 514-537, no "Improved" row) all silently drop the 4 improved features.
- **Root cause**: `improved` was added to the aggregate schema and to `pctComplete`/`reviewed` math, but every renderer that enumerates statuses still hardcodes the original implemented/partial/missing triple.
- **Impact**: Project completion is systematically understated (the better the project gets — improved is the *best* status — the more wrong the headline number becomes), and the same module shows contradictory numbers between its cell tint and the KPI/bars.
- **Fix sketch**: Fold `implemented + improved` into the success segment of every bar (or give improved its own segment/StatusRow), and compute `overallPct` from `(implemented + improved) / total` to match `pctComplete`.

## UI findings

## 6. "Needs Attention" and "Stale Reviews" rows are mouse-only clickable divs
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/AggregateQualityDashboard.tsx:654`
- **Scenario**: The worst-quality rows (lines 653-658) and stale-module rows (lines 713-718) are `<div onClick … cursor-pointer>` with hover styling. Keyboard users can't Tab to them, screen readers announce them as plain text, and Enter/Space do nothing — yet they're the primary affordance for jumping into a problem module's detail panel.
- **Root cause**: Interactive-div anti-pattern; the adjacent heatmap correctly uses `<button>` (line 329) but these lists were hand-rolled without role/tabIndex/key handlers.
- **Impact**: WCAG 2.1.1 keyboard failure on the two lists that surface the most urgent modules; inconsistent with the rest of the dashboard where everything actionable is a real button.
- **Fix sketch**: Replace the row `<div>`s with `<button type="button" className="w-full text-left …">` (the flex layout is preserved), which gives focus ring, Enter/Space, and correct semantics for free.

## 7. Disclosure and toggle controls expose no expanded/pressed state to assistive tech
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/DeepEvalResults.tsx:623`
- **Scenario**: Module headers (line 623), category headers (line 703), the module-selector toggle (line 281), and BatchReviewPanel's "Module details" (BatchReviewPanel.tsx:228) all collapse/expand content with only a chevron-icon swap; the module-selector checkboxes (lines 357-374) convey selection purely via a colored square. A screen-reader user hears "Combat, 5 findings, button" with no idea whether it's open, and "arpg-combat, button" with no idea whether it's selected for the next run.
- **Root cause**: The disclosure pattern is re-implemented ad hoc in four places without `aria-expanded`; the pseudo-checkboxes lack `aria-pressed` (or `role="checkbox"`+`aria-checked`).
- **Impact**: Selecting the wrong module set for an expensive eval run is invisible to AT users; state changes are inaudible.
- **Fix sketch**: Add `aria-expanded={isExpanded}` to each disclosure button and `aria-pressed={selected}` to the module-selector buttons. Longer term, extract a shared `<DisclosureButton>` since the chevron+label+count trio is repeated verbatim.

## 8. Hardcoded hex colors bypass the status-token system; selection ring uses error-red
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/evaluator/AggregateQualityDashboard.tsx:341`
- **Scenario**: The heatmap cell's *selected* state draws `border-[#ef4444]/50 ring-[#ef4444]/30` (line 341) and the "Review Module" button is `bg-[#ef4444]/10 text-[#ef4444]` (line 499) — raw hex instead of `STATUS_ERROR`/`MODULE_COLORS.evaluator`, and semantically the *error* red, so a perfectly healthy 5-star module gets an alarming red ring just for being selected. BatchReviewPanel similarly hardcodes `text-[#f87171]` for module errors (line 280) instead of `STATUS_ERROR` used three lines above it.
- **Root cause**: Leftover literals predating the shared `chart-colors` token adoption that the rest of both files (and the file's own header comment) follow.
- **Impact**: Theme drift (tokens can change, these won't) and a misleading "something is wrong" signal on selection; inconsistent with DeepEvalResults where selection/accent uses `MODULE_COLORS.evaluator`.
- **Fix sketch**: Use `MODULE_COLORS.evaluator` (or `border-border-bright` + ring in the evaluator accent) for the selected cell and the Review button; replace `text-[#f87171]` with `style={{ color: STATUS_ERROR }}`.

## 9. The accent "pill button" is duplicated 6+ times with three different alpha schemes
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/evaluator/DeepEvalResults.tsx:309`
- **Scenario**: The same visual control — accent-tinted bg, accent text, 1px accent border, rounded, xs font — is hand-built inline for Run Deep Eval (lines 308-317, alphas `12`/`25`), Fix Critical/High (677-680, `12`/`25`), per-finding Fix (855-859, `12`/`25`), BatchReviewPanel's Review All Modules (162-164, `OPACITY_10`/`OPACITY_30`) and Run First Review (312, `14`/`38`). Three different opacity sets render visibly different tints of "the same" button across panels rendered on adjacent tabs; hover treatment also differs (`hover:brightness-110` vs `hover:brightness-125` vs none).
- **Root cause**: No shared `AccentButton`/`PillButton` primitive, so each call site re-derives the tint and drifts.
- **Impact**: Subtle but app-wide inconsistency in the engine's primary CTAs; every future severity/accent tweak must be replicated in 6 places.
- **Fix sketch**: Extract `<AccentPillButton accent={…} icon={…} disabled loading>` (one alpha pair, one hover rule) and replace all six call sites; the disabled/loading spinner handling collapses into it too.

## 10. Stale-threshold input snaps to 7 while typing and ignores its own max
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/AggregateQualityDashboard.tsx:703`
- **Scenario**: To change the threshold from 7 to 14, the user selects the field and deletes — `parseInt('')` is NaN, `|| 7` kicks in, and the field instantly snaps back to 7 mid-edit, fighting the keystroke. Typing `300` is also accepted into state despite `max={90}` (the max is only an HTML hint, never clamped in the setter), silently marking nothing stale.
- **Root cause**: Controlled number input parses and clamps on every keystroke with a falsy-coalescing default, and the clamp is one-sided (`Math.max(1, …)` only).
- **Impact**: Frustrating micro-interaction on the only configurable control in the dashboard; out-of-range values produce misleading stale counts.
- **Fix sketch**: Keep the raw string in local state and commit on blur/Enter with `Math.min(90, Math.max(1, parsed || 7))`; or allow empty string during editing and clamp both bounds on commit.
