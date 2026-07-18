# CLI Terminal & Task System — Bug + UI Scan

> Total: 9

**Context-map note**: `TerminalOutput.tsx` and `useIntentDispatch.ts` no longer exist as listed. `TerminalOutput.tsx` was refactored into `src/components/cli/TerminalOutput/` (index.tsx, useTerminalOutput.ts, ToolRows.tsx, SelectionToolbar.tsx, EntityTags.tsx, helpers.tsx, constants.ts, types.ts) — all read in full. `useIntentDispatch.ts` has no equivalent anywhere under `src/hooks` or `src/lib`; the closest real analog for "intent dispatch" is `src/lib/cli-dispatch.ts` (`dispatchPromptWhenReady`), which was read and folded into this pass instead.

## Bug findings

### 1. Force-completing a "running" task on 409 conflict doesn't kill the underlying CLI process, enabling concurrent double-edits
- **Severity**: Critical
- **Category**: bug
- **File**: src/components/cli/useTaskQueue.ts:483-487
- **Scenario**: A session already has a task registered as `running` (e.g. the stuck-checker hasn't caught up yet, or a previous tab reload left a stale registry row) and `executeTask` is called again for the same `instanceId`. `registerTaskStart` returns `success:false` with `runningTask` set.
- **Root cause**: The code immediately calls `registerTaskComplete(startResult.runningTask.taskId, instanceId, false)` — this only PATCHes the DB registry row to `failed`. It never calls the `DELETE /api/claude-terminal/query?executionId=...` path (the only thing that actually kills the spawned `claude` process, per `handleAbort`). It then retries `registerTaskStart` and dispatches a brand-new task on the same `projectPath`/session.
- **Impact**: If the "old" task's backend process is genuinely still alive, two Claude CLI processes now run concurrently against the same project directory — both able to Edit/Write the same files. The registry believes only the new one exists, so `handleAbort` for the new run has no way to reach the orphaned old process. Best case: wasted spend/tokens invisible to the UI. Worst case: two processes writing the same source file back-to-back, corrupting content or causing the newer run's Edit tool calls to fail against stale file state.
- **Fix sketch**: Before force-completing the registry row, attempt to resolve and cancel the orphaned execution's server-side process (thread an `executionId` through the registry record, or expose a kill-by-taskId endpoint) — don't just mark it failed in the DB while the process itself may still be running.

### 2. `pof-cli-prompt` double-submission race — the `isStreaming` guard reads a stale ref across synchronous event dispatches
- **Severity**: High
- **Category**: bug
- **File**: src/components/cli/CompactTerminal.tsx:96-108, src/components/cli/useTaskQueue.ts:442-474
- **Scenario**: Two `pof-cli-prompt` CustomEvents are dispatched to the same terminal in quick succession — e.g. `dispatchPromptWhenReady` fires for two independent `sendPrompt` calls (two checklist items clicked before either's button disables) targeting the same session/tab, both arriving while the terminal is idle.
- **Root cause**: The handler at CompactTerminal.tsx:106 guards on `queue.isStreaming`, reading it off `tqRef.current` (kept fresh via `tqRef.current = tq` on every render). But `submitPrompt`'s `dispatch({ type: 'SUBMIT_START' })` only *schedules* a state update — the reducer's `streaming` flag doesn't flip to `true` until React commits the next render. Two synchronous `window.dispatchEvent` calls in the same tick both read the pre-update `tqRef.current.isStreaming === false` and both pass the guard, so both call `queue.submitPrompt(...)`.
- **Impact**: The second `submitPrompt` call overwrites `eventSourceRef.current` (closing the first's EventSource client-side) and `executionIdRef.current` (line 511/553) before the first run's server-side process is cancelled — the first run keeps executing/editing files on the server with no client-side handle left to abort it, and its SSE messages are silently dropped once the new EventSource replaces the old.
- **Fix sketch**: Guard on a synchronous ref (e.g. `submittingRef.current`) set the instant `submitPrompt`/`executeTask` begins, not on the reducer-derived `isStreaming`, since the latter is inherently one render behind.

### 3. Heartbeat never resumes after a hide/show cycle, risking a false "stale" kill of a healthy run
- **Severity**: High
- **Category**: bug
- **File**: src/components/cli/useTaskQueue.ts:494-495, 651-669
- **Scenario**: User backgrounds the module (terminal becomes `visible=false`) mid-task, then returns after longer than `UI_TIMEOUTS.heartbeatInterval` (2 min) but less than `taskTimeout` (10 min).
- **Root cause**: The visibility-guard effect (line 651) reconnects the SSE stream and re-arms the stuck-check poller when `visible` flips back to `true`, but `heartbeatIntervalRef` is only ever started once, inside `executeTask` (line 495) — the visibility effect neither restarts it nor keeps it alive while hidden (it's explicitly cleared at line 665 while hidden). Heartbeats to `sendTaskHeartbeat` permanently stop for the remainder of that run.
- **Impact**: The very next stuck-check poll after re-showing calls `getTaskStatus`, which can report `isStale` (server-side staleness derived from last heartbeat gap); the run is then force-completed as failed (line 621-628) even though the CLI process is healthy and actively working — the user loses a live, correct run purely because the tab was hidden for a couple of minutes.
- **Fix sketch**: Restart `heartbeatIntervalRef` in the same visibility-effect branch that reconnects the SSE stream, or move heartbeat lifetime to be keyed off `streaming` state directly rather than only being started once per `executeTask` call.

### 4. Checklist item completion can be misattributed to the wrong item under rapid dispatch
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useChecklistCLI.ts:59-79, 91-102
- **Scenario**: `sendPrompt(itemId, prompt)` is called for item A, then — before A's run completes — called again for item B on the same session (no `cli.isRunning` check gates the call at all).
- **Root cause**: `sendPrompt` unconditionally overwrites `activeItemRef.current = itemId` and `setActiveItemId(itemId)` on every call. `handleComplete` (fired asynchronously, off the underlying `useModuleCLI` running→stopped transition) reads `activeItemRef.current` *imperatively* to decide which checklist item to mark done/unconfirmed — so whichever item was dispatched *last* wins the ref, regardless of which run's callback the completion signal actually belongs to.
- **Impact**: Item A's real completion (with a confirmed callback) can flip item B to "done" instead, while item A silently stays undone with no unconfirmed-retry affordance surfaced (since the ref no longer points at A). Silent, wrong checklist state with no error surfaced to the user.
- **Fix sketch**: Track `activeItemId` per in-flight run (e.g., keyed by `taskId`/`executionId` returned from `cli.execute`), or have `sendPrompt` early-return/queue while `cli.isRunning` is true instead of clobbering the ref.

### 5. Build-output detection false-positives on ordinary assistant prose, silently downgrading rendering
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/cli/UE5BuildParser.ts:74-86, src/components/cli/TerminalOutput/index.tsx:50-70
- **Scenario**: An assistant message merely *discusses* code, e.g. "I'll start by Compiling the changes in `HUD.cpp(120)`," or "Let's begin Linking the new module."
- **Root cause**: `BUILD_INDICATORS` includes broad patterns like `/Compiling\s+/i`, `/Linking\s+/i`, and `/\.cpp\(\d+\)/` with no requirement that the surrounding text actually be a `tool_result`/build log — `containsBuildOutput`/`parseBuildOutput` is applied to any log entry's content, including `assistant` type messages (`renderSingleLog` checks `parsed?.isBuildOutput` before it ever checks `log.type === 'assistant'`).
- **Impact**: A normal assistant turn gets silently rendered as raw "build output" (plain diagnostic-card layout) instead of through `AssistantMessageContent`/`parseCodeBlocks` — losing markdown/code-block syntax highlighting and inline entity tags for that message, with no visible error; the user just gets a worse-looking response for no apparent reason.
- **Fix sketch**: Restrict `parseBuildOutput` calls to `tool_result`-typed log entries only (as the primary `buildParseCache` population site already does at handleSSEEvent's `tool_result` case), and stop calling it against `assistant` content in `renderSingleLog`.

## UI findings

### 6. Rich rendering (Fix buttons, code highlighting, entity tags) silently disappears once a log scrolls past the last 8 entries
- **Severity**: High
- **Category**: ui
- **File**: src/components/cli/TerminalOutput/index.tsx:207-223, src/components/cli/TerminalOutput/ToolRows.tsx:104-112, src/components/cli/TerminalOutput/useTerminalOutput.ts:116-122
- **Scenario**: A long session accumulates more than 8 log entries after a build failure; the user scrolls up to revisit the earlier `ErrorCard`/`WarningAggregator`/"Fix" button for that failure.
- **Root cause**: `TAIL_COUNT = 8` hard-splits logs into a virtualized "older" bucket (rendered via the bare `LogRow` — plain truncated text, no build cards, no code highlighting, no entity tags, no tool-pair grouping) and a "recent tail" bucket rendered through the full `renderSingleLog`/`ToolPairRow`/`ToolBatchRow` machinery.
- **Impact**: The moment any build error, code block, or grouped tool-call scrolls past 8 entries back, its interactive affordances (the "Fix with Claude" button on `ErrorCard`, expandable tool pairs, entity tags) vanish and get replaced by inconsistent flat text — a jarring, undocumented downgrade for exactly the content (past build failures) users are most likely to scroll back to review.
- **Fix sketch**: Either raise `TAIL_COUNT` enough to keep at least one full build-output block virtualization-exempt, or teach the virtualized `LogRow` to consult `buildParseCache`/`parseCodeBlocks` too (even a collapsed summary card) so the two rendering paths don't diverge in capability.

### 7. Session "running" badge color is decoupled from the session's own accent color
- **Severity**: Low
- **Category**: ui
- **File**: src/components/cli/InlineTerminal.tsx:108-119
- **Scenario**: Any inline terminal session that isn't using the "setup" module's color (i.e. most sessions, since `accentColor` is per-module/per-session) is actively running.
- **Root cause**: The spinner/`Terminal` icon correctly uses `session.accentColor` (line 110/112), but the adjacent "running" pill hardcodes `style={{ color: MODULE_COLORS.setup }}` regardless of which module/session it belongs to.
- **Impact**: Two elements in the same header, both meant to represent "this session, running," show mismatched colors — undermining the accent-color-as-module-identity convention the rest of the terminal UI (tab colors, icon colors, chip colors) relies on for at-a-glance recognition.
- **Fix sketch**: Use `session.accentColor` for the badge's text/background instead of the hardcoded `MODULE_COLORS.setup`.

### 8. No visible feedback when a submit is silently ignored while streaming
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/cli/TerminalInput.tsx:40-58, src/components/cli/CompactTerminal.tsx:75-77
- **Scenario**: A task is streaming; the user, unaware, types a follow-up prompt into the still-fully-interactive textarea and presses Enter.
- **Root cause**: `handleSubmit` at CompactTerminal.tsx:75-77 no-ops (`if (!input.trim() || tq.isStreaming) return;`) with zero user-facing signal — no shake, toast, disabled/dimmed textarea, or placeholder change. The textarea itself carries no `isStreaming`-driven styling (no `readOnly`, no reduced opacity, no "still working…" copy) — only the send button swaps to an abort icon, which is easy to miss since the layout doesn't otherwise change.
- **Impact**: Users reasonably assume their Enter press queued the message; instead it's dropped entirely with no trace, and they may only notice when the eventual response doesn't address what they typed.
- **Fix sketch**: Either queue same-session follow-up prompts for after the current run completes, or give the textarea a distinct "busy" visual state (dim + `readOnly` + updated placeholder like "Working — press Esc to stop") so a blocked Enter is legible in the moment.

### 9. Selection toolbar position is computed once and never re-measured for late layout shifts
- **Severity**: Low
- **Category**: ui
- **File**: src/components/cli/TerminalOutput/SelectionToolbar.tsx:17-51
- **Scenario**: The user selects terminal output text right as the app is still settling layout (font swap, scrollbar appearing, a build card expanding above the selection) — anything that changes the toolbar's own width/height or the scroll container's size after first paint.
- **Root cause**: `useLayoutEffect`'s `measure()` runs once, keyed only on `[state.anchorX, state.anchorTop, state.anchorBottom, containerRef]` — i.e. once per new selection. There's no `ResizeObserver`/window `resize` listener to re-run `measure()` if the toolbar's actual rendered dimensions (`tb.width`/`tb.height`, read from the live DOM node) change after that first pass, or if the container's `clientWidth`/`clientHeight` change from a `WarningAggregator`/`ErrorCard` expanding nearby.
- **Impact**: In edge cases the toolbar can clip past the container edge or the caret can visibly misalign with the selection, with no self-correction until the user makes a new selection.
- **Fix sketch**: Add a `ResizeObserver` on both `toolbarRef.current` and `containerRef.current` that re-runs `measure()`, in addition to the existing selection-keyed effect.
