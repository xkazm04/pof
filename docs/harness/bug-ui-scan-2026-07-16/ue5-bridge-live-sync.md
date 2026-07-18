# UE5 Bridge & Live Sync — Bug + UI Scan

> Total: 8

## Bug findings

### 1. Delayed rAF sync can revert to stale connection state
- **Severity**: High
- **Category**: bug
- **File**: src/hooks/usePofBridge.ts:58-67
- **Scenario**: Component mounts, `usePofBridge` subscribes via `onStateChange` and captures `initial = pofBridgeConnection.getState()`, then schedules `requestAnimationFrame(() => setState(initial) ...)`. If the PoF Bridge connection resolves (e.g. `connect()` succeeds) in the gap between subscribing and the rAF callback firing, `onStateChange` already pushed the newer ("connected") state into React/`usePofBridgeStore`. When the rAF then fires, it unconditionally overwrites `state`/`setConnectionStatus`/`setPluginInfo`/`setError` back to the older `initial` snapshot (e.g. "connecting" or even "disconnected").
- **Root cause**: Two independent write paths (subscriber callback and a deferred rAF "initial sync") race to set the same state with no ordering/timestamp guard — the later-scheduled rAF can clobber a more recent update.
- **Impact**: UI status pill/badge can visibly flicker back to a stale/incorrect status (e.g. flash "disconnected" right after actually connecting), and downstream store consumers (`pluginInfo`, `error`) can briefly show stale data. On a fast connect this is very plausible since `connect()` is often near-instant on localhost.
- **Fix sketch**: Drop the rAF re-sync entirely (the subscribe callback already fires with the live state on subscribe if the emitter replays current state), or guard it with a monotonic version/timestamp so it only applies if no newer update has landed since scheduling.

### 2. `useLiveStateSync` never disconnects the WS singleton on unmount, leaking a background reconnect loop
- **Severity**: Medium
- **File**: src/hooks/useLiveStateSync.ts:57-71 (see also src/lib/ue5-bridge/ws-live-state.ts:369-384)
- **Category**: bug
- **Scenario**: A component calls `connectWs()` (e.g. on mount) then later unmounts (route change) without ever calling `disconnectWs()`. The hook's own `useEffect` cleanup only calls `unsub()` (state-change unsubscribe) — it never calls `ue5LiveState.disconnect()`.
- **Root cause**: `ue5LiveState` is a singleton independent of any component's lifecycle; the hook exposes symmetrical `connectWs`/`disconnectWs` actions but has no automatic disconnect-on-unmount, so a live socket + its exponential-backoff reconnect loop keeps running indefinitely in the background even when no UI is observing it (or ever will again).
- **Impact**: If the UE5 editor goes away permanently (project closed) after the user navigates off the bridge page, the app keeps trying to reconnect forever at `ue5WsReconnectMax` intervals, burning a timer/socket-attempt loop with zero visible indicator and no way for the user to stop it short of a full page reload.
- **Fix sketch**: Either disconnect in the hook's cleanup when the caller opted into `connectWs()` (track an owned/counted subscription), or make this an explicit product decision documented in the hook's JSDoc — currently it reads as an oversight since the API shape (paired connect/disconnect) implies symmetric lifecycle management.

### 3. Each `useUE5Connection` instance opens its own SSE stream and its own one-shot auto-connect gate
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useUE5Connection.ts:39-79
- **Scenario**: Unlike `usePofBridge`/`useLiveStateSync` (which subscribe to a shared client-side singleton), `useUE5Connection` creates a brand-new `EventSource('/api/ue5-bridge/status')` per mounted instance, and each instance has its own per-instance `hasAutoConnected` ref. If two components in the tree both call `useUE5Connection()` (e.g. a header status widget and a settings panel) and mount around the same time while disconnected, both will independently POST `{action:'connect', host, httpPort}` to `/api/ue5-bridge/query`.
- **Root cause**: No shared/singleton gating for the SSE subscription or the auto-connect side effect at the hook level — every consumer re-derives its own auto-connect decision from the same store values.
- **Impact**: Duplicate SSE connections to the same status endpoint (extra server-side connection objects) and a race between two concurrent "connect" requests, potentially with different in-flight `host`/`httpPort` values if the store updates between the two POSTs — the loser's connect intent is silently discarded.
- **Fix sketch**: Move the SSE subscription + auto-connect gate into a small client-side singleton (mirroring the pattern already used for `pofBridgeConnection`/`ue5LiveState`), with the hook just subscribing to it.

### 4. Auto-connect is a permanent one-shot latch, even on failure
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useUE5Connection.ts:66-79
- **Scenario**: `hasAutoConnected.current = true` is set before the POST even resolves, and the POST's failure path is `.catch(() => {})` — a silently swallowed error. If the initial auto-connect POST fails (e.g. dev server not up yet, transient network blip during app boot), the ref stays `true` forever for this hook instance, so auto-connect never fires again even if `connectionState.status` later reports back to `'disconnected'`.
- **Root cause**: The "attempted" latch is set optimistically at call time rather than gated on success, and there is no reset path tied to actual connection status.
- **Impact**: A user whose UE5 editor wasn't ready at page load must manually click "Connect" even though `autoConnect` is enabled and the editor becomes reachable moments later — defeats the purpose of the auto-connect setting, and the swallowed catch means there's no log/telemetry trail explaining why.
- **Fix sketch**: Only latch `hasAutoConnected` on a successful response (or reset it back to `false` in the `catch`), and log the swallowed error via `logger` for observability.

