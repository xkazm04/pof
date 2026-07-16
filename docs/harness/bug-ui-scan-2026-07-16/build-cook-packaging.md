# Build, Cook & Packaging — Bug + UI Scan

> Total: 9

**Context-map note**: `useBuildPipeline.ts` does not exist under `src/hooks/` (or anywhere in the repo) — the pipeline orchestration logic actually lives in `src/components/modules/game-systems/BuildConfigSelector/index.tsx` (a component, not a hook), which owns `cookRequest`/`preflight`/`smokeRequest` state and wires `PreflightPanel` → `CookProgress` → `SmokeTest`. `CookProgress.tsx` and `BuildHistoryDashboard.tsx` have both been refactored into folders (`CookProgress/{index,useCookProgress,helpers,constants,types,CookLogRow}.tsx` and `BuildHistoryDashboard/{index,HistoryTab,BuildRow,MetricsRow,PlatformBreakdown,RecordBuildForm,SortableHeader,VersionPanel,types}.tsx`); every file in both folders was read. `PackagingView.tsx`, `PreflightPanel.tsx`, and `SmokeTest.tsx` still exist as flat files, matching the context map.

## Bug findings

### 1. Pre-flight results aren't scoped to the project that requested them
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/game-systems/PreflightPanel.tsx:67-98
- **Scenario**: User opens the Pipeline tab for Project A; the `fast` auto-check kicks off via `setTimeout(0)` (line 96). Before it resolves, the user switches to Project B (new `projectPath`/`projectName` props). The effect at line 94 re-fires and starts a second `fast` check for Project B, but nothing aborts or discards the in-flight Project A request.
- **Root cause**: `runCheck` has no `AbortController` and no guard comparing the response's originating project to the currently-active `projectPath`/`projectName`. `setResults` (line 85) merges by check-kind id only, so whichever response lands last wins regardless of which project it belongs to.
- **Impact**: The panel can show Project B's "ready to cook" status while actually reflecting Project A's stale preflight results (or vice versa), and `onStatusChange` propagates the wrong `canCook` value to the packaging gate in `BuildConfigSelector` — a false "ready" can let a doomed cook start.
- **Fix sketch**: Capture an `AbortController` per `runCheck` call tied to `projectPath+projectName`, abort the previous one on effect re-run, and drop responses whose captured project no longer matches the current props before calling `setResults`.

### 2. Smoke-test running/result state isn't reset for a same-path re-run
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-systems/SmokeTest.tsx:31-59
- **Scenario**: A build profile with a fixed output path is cooked twice in a row (overwriting the same `.exe`). `BuildConfigSelector` remounts `SmokeTest` via `key={smokeRequest?.exePath ?? 'idle'}` (BuildConfigSelector/index.tsx:268) — but since `exePath` is identical both times, React does **not** remount the component on the second cook.
- **Root cause**: `running` is only initialized once via `useState(!!request)` on mount (line 32); the `useEffect` at line 38 never calls `setRunning(true)`/`setResult(null)`/`setError(null)` at the start of a new run when `request` changes without a remount — it only writes `running=false` on completion.
- **Impact**: On the second identical-path smoke test, the UI keeps showing the *first* cook's pass/fail result (or nothing) for the full observation window instead of the "Launching staged build…" spinner, misleading the operator about whether a new test is actually in flight.
- **Fix sketch**: At the top of the effect (once `request` is confirmed non-null and changed), explicitly `setRunning(true); setResult(null); setError(null);` before issuing the fetch.

### 3. Build-history "Record" form accepts non-numeric input and silently nulls it
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-systems/BuildHistoryDashboard/RecordBuildForm.tsx:15-21
- **Scenario**: Operator fatfingers the Size or Duration field (e.g. types "1.2gb" or "n/a") and hits "Record Build".
- **Root cause**: `parseFloat(sizeGb)` / `parseFloat(durationMin)` are only guarded by a truthiness check on the raw string (`sizeGb ? … : undefined`), not by `isNaN` validation. A malformed string like "n/a" produces `NaN`, and `JSON.stringify({ sizeBytes: NaN })` silently serializes it as `null` (line 18, `handleSubmit` in `BuildHistoryDashboard/index.tsx`).
- **Impact**: The build record is saved with no error shown to the user, silently dropping the size/duration data they thought they entered — a classic "success theater" failure with no feedback loop.
- **Fix sketch**: Validate with `Number.isFinite(parseFloat(...))` before submit; disable the Record button or show an inline error when either populated field parses to `NaN`.

### 4. No double-submission guard on "Record Build"
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-systems/BuildHistoryDashboard/index.tsx:116-128
- **Scenario**: Operator double-clicks "Record Build" (RecordBuildForm.tsx:67-72) — e.g. on a slow connection where the first click's request hasn't resolved yet.
- **Root cause**: `handleRecord` is `async` but nothing disables the submit button or sets a `submitting` flag while the POST is in flight; `RecordBuildForm` has no local pending state either.
- **Impact**: Two identical POST `/api/packaging/history` (`action: 'record'`) requests can fire, creating two duplicate build-history rows for what the user believed was a single record action.
- **Fix sketch**: Track a `submitting` boolean in `BuildHistoryDashboard` (or lift into `RecordBuildForm`), disable the submit button and ignore repeat `onSubmit` calls while `true`.

