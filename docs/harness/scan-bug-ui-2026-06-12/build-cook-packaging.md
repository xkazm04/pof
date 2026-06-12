# Build, Cook & Packaging — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)
> Note: scope entry `src/hooks/useBuildPipeline.ts` no longer exists on master (deleted in b98de84; nothing imports it). Commit cd1580f (staged-size measurement) was verified — the measurement itself is correct (null vs 0 semantics, no symlink recursion), no regression found in the fix itself; findings 2 and 4 are adjacent gaps it exposes.

## Bug findings (new since 2026-06-09)

## 1. Aborting a cook kills only the `cmd.exe` wrapper — the UAT tree is orphaned and the run is recorded as `failed`
- **Severity**: High
- **Lens**: bug
- **Category**: recovery-gap
- **File**: `src/lib/packaging/cook-executor.ts:92`
- **Scenario**: A 30-minute cook is running. The user refreshes the browser, closes the tab, or switches away from the Pipeline view (CookProgress's effect cleanup at `src/components/modules/game-systems/CookProgress.tsx:244` calls `ctrl.abort()`, which fires `req.signal` in the execute route). The abort listener calls `child.kill('SIGTERM')` on the spawned `cmd.exe`.
- **Root cause**: On Windows, `child.kill` is `TerminateProcess` on the direct child only — `cmd.exe` dies, but RunUAT.bat's descendants (AutomationTool, UBT, UnrealEditor-Cmd) are orphaned and keep cooking headless. Meanwhile the executor sees stdout close + non-zero exit, yields an `error` event, and the route's `finally` inserts `status: 'failed'` — the `'cancelled'` status in `BuildRecord` is never written by anything. The codebase already knows the correct pattern: smoke-test's `defaultKillPid` uses `taskkill /PID … /T /F` (`src/lib/packaging/smoke-test.ts:92`).
- **Impact**: Orphaned UE processes burn CPU/RAM for up to an hour and hold locks on the staging directory, so the user's immediate re-cook collides with the ghost cook (corrupted stage or spurious failure). Build history records a failure the user intended as a cancel (or that actually completed on disk), permanently skewing success-rate stats.
- **Fix sketch**: In the abort handler, kill the tree: `execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'])` instead of `child.kill`. In the executor's non-zero-exit path, check `opts.signal?.aborted` and yield a distinct cancelled event; have the execute route insert `status: 'cancelled'` for it.

## 2. `getSizeTrend` returns the *oldest* N rows — the size trend chart freezes once history exceeds the limit
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/packaging/build-history-store.ts:235`
- **Scenario**: The dashboard fetches `action=trend&limit=50`. Once more than 50 successful builds with a size exist, every newly cooked build is invisible in the Trends tab — the query is `ORDER BY created_at ASC LIMIT ?`, which selects the first 50 builds *ever* and discards everything after.
- **Root cause**: The query conflates "chronological order for plotting" with "which N rows to keep." `LIMIT` applies after `ASC` ordering, so it keeps the oldest window instead of the newest. This was masked before cd1580f because real cooks recorded `sizeBytes: 0` (filtered out as NULL-ish); now every real cook adds a sized row, so the 50-row cap will be hit quickly and the chart silently goes stale.
- **Impact**: Wrong results in the exact guardrail cd1580f was meant to revive — the operator watches a "trend" that stopped updating months ago and never sees current bloat. No error, no hint.
- **Fix sketch**: `SELECT … ORDER BY created_at DESC LIMIT ?`, then `rows.reverse()` before mapping, so the newest N plot oldest→newest. Same for both branches (platform-filtered and not).

## 3. SmokeTest's remount key is the exe path, which is identical for every cook of the same profile — second run shows a stale verdict with no running indicator
- **Severity**: Medium
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/components/modules/game-systems/SmokeTest.tsx:32`
- **Scenario**: User cooks the Win64 Shipping profile; smoke-test passes. Without leaving the page they cook the same profile again. The staged exe path is deterministic (`<stageDir>\<ProjectName>.exe`), so `key={smokeRequest?.exePath ?? 'idle'}` in BuildConfigSelector.tsx:336 does not change → the component does NOT remount. The effect re-fires (new request object identity) and a new 25-second test runs, but `running` (initialized once from `!!request`, only ever set to `false`) stays false and `result` still holds run #1's verdict.
- **Root cause**: The component's documented contract ("Parent gives this component a `key` tied to the request, so each new cook remounts it fresh") assumes the exe path uniquely identifies a run. It identifies a *profile*, not a run — re-cooks reuse the same staging path, so the remount that resets `running`/`result`/`error` never happens after the first cook.
- **Impact**: Success theater for the full observe window: during run #2 the panel shows run #1's "pass" (data-status `pass`, green check) with no spinner. A broken re-cook looks verified for 25+ seconds, and if the operator navigates away in that window they never see the real verdict.
- **Fix sketch**: Make the key a monotonic run id — e.g. include a counter/timestamp in `SmokeTestRequest` when `setSmokeRequest` is called and key on that — or drop the key contract and reset `running=true; result=null; error=null` at the top of the effect when `request` changes.

## 4. Real pipeline builds never receive a version — auto-increment only fires on hand-entered records
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/app/api/packaging/execute/route.ts:66`
- **Scenario**: Every cook run through the actual pipeline (interactive execute route, and the nightly runner at `src/lib/packaging/scheduled-build-runner.ts:134`) inserts its success row with no `version`. Only the manual "Record Build" form path (`history/route.ts:77`) calls `autoIncrementOnSuccess()`.
- **Root cause**: Versioning was wired into the manual record action and never into the two real write paths, so `version-manager.ts`'s documented behavior ("Auto-increment patch version on successful build") holds only for builds typed in by hand. The system has three success-insert sites and one version policy.
- **Impact**: `build_history.version` is NULL for every real cook: the dashboard's "Next: vX" counter never advances from actual builds, `getBuildStats().latestVersion` and the trend chart's version labels reflect only manual entries, and builds can't be correlated to releases. Silently misleading rather than erroring.
- **Fix sketch**: Call `autoIncrementOnSuccess()` in the execute route's done branch and in `runScheduledBuild`'s success record (or centralize: have `insertBuild` assign `version ??= autoIncrementOnSuccess()` when `status === 'success'`).

## 5. No mutual exclusion between interactive and scheduled cooks — two UATs can stage into the same directory concurrently
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/app/api/packaging/execute/route.ts:23`
- **Scenario**: The nightly schedule fires (or an operator clicks "Run now") while an interactive cook of the same platform is mid-flight — or the operator opens two browser tabs and packages from both. The execute route has no concurrency guard at all; `isRunning()` in `scheduled-build-runner.ts:260` guards only scheduled-vs-scheduled, so an interactive cook and a nightly cook run two `RunUAT BuildCookRun` processes against the same project simultaneously.
- **Root cause**: The "one cook at a time" invariant lives only in client state (`if (cookRequest !== null) return` in BuildConfigSelector) and in the scheduler's own flag; the server-side execute route assumes a single caller. Both cooks share the project's DDC, Intermediate, and the per-platform staging directory, which UAT cleans at start ("Cleaning Stage Directory") — the second cook deletes the first one's in-progress stage.
- **Impact**: Corrupted or interleaved staged output that can still be recorded as success (with a size measured from a mixed tree, feeding the budget gate garbage), spurious failures from file locks, and two history rows whose smoke/size notes cross-attach (compounding known finding #3 from 2026-06-09).
- **Fix sketch**: Add a server-side cook mutex shared by both paths: have the execute route check/set the same `isRunning()` flag (or a `globalThis` lock keyed by projectPath+platform) and return 409 when busy; release in the stream's `finally`.

## UI findings

## 6. Icon-only refresh button has no accessible name and sortable headers expose no sort state
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/game-systems/BuildHistoryDashboard.tsx:432`
- **Scenario**: A screen-reader user tabs through the Build History header and hears "button" with no name for the refresh control (bare `RefreshCw` icon). In the table, the Platform/Config/Size/Time/Date headers are buttons whose sort direction is conveyed only by a chevron color/rotation — there is no `aria-sort`, so the active sort is invisible to AT.
- **Root cause**: Icon-only button rendered without `aria-label`/`title` (the loading state is also only an animation), and the `SortableHeader` component (line 27) renders plain buttons outside any table semantics, with no `aria-sort` or visually hidden direction text.
- **Impact**: Core dashboard actions are unusable or ambiguous with a screen reader; sighted users also get no tooltip on the refresh control.
- **Fix sketch**: Add `aria-label="Refresh build history"` (+ `title`) to the refresh button, matching the labeled buttons elsewhere in the file. In `SortableHeader`, set `aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}` (or append sr-only "sorted ascending" text) and add `aria-label` describing the action ("Sort by size").

## 7. Expandable rows and preflight tiles don't expose expanded state; no-op tiles still present as clickable buttons
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/game-systems/PreflightPanel.tsx:169`
- **Scenario**: Preflight check tiles render a full-width `<button>` even when there are no issues to expand — keyboard users tab to it, screen readers announce an actionable button, and activating it does nothing (`onClick={() => hasIssues && toggleExpand(...)}`, with only `cursor-default` as a visual hint). Tiles that *do* expand never announce open/closed. The same pattern repeats for build rows in `BuildHistoryDashboard.tsx:76` (chevron-only state, no `aria-expanded`).
- **Root cause**: Disclosure pattern implemented visually (chevron rotation) without the matching ARIA state; the "not expandable" case is styled away instead of removed from the tab order.
- **Impact**: AT users can't tell which checks have detail, whether detail is open, or why a button does nothing — on the exact panel that gates whether a 30-minute cook should start.
- **Fix sketch**: Add `aria-expanded={isOpen}` to both disclosure buttons. When `!hasIssues`, render `disabled` (or a non-interactive `<div>`) so the no-op control leaves the tab order; keep the chevron as the visual affordance.

## 8. Build History flashes "No builds recorded yet" on every load before data arrives
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/game-systems/BuildHistoryDashboard.tsx:576`
- **Scenario**: Open the Builds tab. While the four parallel fetches resolve, `builds` is `[]` and `loading` is `true`, but the empty-state branch renders unconditionally — users with any real history see "No builds recorded yet. Use 'Record' to add your first build." for the fetch duration, then the table pops in. Metrics cards and platform breakdown also pop in (gated on `stats`), shifting layout.
- **Root cause**: The empty state is keyed on `builds.length === 0` without consulting `loading`; the only loading affordance is the spinning refresh icon in the header.
- **Impact**: Misleading first paint on every visit — on a slow disk it reads as data loss ("where did my builds go?"), and the late-arriving metrics rows cause layout shift.
- **Fix sketch**: When `loading && builds.length === 0`, render a lightweight skeleton (or the existing "Running…"-style muted line used by PreflightPanel) in place of both the empty state and the metrics row; only show the empty message once `!loading`.

## 9. Build deletion is a single click, irreversible, with no confirmation or undo
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/game-systems/BuildHistoryDashboard.tsx:163`
- **Scenario**: Expanding a build row reveals a small "Delete" control (2.5px icon, 60% opacity) directly beneath the row's details. One click fires `DELETE /api/packaging/history?id=` immediately — no confirm, no undo, and the row vanishes.
- **Root cause**: Destructive action wired straight to the API with no friction; the record carries unrecoverable data (smoke-test notes, size-regression notes, error summaries) and also silently shifts derived stats (success rate, last-green size used by the budget gate).
- **Impact**: A mis-click permanently corrupts build history and can change what "last green build" the size-budget comparison uses — a data-destroying action with the same interaction cost as expanding a row.
- **Fix sketch**: Two-step confirm in place (click → "Delete? Confirm / Cancel" swap, the lightest pattern consistent with this compact UI), or an undo toast that defers the DELETE for ~5s. Keep the button `style`/placement as is.

## 10. Record Build form: labels aren't associated with inputs and numeric fields silently mis-parse
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/game-systems/BuildHistoryDashboard.tsx:207`
- **Scenario**: In the Record Build form, every `<label>` is a sibling with no `htmlFor`/`id` — clicking a label doesn't focus its field and screen readers announce unnamed selects/inputs. "Size (GB)" and "Duration (min)" are free-text inputs run through `parseFloat`: typing `1,5` (comma decimal) records 1 GB with no warning; typing `1.5GB` records 1.5; typing junk yields `NaN`, which `JSON.stringify` turns into `null`, so the build records with *no* size while the form happily clears and closes.
- **Root cause**: Missing label association, and free-text fields with no `type="number"`/`inputMode="decimal"`, no validation, and a submit path that masks bad input (`NaN → null`) instead of rejecting it.
- **Impact**: Hand-recorded sizes are exactly the rows the size-trend and budget comparisons treat as ground truth — a silently truncated `1,5 → 1 GB` entry poisons the last-green baseline; a11y users can't operate the form reliably.
- **Fix sketch**: Give each field an `id` + `htmlFor`; use `type="number"` with `step="0.1"`/`min="0"` (or validate with `Number()` and show the existing red error styling); disable "Record Build" while size/duration are non-empty but invalid.
