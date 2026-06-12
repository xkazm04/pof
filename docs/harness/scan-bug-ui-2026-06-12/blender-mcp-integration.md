# Blender MCP Integration — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Command chain from cbb5840 has no flush on disconnect — dead commands starve the queue and reconnects stall behind them
- **Severity**: High
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/lib/blender-mcp/service.ts:117`
- **Scenario**: Blender wedges (modal dialog, heavy bake) while a command is in flight. The in-flight `sendCommandRaw` only resolves via its 30s timer (`service.ts:150-153`) — `disconnect()` (`service.ts:103-109`) destroys the socket but never rejects the pending promise, and `sendCommandRaw` attaches no `close`/`error` listener. Meanwhile the UI keeps enqueuing (capture clicks, asset-import auto-captures, generate-status polls), and every entry waits behind the 30s head-of-line block. Worse: a reconnect's health check (`connect()` → `getSceneInfo()`, `service.ts:77`) is enqueued at the *back* of the same chain, after the connect-level timer was already cleared (`service.ts:72`), so "Connecting…" can stall for N×30s behind stale queued commands that now execute against the new socket.
- **Root cause**: The serialization fix (commit cbb5840) added a FIFO promise chain but no lifecycle coupling: nothing aborts in-flight/queued commands on socket teardown, there is no queue-depth cap, and the chain survives across connections. This regression is new — the chain did not exist at the 2026-06-09 audit.
- **Impact**: Availability — minutes-long latency pile-ups, HTTP route handlers held open per queued command, and reconnect-after-wedge appears hung even though Blender recovered. Amplifies known finding #4 from bounded ~60s to unbounded.
- **Fix sketch**: In `sendCommandRaw`, listen for socket `close`/`error` and resolve `err` immediately; on `disconnect()`, reset `commandChain = Promise.resolve()` and fail queued entries fast; cap pending depth (reject when full); run the connect health check on a fresh chain bound to the new socket.

## 2. Serialization does not drain stale bytes after a timeout — late response answers the next command, permanently off-by-one
- **Severity**: High
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/lib/blender-mcp/service.ts:155`
- **Scenario**: `execute_code` takes 45s in Blender; at 30s it times out and its `onData` is removed. The chain dequeues the next command (e.g. `get_viewport_screenshot`) and writes its request. The single-threaded addon finishes the *old* command first and flushes its response — which arrives alone, parses as complete JSON in the new command's buffer, and resolves the new command with the old command's payload. The screenshot command then returns `ok('')` (no `screenshot` field), and its real response later answers command N+2. Every subsequent response now belongs to the previous request — a permanent off-by-one desync until disconnect.
- **Root cause**: The cbb5840 fix comment claims chaining "makes the cross-wire impossible", but it only prevents *concurrent* cross-wiring. There is no resynchronization (drain stale bytes, request id, or framing) between a timed-out command and the next one, and serialization makes the misattribution deterministic instead of random. Distinct from known #2, which described the coalesced-`{...}{...}` *hang* variant; this is the clean-parse silent-wrong-data variant the fix was supposed to close.
- **Impact**: Silent wrong results — scene info returned as job status, imports reporting wrong object names, screenshot captures failing with "No screenshot returned" — persisting for the rest of the session.
- **Fix sketch**: Mark the connection "poisoned" when a command times out and force a socket teardown/reconnect before the next command runs; or add request-id correlation / length-prefix framing with one persistent reader so stale responses can be identified and dropped.