### 5. Per-keystroke auto-connect effect can fire connection attempts against incomplete host/port input
- **Severity**: Low
- **Category**: bug
- **File**: src/hooks/usePofBridge.ts:72-78
- **Scenario**: The auto-connect effect's dependency array is `[autoDetect, host, pofPort, pofAuthToken]`. If these are bound to live-editable settings inputs (common for a "host/port" bridge config UI) and `autoDetect` is on, every keystroke that changes `host` or `pofPort` re-runs the effect; whenever `pofBridgeConnection.getState().status === 'disconnected'` (true immediately after a prior failed attempt or right after a partial edit), it fires `connect(host, pofPort, ...)` again against a possibly incomplete/invalid value being typed.
- **Root cause**: No debounce and no "is this a plausible complete host/port" guard before invoking connect from a text-input-driven dependency.
- **Impact**: Connection attempt storms against garbage intermediate values while a user is editing the host field, each one going through the full connect → fail → status churn cycle, generating noisy state transitions and log spam.
- **Fix sketch**: Debounce the host/port-driven auto-connect (e.g. only after input blur or a short idle delay), or validate host/port shape before invoking `connect()`.

## UI findings

### 6. `reconnectAttempts` and PoF `error` are tracked but not exposed by the hooks, blocking a consistent "reconnecting" UI across bridges
- **Severity**: Medium
- **Category**: ui
- **File**: src/hooks/usePofBridge.ts:18-24, src/hooks/useUE5Connection.ts:15-22, src/hooks/useLiveStateSync.ts:20-43
- **Scenario**: All three underlying singleton states (`PofConnectionState`, `UE5ConnectionState`, and the WS `LiveEditorState`) carry richer status detail than what the hooks return. `usePofBridge`'s `UsePofBridgeResult` omits `error` entirely (a consumer must reach into `usePofBridgeStore` separately to show a failure reason), and none of the three hooks expose `reconnectAttempts`/backoff progress even though the manager increments and tracks it.
- **Root cause**: The hook return shapes were trimmed to only what each hook's original consumer needed, rather than mirroring the full status contract consistently across the three connection surfaces.
- **Impact**: A shared "connection status" UI component can't render a consistent "Reconnecting… (attempt 3)" affordance for all three bridges from the hooks alone — one path needs a second store subscription just to get the error string, and no path can show reconnect progress, so all a user sees during a long backoff is a static "Reconnecting" label with no sense of progress or attempt count.
- **Fix sketch**: Make the three hook result shapes symmetric — always include `error` and `reconnectAttempts` (or a normalized `{status, error, reconnectAttempts, lastConnected}` sub-object) so a single shared status-pill component can drive all three connections identically.

### 7. Guaranteed initial-mount flash of "Disconnected" before the first SSE message
- **Severity**: Low
- **Category**: ui
- **File**: src/hooks/useUE5Connection.ts:27-33
- **Scenario**: `connectionState` is locally seeded with `status: 'disconnected'` regardless of the real server-side state, and only updates once the first `EventSource` `message` event arrives. Since the server-side `UE5ConnectionManager` singleton may already be `'connected'` from a previous mount/session, any status badge bound to this hook will render "Disconnected" for at least one network round-trip before flipping to the true status.
- **Root cause**: No distinct "unknown/loading" initial status — `'disconnected'` is overloaded to mean both "genuinely not connected" and "haven't heard from the server yet."
- **Impact**: Visible flash/flicker of an incorrect status on every navigation to a bridge-status view, undermining trust in the indicator ("didn't it just say connected a second ago?").
- **Fix sketch**: Seed the initial local state with a distinct `'unknown'`/`'loading'` status (rendered as a neutral skeleton/spinner in the UI) instead of defaulting to `'disconnected'`, and only fall back to a real `'disconnected'` after the first SSE message confirms it or a short timeout elapses.

### 8. No staleness indicator for the WS snapshot even though `lastSnapshotTime` is tracked
- **Severity**: Low
- **Category**: ui
- **File**: src/hooks/useLiveStateSync.ts:20-43 (compare src/lib/ue5-bridge/ws-live-state.ts:57)
- **Scenario**: The underlying `LiveEditorState` tracks `lastSnapshotTime`, but `UseLiveStateSyncResult` never surfaces it — only `snapshot`, `frameRate`, and `isLive` (derived purely from `wsStatus === 'connected'`) are returned.
- **Root cause**: The hook's public surface drops timing metadata that would let a UI distinguish "socket open but no data flowing" from "actively live," relying solely on the raw `wsStatus` string.
- **Impact**: If the UE5-side plugin stops pushing snapshots/deltas while the WebSocket itself stays technically open (e.g. editor hung, or the plugin silently stopped emitting), `isLive` still reports `true` and any "LIVE" badge keeps showing green with no way for the UI to warn "no updates in 12s" — a classic false-positive liveness indicator.
- **Fix sketch**: Return `lastSnapshotTime` (or a derived `isStale` boolean comparing it against `Date.now()`) from the hook so status UI can downgrade the "LIVE" indicator when data has stopped flowing despite an open socket.
