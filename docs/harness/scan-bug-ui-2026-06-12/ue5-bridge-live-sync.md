# UE5 Bridge & Live Sync — Bug + UI scan (2026-06-12)

> Total: 8 findings (3 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Aborted/timed-out builds orphan UBT's child compiler processes on Windows
- **Severity**: Medium
- **Lens**: bug
- **Category**: resource-leak / recovery-gap
- **File**: `src/lib/ue5-bridge/build-pipeline.ts:135`
- **Scenario**: A build is aborted (user clicks abort) or hits `buildProcessTimeout`. `executeBuild` calls `proc.kill('SIGTERM')` on the UBT process only (lines 146, 152, 159).
- **Root cause**: UBT (`UnrealBuildTool.exe`) is spawned with `{ shell: false }` and no `detached`/job-object grouping. On Windows, `proc.kill()` calls `TerminateProcess` on UBT alone — its spawned grandchildren (MSBuild, `cl.exe`, `link.exe`) are not in a killable process group and survive. There is no tree-kill. The assumption that killing the parent ends the build is false on Win64, which is the default platform.
- **Impact**: Orphaned compiler processes keep consuming CPU/RAM and hold locks on intermediate `.obj`/PDB files. Because the build queue is sequential and reuses the same target dir, the next enqueued build for that target can fail intermittently with "cannot open file" / locked-output errors, or stall — a wedged queue that looks like flaky builds.
- **Fix sketch**: On Windows spawn with a job object or kill the tree (e.g. `taskkill /pid <pid> /T /F`, or `tree-kill`). Track the pid and, on abort/timeout, terminate the whole subtree rather than the immediate child.

## 2. PIE pause/resume mutates the shared `pieState` object in place
- **Severity**: Low
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/lib/ue5-bridge/ws-live-state.ts:246`
- **Scenario**: A `event.pie` message with action `paused` or `resumed` arrives while a snapshot exists.
- **Root cause**: `const updated = { ...this.state.snapshot }` is a shallow clone, so `updated.pieState` is the *same reference* as the live state's (and the zustand store's) `pieState`. The handler then does `updated.pieState.isPaused = true/false` — an in-place mutation of state that is supposed to be immutable. The state emitter's clone is also shallow (`{ ...s, propertyWatches: new Map() }`), so `snapshot.pieState` identity is shared across every emitted/stored copy. (`started`/`stopped` correctly assign a new object; only pause/resume mutate.)
- **Impact**: `pieState` object identity never changes on pause→resume, so any consumer that memoizes on `pieState` reference (React.memo / useMemo keyed on it) will not re-render the paused/running transition. Today's panels read `snapshot.pieState.isPaused` inline so they happen to re-render, but this is a latent correctness landmine for any future memoized consumer.
- **Fix sketch**: Replace the object instead of mutating: `updated.pieState = { ...updated.pieState, isPaused: true }` (guarded for null), matching the `started`/`stopped` branches.

## 3. WebSocket auto-reconnect targets stale host/port after a settings change
- **Severity**: Low
- **Lens**: bug
- **Category**: edge-case / silent-failure
- **File**: `src/lib/ue5-bridge/ws-live-state.ts:363`
- **Scenario**: User connects live-sync, then edits the WS port (or host) in settings while connected, then the socket drops unexpectedly (editor restart, network blip).
- **Root cause**: `connect(host, wsPort)` captures `host`/`wsPort` in closures (`openSocket`/`scheduleReconnect`). The unexpected-close path (`onclose` → `scheduleReconnect(host, wsPort)`) re-uses the *originally captured* values, not the current store values. There is no cap on reconnect attempts either, so it will retry the wrong endpoint indefinitely without ever surfacing "wrong port" to the user.
- **Impact**: After a port change the client silently reconnects forever to the old port and never succeeds; the UI shows perpetual "Reconnecting…" with no indication that the configured port no longer matches. Only a manual disconnect+reconnect fixes it.
- **Fix sketch**: Read host/port from the store inside `scheduleReconnect`/`openSocket` (or re-pass them on each attempt), and cap attempts → surface a terminal `error` state after N tries so the stale-config case is visible.

## UI findings

## 4. Stale "live" data renders alongside a "Connect" button during reconnect
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish / visual-consistency
- **File**: `src/components/modules/project-setup/LiveStateSyncPanel.tsx:289`
- **Scenario**: The socket drops unexpectedly. `wsStatus` becomes `reconnecting`, so `isLive` is false — but the last `snapshot` is still in the store.
- **Root cause**: The live sections render on `{snapshot && (…)}` (line 289), independent of `isLive`, while the action area renders the `Connect` button on `!isLive` (line 225). So the panel simultaneously shows full viewport/actor/PIE data (now frozen and stale) *and* a "Connect" call-to-action, with the status badge reading "Reconnecting…". Three contradictory signals at once.
- **Impact**: Operator reads frozen camera/actor/PIE values as current truth and may make decisions on stale state, while being told to "Connect" to something that looks already connected.
- **Fix sketch**: Gate the live sections on `isLive` (or dim + overlay a "Reconnecting — data may be stale" banner when `wsStatus !== 'connected'`); hide/disable the Connect button while status is `connecting`/`reconnecting`.

## 5. Connect button has no in-flight state — invites double-submit, gives no feedback
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/project-setup/LiveStateSyncPanel.tsx:225`
- **Scenario**: User clicks "Connect". `wsStatus` goes `connecting`, but `isLive` is still false, so the button keeps showing an idle, fully-enabled "Connect" with a Wifi icon (same in `BidirectionalStateSyncPanel.tsx:440`).
- **Root cause**: The button toggles purely on `isLive` (connected) vs not — there is no `connecting`/`reconnecting` branch and no `disabled`/spinner. The status badge animates a spinner, but the actionable control does not reflect the pending handshake.
- **Impact**: Looks unresponsive during the handshake; a second click re-enters `ue5LiveState.connect()`, which calls `cleanup()` and tears down the just-opened socket — connection churn and slower connects.
- **Fix sketch**: When `wsStatus` is `connecting`/`reconnecting`, render a disabled button with `Loader2 animate-spin` and "Connecting…"; only show the enabled Connect/Disconnect variants in the settled states.

## 6. Sync log records outbound writes as sent even when the WebSocket dropped them
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish / feedback
- **File**: `src/components/modules/project-setup/BidirectionalStateSyncPanel.tsx:258`
- **Scenario**: User pushes a property write, PIE command, or viewport teleport. The handlers call `setProperty(...)` then immediately `addLog('outbound', …)` (lines 258, 267, 274, 291).
- **Root cause**: `ue5LiveState.setProperty` funnels through `send()`, which silently no-ops when the socket isn't `OPEN` (the known 2026-06-09 bug #3). The UI logs the outbound entry unconditionally, with an "info"/CheckCircle level, regardless of whether the frame actually left. The log is presented as a record of real I/O.
- **Impact**: The "Sent" log and outbound counter become success theater — the operator sees a green "SET MaxHealth = 100 → sent" entry for a command that never reached UE5, and trusts the live editor was changed.
- **Fix sketch**: Have `send()`/`setProperty` return a boolean; log `warn` (not `info`) and mark the entry as "dropped — not connected" when delivery fails, so the log reflects actual transmission.

## 7. Collapsible-section header markup is duplicated ~8 times across both panels
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/project-setup/BidirectionalStateSyncPanel.tsx:482`
- **Scenario**: Every disclosure section (Viewport, Selection, Watches, PIE Control, Property Write-Back, Viewport Teleport, Conflicts, Sync Log) hand-rolls the identical `<button>` with chevron toggle + colored icon + uppercase label + `aria-expanded`/`aria-controls`. The same pattern repeats in `LiveStateSyncPanel.tsx:293` onward.
- **Root cause**: No shared `CollapsibleSection` primitive; each section copies the header structure, the `framer-motion` height animation wrapper, and the aria wiring.
- **Impact**: ~8 copies drift independently — `LiveStateSyncPanel`'s sections animate without the `AnimatePresence` height wrapper that `BidirectionalStateSyncPanel` uses, so expand/collapse motion is inconsistent between the two panels; aria attributes are easy to forget on the next copy.
- **Fix sketch**: Extract a `CollapsibleSection({ icon, color, title, count, open, onToggle, children })` that owns the header, the motion wrapper, and aria. Replace all eight call sites.

## 8. Icon-only header buttons rely on `title` without `aria-label`
- **Severity**: Low
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/project-setup/LiveStateSyncPanel.tsx:210`
- **Scenario**: A keyboard/screen-reader user tabs to the "Request fresh snapshot" (RefreshCw, line 210) and "Connection settings" (Gauge, line 218) buttons in the panel header.
- **Root cause**: These icon-only buttons set `title` only and contain no text node, while sibling icon buttons in the same file (`Add property watch`, `Remove watch`) correctly use `aria-label`. `title` is inconsistently announced by screen readers, so these two read as unlabeled "button".
- **Impact**: Two unlabeled controls for assistive-tech users; inconsistent with the panel's own a11y conventions.
- **Fix sketch**: Add `aria-label="Request fresh snapshot"` and `aria-label="Connection settings"` (keep `title` for the mouse tooltip).