## 3. Manual connect during auto-retry backoff doesn't cancel the pending retry — the stale retry clobbers a successful connection
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/stores/blenderMCPStore.ts:106`
- **Scenario**: Auto-retry is in backoff (pill shows "Reconnecting… attempt N"; the Connect button is enabled). The user fixes the port in settings and clicks Connect. `connect()` only calls `clearRetryTimer()` on *success* (line 120), so the scheduled retry can fire mid-flight (manual attempts can take up to 30s), launching a second concurrent `connect()` against the old host/port. If the stale retry settles *after* the manual success, its failure path overwrites the store with `connected: false` + `lastError` and schedules yet another retry — while server-side the service is actually connected. Concurrently, the two service `connect()` calls can orphan a socket whose unconditional `close` handler (`service.ts:96-99`) later nulls the live socket.
- **Root cause**: Connect attempts have no epoch/cancellation: the retry timer is not cleared when a new attempt starts, and late-arriving results are applied unconditionally to store state.
- **Impact**: UI flaps to "Disconnected"/error after a successful connect, the retry loop disconnect/reconnects a healthy session, and an orphaned TCP socket can later corrupt the service's connection state.
- **Fix sketch**: Call `clearRetryTimer()` (and bump a `connectEpoch`) at the top of `connect()`; ignore results whose epoch is stale before writing `connection`/`lastError`; in the service, make the `close` handler check `this.socket === socket` before nulling state.

## 4. ModelsView still uses the raw 150ms dispatch timer instead of dispatchPromptWhenReady — prompts silently dropped
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/modules/content/models/ModelsView.tsx:60`
- **Scenario**: User clicks a pipeline-stage prompt in the Asset Pipeline tab with no existing "models" CLI session. `sendPrompt` creates the session and dispatches the `pof-cli-prompt` CustomEvent after a fixed `setTimeout(dispatch, 150)`. If the terminal mounts slower than 150ms (lazy-loaded CLI panel, busy main thread, first session of the app), no listener is registered yet — the event vanishes and the user's prompt is silently dropped (session tab opens, nothing runs).
- **Root cause**: `src/lib/cli-dispatch.ts` exists precisely to fix this ("Replaces a fixed mount-delay timer that could fire before the terminal's listener registered — the SP-A dispatch race") via a ready-registry + `pof-cli-terminal-ready` handshake, but ModelsView was never migrated and hand-rolls the old racy pattern.
- **Impact**: Intermittent silent loss of the user's action — the prompt never reaches the terminal, with no error.
- **Fix sketch**: Replace the local `dispatch`/`setTimeout` block with `dispatchPromptWhenReady(tabId, prompt)` from `@/lib/cli-dispatch`, matching the migrated call sites.