### 5. Build-record deletion has no confirmation or undo
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/game-systems/BuildHistoryDashboard/BuildRow.tsx:107-116
- **Scenario**: Operator expands a build row to read its notes/error summary and misclicks the small (`w-2.5 h-2.5`, opacity-60-by-default) Delete icon right below.
- **Root cause**: `onDelete(build.id)` fires immediately on click (only `stopPropagation` is applied, no confirm step), and `handleDelete` in `BuildHistoryDashboard/index.tsx:130-137` calls the DELETE API directly with no soft-delete/undo path.
- **Impact**: A single misclick permanently destroys build-history data (size/duration/error trend used by the Trends tab and size-budget tracking) with no recovery path.
- **Fix sketch**: Add a confirm step (native `confirm()` at minimum, or a two-click "confirm delete" affordance matching the app's existing patterns) before calling `onDelete`.

## UI findings

### 6. Same "Config" concept rendered with two different input patterns in one flow
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/game-systems/BuildConfigSelector/ProfileEditor.tsx:88-106 vs src/components/modules/game-systems/BuildHistoryDashboard/RecordBuildForm.tsx:42-50
- **Scenario**: A user creates a build profile in the Pipeline tab, where "Configuration" is a row of 4 selectable pill-buttons with descriptions (`CONFIG_OPTIONS`), then switches to the Builds tab's "Record Build" form, where the semantically identical field is a plain native `<select>` with only 4 bare option labels.
- **Root cause**: The two forms were built independently without sharing a `Config` input component, so the same enum (`Development | DebugGame | Shipping | Test`) gets two visually and interactively distinct treatments within one context.
- **Impact**: Breaks the "this is one coherent packaging tool" mental model — inconsistent affordances for identical data erode trust in the UI and cost the user re-orientation time switching tabs.
- **Fix sketch**: Extract a shared `<ConfigSelect>` (or reuse the pill-button group) and use it in both `ProfileEditor` and `RecordBuildForm`.

### 7. No loading placeholder in the main content area during initial fetch
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/game-systems/BuildConfigSelector/index.tsx:220-255 and src/components/modules/game-systems/BuildHistoryDashboard/index.tsx (builds fetch, lines 91-114 / render 199-246)
- **Scenario**: On first mount, `loading` is `true` and `profiles`/`builds` are empty arrays. `BuildConfigSelector`'s empty-state branch is gated by `profiles.length === 0 && !loading` (line 220), so while loading it falls into the `else` branch and renders `<div className="grid gap-2">{[].map(...)}</div>` — an empty, visually blank block. `BuildHistoryDashboard` similarly shows no `stats`/`MetricsRow`/`PlatformBreakdown` and an empty `HistoryTab` table body until the fetch resolves.
- **Root cause**: The only loading affordance in either view is the small header `RefreshCw` spin icon (`w-3.5 h-3.5`); there is no skeleton, spinner, or placeholder text in the primary content region.
- **Impact**: On a slow API response the user sees a mostly-blank panel with just a tiny spinning icon in the corner — reads as "broken" rather than "loading," especially since the empty-builds message ("No build profiles yet…") is withheld specifically to avoid this but nothing fills the gap instead.
- **Fix sketch**: Render a lightweight skeleton (a few pulsing placeholder rows/cards) when `loading && profiles.length === 0` / `loading && builds.length === 0`, distinct from the true empty state.

### 8. Fixed-pixel grid columns in the build-history table don't adapt to narrow widths
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-systems/BuildHistoryDashboard/HistoryTab.tsx:60 and BuildRow.tsx:23
- **Scenario**: The table header and every row use `grid-cols-[auto_1fr_80px_80px_80px_60px_auto]` — four hard-coded pixel-width columns (Platform/Config/Size/Time) alongside a flexible name column. If the Packaging module is viewed in a narrower panel (split view, smaller window, or a future mobile/tablet layout), the fixed columns don't shrink and the `1fr` build-name column gets crushed, truncating build names/version badges first.
- **Root cause**: No responsive variant (e.g. `sm:`/`md:` grid-template overrides) or alternate stacked-row layout for narrow containers; columns are absolute pixel widths rather than `minmax()`/`clamp()`-based.
- **Impact**: In a constrained viewport the most useful identifying info (build id/version/name) is squeezed out first while fixed numeric columns keep their full width unnecessarily.
- **Fix sketch**: Switch to `grid-template-columns: auto minmax(0,1fr) minmax(60px,80px) …` or collapse Size/Time into a secondary line under the name column below a breakpoint.

### 9. Five-tile metrics row has no responsive collapse
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-systems/BuildHistoryDashboard/MetricsRow.tsx:31
- **Scenario**: `MetricsRow` renders a hard `grid-cols-5` (Success Rate, Avg Duration, Avg Size, Failed, Version). On any viewport narrower than the module's typical desktop panel width, all five `SurfaceCard` tiles compress to fit one row, causing label/value truncation (e.g. "Success Rate" wrapping awkwardly against a 3-digit percentage).
- **Root cause**: No `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`-style responsive stepping — the layout assumes a fixed minimum width.
- **Impact**: Stat cards become cramped/illegible before the rest of the dashboard (which does wrap more gracefully) shows any strain, making this row the first visible breakage point when the panel narrows.
- **Fix sketch**: Add responsive breakpoint classes so the grid steps down (e.g., 2 columns on narrow, 3 on medium, 5 on wide) instead of a single fixed 5-column track.
