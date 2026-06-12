# CLI Terminal & Task System — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Every live run completes with a null task id, so `session.isRunning` latches true forever after the first prompt
- **Severity**: Critical
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/components/cli/InlineTerminal.tsx:156` (gate) + `src/components/cli/useTaskQueue.ts:352` (tid-gated completion)
- **Scenario**: Any prompt at all — a checklist "Run", an audio-import dispatch, or a free-typed prompt — runs and finishes. The terminal body looks done (input re-enabled), but the InlineTerminal header keeps the spinner + "running" badge, every module button gated on `useModuleCLI.isRunning` stays disabled, and `useChecklistCLI` never marks the item complete. Only a page refresh (persist-merge / `useCLIRecovery`) clears it.
- **Root cause**: Two halves. (a) No host in pof has *ever* passed `taskQueue`/`autoStart` (verified with `git log -S`), so `executeTask` is dead code and every real run goes through `submitPrompt`, which dispatches `SUBMIT_START` with `taskId: null`; all completion callbacks (`result`, `error`, `onerror`, `handleAbort`) are gated on `const tid = currentTaskIdRef.current; if (tid) { … onTaskComplete?.(…) }` — so `onTaskComplete` never fires. (b) The pre-cutover InlineTerminal (commit `ffe8f08`) released the flag via `onStreamingChange={(s) => setSessionRunning(sessionId, s)}`; the shell restored in commit `38924cd` re-created it as `if (streaming) setSessionRunning(sessionId, true)` — true-only. `setSessionRunning(id, false, …)` now has zero callers in the run lifecycle.
- **Impact**: The whole module-CLI completion signal is broken: `useModuleCLI.onComplete` (running→stopped transition) never fires, so checklist items aren't marked done client-side, `recordSessionOutcome` analytics are never written, SuggestedActions never appear, the session can't be reused at the MAX_SESSIONS cap (it "is running"), and every isRunning-gated button in the module is dead until refresh. Success theater in reverse: the run worked, the app says it's still running.
- **Fix sketch**: Restore the pass-through: `onStreamingChange={(s) => { if (s) setSessionRunning(id, true); else setSessionRunning(id, false); }}` (success can still come from `onTaskComplete` when present), and/or drop the `if (tid)` gate in the result/error handlers — always fire `onTaskComplete?.(tid ?? 'interactive', !data.isError)` so the release never depends on a queue-only task id.

## 2. Abort still doesn't stop the run on Windows — `process.kill()` only terminates the `cmd.exe` shell, not the claude node process (regression gap in the a5a5795 fix)
- **Severity**: High
- **Lens**: bug
- **Category**: resource-leak
- **File**: `src/lib/claude-terminal/cli-service.ts:336` (abortExecution) + `:208-213` (spawn with `shell: isWindows`)
- **Scenario**: On Windows (the dev platform), the user hits Stop. `handleAbort` now correctly DELETEs `/api/claude-terminal/query?executionId=…` → `abortExecution` → `execution.process.kill()`. But the spawn used `spawn('claude.cmd', args, { shell: true })`, so `execution.process` is a `cmd.exe` instance; the `.cmd` shim launches `node.exe` (the actual Claude Code) as a *child* of that shell. `kill()` calls TerminateProcess on cmd.exe only — Windows does not cascade to the process tree.
- **Root cause**: The a5a5795 fix wired the client to `abortExecution`, but `abortExecution` assumes `ChildProcess.kill()` kills the work. With `shell: true` on win32 the tracked PID is the shell, and Node provides no tree-kill; the orphaned `node.exe` keeps running with the inherited stdio pipes (which also defers the `close` event until it exits). The same flaw applies to the 100-minute timeout kill at `:301-308`.
- **Impact**: The exact failure finding #1 (2026-06-09) described survives on the primary platform: an "aborted" run keeps editing project files and billing tokens until natural completion; abort-and-retry stacks concurrent orphaned editors on the same UE project. The fix is effectively a no-op on Windows while reporting `{ aborted: true }` to the client — a logging lie.
- **Fix sketch**: On win32, kill the tree: `spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'])` in `abortExecution` (and the timeout handler), or spawn without `shell` via the resolved `claude.cmd` path + `windowsHide` and use a tree-kill helper. Verify by checking no `node.exe` descendant survives after abort.