## 5. Asset-import auto-capture revokes/shifts the screenshot the user is currently viewing
- **Severity**: Low
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/stores/blenderMCPStore.ts:208`
- **Scenario**: User opens the ViewportPreview lightbox (or selects a filmstrip thumbnail) on the oldest of 3 screenshots, then imports an asset in the Asset Browser. `useAssetBrowser.importAsset` auto-calls `addScreenshot`, which `URL.revokeObjectURL`s the oldest entry while it is still bound to the rendered `<img>` — the lightbox/stage image goes blank (ERR_FILE_NOT_FOUND). Even off-capacity, `activeIndex` is positional, so the unshift silently swaps which screenshot the user is looking at.
- **Root cause**: `addScreenshot` assumes the evicted URL is no longer displayed, and `ViewportPreview` tracks selection by index instead of by URL identity; only the local capture path re-pins `setActiveIndex(0)` — external producers (asset browser) don't.
- **Impact**: Broken/blank image mid-inspection and the viewed screenshot changing identity under the user — confusing during import verification.
- **Fix sketch**: Track the active screenshot by URL (derive index), and defer revocation: only revoke URLs not currently referenced (or revoke on a microtask after consumers re-render, e.g. keep an "evicted" list revoked on next `addScreenshot`/unmount).

## UI findings

## 6. Lightbox dialog has no focus management — focus stays behind the modal
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/blender-mcp/ViewportPreview.tsx:159`
- **Scenario**: Keyboard user opens the screenshot lightbox (Enter on the stage). Focus remains on the stage div behind the `aria-modal="true"` backdrop; Tab cycles invisible background controls, and the Close button is only reachable by tabbing through the whole page. On close, focus is wherever the user left it, not restored to the trigger.
- **Root cause**: The dialog renders `role="dialog" aria-modal="true"` but never moves focus into it, traps it, or restores it on close; only the window-level Esc handler is wired.
- **Impact**: Screen-reader users hear "dialog" while their focus is in content `aria-modal` told the SR to hide; keyboard users operate invisible controls — a WCAG 2.4.3 failure on a frequently used surface.
- **Fix sketch**: On open, focus the Close button (ref + `useEffect`); trap Tab within the dialog (or use the app's existing modal primitive if one exists); on close, restore focus to the stage trigger.

## 7. Asset cards expand only via mouse — the dependency graph is unreachable by keyboard
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/content/models/AssetInventory.tsx:412`
- **Scenario**: Keyboard user tabs through the Asset Inventory grid: filter chips and search are focusable, but the asset cards themselves are plain `div`s with `onClick` + `cursor-pointer` — no `tabIndex`, `role`, or key handler. Expansion (and the dependency graph inside) can never be opened without a mouse; only the CLOSE button inside an already-expanded card is a real button.
- **Root cause**: The clickable card is a styled `div` instead of a button-semantics element; the keyboard path was never wired.
- **Impact**: An entire feature (per-asset detail + dependency graph) is invisible to keyboard and switch users — WCAG 2.1.1 failure.
- **Fix sketch**: Give the card `role="button"`, `tabIndex={0}`, `aria-expanded={isExpanded}`, and an Enter/Space `onKeyDown` mirroring the click handler (same pattern ViewportPreview's stage already uses).

## 8. Sort controls were built but never rendered — the inventory is locked to name-ascending
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/content/models/AssetInventory.tsx:230`
- **Scenario**: `sortKey`/`sortDir` state, the `toggleSort` handler, `SortIcon`, and the `ArrowUpDown`/`ChevronRight` imports all exist, and `displayAssets` fully implements name/type/size/modified sorting — but no JSX ever renders a sort control, so users can never sort by size or last-modified (the two most useful views for asset cleanup).
- **Root cause**: The grid layout dropped the table header the sort handlers were presumably written for; the affordance was never re-added as a toolbar control.
- **Impact**: Users hunting large or recently changed assets must eyeball an alphabetical grid; working code ships with zero UX value and misleads future maintainers.
- **Fix sketch**: Add a compact sort dropdown/segmented control next to the Rescan button (Name / Type / Size / Modified + direction toggle using `SortIcon`), wired to the existing `toggleSort`.

## 9. A failed rescan replaces the entire inventory with a full-screen error
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/content/models/AssetInventory.tsx:285`
- **Scenario**: User has a populated inventory, hits Rescan, and the scan fails (path moved, transient FS error). The `if (error)` early-return branch wins over the results render, so the whole grid — filters, search text, expanded card — disappears behind a centered error + Retry, even though `scanResult` is still in state.
- **Root cause**: Error is modeled as a page-level state instead of an overlay/banner; render branching doesn't distinguish "first scan failed" from "rescan failed with stale data available".
- **Impact**: Punishes the riskiest action (rescan) by destroying working context; users lose filter/search state visually for a recoverable error.
- **Fix sketch**: Only early-return the full error view when `!scanResult`; otherwise keep the grid rendered and show the error as a dismissible banner above the summary bar (an `McpErrorBanner`-style inline alert).

## 10. Expanded-card chrome hardcodes raw palette colors and one-off typography against the app's token system
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/content/models/AssetInventory.tsx:471`
- **Scenario**: The expanded card's "Dependency Graph" label is `text-cyan-500` mono-uppercase, the close affordance is a bespoke `CLOSE` mono button, the pre-scan hint uses raw `text-red-400/70`, and the BridgeManifestCard uses raw `green-500/20|5` — while the surrounding Blender MCP surface deliberately centralized status colors in `status-tokens.ts` ("stop sourcing raw palette shades… from ad-hoc places") and uses sentence-case 13px semibold buttons (`McpPanelFrame` actions).
- **Root cause**: AssetInventory predates/ignores the status-token consolidation and invents its own accent (cyan) unrelated to the module accent (`ACCENT_VIOLET`) used everywhere else in the component.
- **Impact**: Theme changes won't propagate (raw shades bypass `--status-*` variables), and the mixed button language (mono UPPERCASE vs. the app's standard) makes the surface feel stitched together.
- **Fix sketch**: Swap `text-cyan-500` for the card's `conf.color` or the violet ACCENT; restyle CLOSE as a standard 13px semibold ghost button with an X icon; replace raw red/green utilities with `WARNING_TEXT`/`SUCCESS_RESULT`-style tokens or the `--status-*` Tailwind utilities.