## 3. Abort during the connecting window doesn't latch — the POST resolution revives the "aborted" run and the DELETE targets a stale executionId
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/cli/useTaskQueue.ts:447` (executionIdRef set post-POST) + `:481-499` (handleAbort) + `:99-106` (unguarded SSE_CONNECTED)
- **Scenario**: User submits a prompt (phase `connecting`, Stop button live) and immediately hits Esc/Stop while the `/api/claude-terminal/query` POST is still in flight. `handleAbort` reads `executionIdRef`, which still holds the *previous* run's id (it is never cleared on normal completion) — or null — so the DELETE kills a finished execution (or nothing). Then the POST resolves: the code unconditionally sets `executionIdRef = data.executionId` and calls `connectToStream`, whose `SSE_CONNECTED` dispatch transitions the reducer from `idle` straight back to `streaming` (no phase guard).
- **Root cause**: Abort is not latched: there is no "aborting/aborted" flag the in-flight start path checks, the reducer accepts `SSE_CONNECTED` from any phase despite the documented transition table, and `executionIdRef` is only nulled in `handleAbort`, never when a run completes — so during `connecting` it aliases the prior execution.
- **Impact**: The user aborts, the UI flashes idle, then the run they cancelled starts streaming anyway — with the server process alive (it was spawned synchronously inside the POST). Combined with the heartbeat already cleared, the run proceeds in a half-torn-down client state; a second abort is required and nothing tells the user the first one failed.
- **Fix sketch**: Set `executionIdRef.current = null` in the `result`/`error` handlers; add an `abortRequested` ref checked after the POST resolves (`if (abortRequested) { DELETE new executionId; return; }`); guard the reducer so `SSE_CONNECTED` is ignored unless `phase === 'connecting'`.

## 4. Hiding and re-showing a streaming terminal replays the full event history — duplicated transcript and doubled `assistantOutputRef`
- **Severity**: Medium
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/components/cli/useTaskQueue.ts:562-580` (visibility reconnect) + `src/app/api/claude-terminal/stream/route.ts:94-101` (full replay)
- **Scenario**: A run is streaming in module A; the user switches to module B (terminal `visible=false` → EventSource closed) and back. The visibility effect reconnects to the saved `streamUrl`; the stream route replays *every* event from `execution.events` from the beginning. `handleSSEEvent` has no replay dedup: every assistant chunk is `addLog`-ed again under a fresh random id, and is appended to `assistantOutputRef` a second time.
- **Root cause**: The server replay is designed for a fresh subscriber, but the client keeps its accumulated `logs` and `assistantOutputRef` across the hide/show cycle. File changes dedup by `toolUseId`, logs and assistant accumulation don't — the design assumes each SSE event is delivered exactly once per client lifetime.
- **Impact**: After a mid-run module switch (a routine action), the entire transcript up to the hide point appears twice, "Copy output" can return a duplicated assistant message, build-output cards render twice, and `assistantOutputRef` holds doubled text (the first-match callback parse stays correct by luck of regex semantics, but any future "last marker wins" fix — prior finding #3 — would then pick a replayed duplicate).
- **Fix sketch**: Track the count of events already consumed for the current execution and pass `?since=<n>` to the stream route (slice `execution.events` before replay); or clear `logs`/`assistantOutputRef` before reconnecting and let the replay rebuild them exactly once.

## 5. Dispatched task prompts are silently dropped when the terminal is mid-stream — the task evaporates with a registered callback leaked
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/cli/CompactTerminal.tsx:115` (drop) + `src/lib/cli-task.ts:57-62` (registerCallback never released)
- **Scenario**: A module flow calls `useModuleCLI.execute(task)` (which builds the prompt, registers a `@@CALLBACK` in the in-memory registry, and dispatches `pof-cli-prompt`) while the target terminal is already streaming — e.g. the user typed a manual prompt seconds earlier, or two programmatic dispatchers (audio-import, generate step) race. The handler does `if (… || queue.isStreaming) return;`.
- **Root cause**: The dispatch path is fire-and-forget with no backpressure: `dispatchPromptWhenReady` only waits for terminal *mount* readiness, not idleness, and the drop branch returns without logging, queueing, or notifying the dispatcher. The caller (`useChecklistCLI.setActiveItemId`, catalog lifecycle dispatchers) has already moved into its "waiting" state.
- **Impact**: The task never runs and nothing says so: no log entry, no error state, the checklist row's active spinner waits on a completion that can't come, and the `registerCallback` entry (plus its `staticFields` lifecycle transition) leaks in `_callbackRegistry` forever. To the user this reads as "Claude ignored my click".
- **Fix sketch**: In the handler, when `queue.isStreaming`, either enqueue the prompt for execution after the current run (small FIFO next to `tqRef`) or `addLog` an error entry and dispatch a `pof-cli-prompt-rejected` event the dispatcher can surface; never `return` silently.

## UI findings

## 6. Assistant replies are hard-truncated at 200 characters with no way to expand them
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/cli/TerminalOutput.tsx:73` (formatLogContent) + `:216-224` (LogRow `truncate`)
- **Scenario**: Claude answers a question ("Explain the architecture of this module") with three paragraphs of plain text. The terminal shows the first 200 characters followed by `...` — virtualized rows additionally clamp to a single `truncate` line — and there is no click-to-expand. Only messages containing code blocks render in full (`AssistantMessageContent`).
- **Root cause**: `formatLogContent` slices all non-code content to 200 chars for compactness, and unlike tool pairs/batches, `single` assistant rows have no expansion affordance; the only escape hatch is the header "Copy output" button.
- **Impact**: The terminal's primary output — the model's answer — is unreadable for any substantive reply, defeating "ask-claude" entirely; users paste into an external editor just to read the response.
- **Fix sketch**: Make long assistant rows expandable like `ToolPairRow` (chevron + full content with `whitespace-pre-wrap` when open), or render assistant messages through `AssistantMessageContent` with a 4-line `line-clamp` and a "Show more" toggle.

## 7. Inline terminal resize handle is mouse-only — no keyboard, touch, or separator semantics
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/cli/InlineTerminal.tsx:94-104`
- **Scenario**: A keyboard user (or anyone on a touch/pen device) wants to grow the 150px terminal to read output. The handle is a plain `div` with `onMouseDown` + document mousemove listeners: it can't be focused, has no ARIA role, and pointer/touch input does nothing.
- **Root cause**: The drag implementation uses raw mouse events and skips the `role="separator"` pattern (focusable, `aria-valuenow/min/max`, arrow-key resize) that an adjustable splitter requires.
- **Impact**: Terminal height is unadjustable without a mouse — a WCAG 2.1.1 (Keyboard) failure on a primary workspace control; touch users on hybrid devices are equally locked out.
- **Fix sketch**: Add `role="separator" aria-orientation="horizontal" tabIndex={0}` with `aria-valuenow={height}`; handle ArrowUp/ArrowDown (±24px) in onKeyDown via `setInlineTerminalHeight`; switch the drag to Pointer Events (`onPointerDown` + `setPointerCapture`) to cover mouse/touch/pen with one path.

## 8. Streaming output and disclosure rows are invisible to screen readers — no live region, no `aria-expanded`
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/cli/TerminalOutput.tsx:765` (container) + `:131` / `:184` (ToolPairRow / ToolBatchRow toggles)
- **Scenario**: A screen-reader user submits a prompt. New log lines, the "Working..." indicator, and the final result render silently — nothing is announced. Tabbing onto a tool-pair or "N file operations" row gives a button with no state, so expanding/collapsing is announced identically.
- **Root cause**: The scroll container is a bare `div` (no `role="log"`/`aria-live`), and the disclosure `<button>`s carry chevron icons but no `aria-expanded`/`aria-controls`.
- **Impact**: The terminal — the app's main feedback surface — is effectively write-only for assistive tech: users can't tell whether a run is in progress, finished, or failed without manually re-reading the whole region.
- **Fix sketch**: Add `role="log" aria-live="polite" aria-busy={isStreaming}` to the tail (non-virtualized) container and `aria-label="Terminal output"` to the scroll region; add `aria-expanded={isExpanded}` to both toggle buttons.

## 9. Disabled send button is visually identical to enabled, and its hover state hardcodes `blue-500` outside the token system
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/cli/TerminalInput.tsx:64`
- **Scenario**: With an empty input the Send button is `disabled={!input.trim()}`, but its color comes from an inline `style={{ color: MODULE_COLORS.core }}` and the class list has no `disabled:` variant — it looks exactly as clickable as when active, just inert on click. Its hover is `hover:bg-blue-500/20`, a raw Tailwind palette color, while every sibling control uses theme tokens (`bg-status-red-medium`, `bg-surface-hover`, `accent-medium`).
- **Root cause**: Missing disabled styling + a palette literal that bypasses the chart-colors/CSS-variable system used across the rest of the CLI components.
- **Impact**: Users click a dead-looking-alive button and get nothing (no affordance, no cursor change), and the blue hover won't follow theme/accent changes — a small but visible seam in an otherwise tokenized UI.
- **Fix sketch**: Add `disabled:opacity-40 disabled:cursor-not-allowed` (or swap to `text-text-muted` when disabled) and replace `hover:bg-blue-500/20` with the accent token treatment used by the abort button (`hover:bg-accent-medium` / `withOpacity(accentColor, OPACITY_15)`).

## 10. Three different accent colors compete inside one terminal — session accent, `MODULE_COLORS.core`, and `MODULE_COLORS.setup`
- **Severity**: Low
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/cli/InlineTerminal.tsx:116` (badge) + `src/components/cli/TerminalOutput.tsx:861` ("Working...") + `src/components/cli/TerminalInput.tsx:42` (caret)
- **Scenario**: A session with a violet module accent shows: violet spinner and empty-state chips (correct, from `session.accentColor`), a green "running" badge (`MODULE_COLORS.setup`), a blue "Working..." spinner row and blue `>` caret/send icon (`MODULE_COLORS.core`), and a blue "N new" count in the scroll pill — all simultaneously during a run.
- **Root cause**: `accentColor` is threaded into `TerminalOutput` for the empty state only; the streaming indicator, scroll-pill count, prompt caret, and running badge fall back to hardcoded module palette constants.
- **Impact**: The per-module accent system (which the tab strip and empty state establish as "this terminal belongs to module X") breaks down exactly when the terminal is active, making the busiest state look unthemed.
- **Fix sketch**: Pass `accentColor` to `TerminalInput` and use it for the caret/send icon; use the already-available `accentColor` prop for the "Working..." row and unseen-count text in `TerminalOutput`; color the InlineTerminal "running" badge with `session.accentColor` instead of `MODULE_COLORS.setup`.
