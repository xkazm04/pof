# UE5 Bridge & Live Sync — zen-perf scan
> Context: UE5 Integration & Project Setup / UE5 Bridge & Live Sync
> Total: 5
> Severity: critical=0 high=2 medium=3 low=0

## 1. Two connection managers, two opposite execution models — no shared lifecycle abstraction
- **Severity**: high
- **Lens**: both
- **Category**: architecture / duplication / coupling
- **File**: src/lib/pof-bridge/connection-manager.ts:24 · src/lib/ue5-bridge/connection-manager.ts:24
- **Scenario**: Any change to reconnect/health-check semantics (backoff, failure threshold, jitter) must be hand-mirrored across two files, and the two bridges behave inconsistently for the same user (one reconnects in the browser, one on the server).
- **Root cause**: `PofBridgeConnectionManager` and `UE5ConnectionManager` are near-identical (~210 lines each): same `client/healthInterval/reconnectTimer/consecutiveFailures` fields, same `connect`/`disconnect`/`startHealthCheck`/`scheduleReconnect`/`clearTimers` bodies — differing only in client type, event names, and one extra `pluginInfo` field comparison (pof-bridge/connection-manager.ts:144-148 vs ue5-bridge/connection-manager.ts:132-135). The `state-emitter` abstraction was extracted for the *state* half but the *lifecycle* half (health loop + exponential-backoff reconnect) was left duplicated. Worse, the two run in opposite environments: `pofBridgeConnection` is driven **client-side** from the `usePofBridge` hook (usePofBridge.ts:76,83) while `ue5Connection` is a **server-side** singleton driven via `/api/ue5-bridge/query` POST and observed over SSE (useUE5Connection.ts:40,71). The PoF side even has a complete server-side proxy (`proxyToPofBridge`, used by status/compile/snapshot routes) that the client-side manager bypasses — so PoF connection state lives in the browser while its REST proxy lives on the server, and the two can disagree.
- **Impact**: ~200 lines of duplicated, drift-prone lifecycle logic; two mental models for "is the bridge connected"; bugs fixed in one manager silently persist in the other (see finding 2). Server-side `ue5Connection` is also a process-global shared by every browser tab.
- **Effort**: 6 · **Value**: 7
- **Fix sketch**: Extract a `createBridgeLifecycle({ ping, onConnected, onDisconnected, timeouts })` helper holding the health-loop + backoff-reconnect + `clearTimers` logic, parameterized by a `ping(): Promise<Result<Info>>` and an `infoChanged(prev, next)` predicate. Both managers become thin wrappers. Separately, pick ONE execution model for both bridges (recommend server-side for both, since the REST proxies already live there) so connection state has a single home.

## 2. Health-check failure path never resets `reconnectAttempts`, so first reconnect uses a stale/zero backoff but later ones over-grow
- **Severity**: medium
- **Lens**: architecture (correctness)
- **Category**: reconnect backoff / state bug
- **File**: src/lib/ue5-bridge/connection-manager.ts:148-154,160-169 · src/lib/pof-bridge/connection-manager.ts:161-169,173-182
- **Scenario**: A connected bridge drops mid-session. After 3 failed health checks the manager calls `scheduleReconnect()`. Whatever `reconnectAttempts` happens to be in state (0 if the session connected cleanly, or a stale non-zero value from a prior reconnect storm) is used as the backoff exponent.
- **Root cause**: `scheduleReconnect` computes `delay = base * 2^reconnectAttempts` reading `this.state.reconnectAttempts` (connection-manager.ts:163-167). On a clean connect that value was reset to 0, so the *first* post-disconnect reconnect fires immediately at `base` with no settling delay — hammering a UE5 editor that is likely mid-compile/PIE-hitch. The `disconnect()`-on-failure path (line 151) sets status but does not normalize the counter, and the success path resets to 0 only on the *next* successful ping. The duplication in finding 1 means this exists identically in both managers.
- **Impact**: Reconnect timing is coupled to incidental prior state rather than "time since this disconnect"; thundering-herd reconnect right when the editor is busiest. Subtle and only reproduces on real drops, so it survives review.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: On entering the failure/reconnect path, explicitly seed the attempt counter for *this* disconnect episode (e.g. reset to 0 when transitioning connected→reconnecting, then increment per attempt) and add small jitter (`delay * (0.5 + Math.random()*0.5)`) to avoid synchronized reconnects across tabs/bridges.

## 3. Every WebSocket message rewrites the whole live snapshot into Zustand, and the FPS timer fires a store write every second unconditionally
- **Severity**: high
- **Lens**: performance
- **Category**: re-render storm / payload churn
- **File**: src/lib/ue5-bridge/ws-live-state.ts:300-303,306-310,343-351 · src/hooks/useLiveStateSync.ts:58-63 · src/stores/ue5BridgeStore.ts:88-93
- **Scenario**: UE5 streams `state.delta` and `property.update` messages at viewport/property-watch rates (tens per second when dragging an actor or watching a fast-changing float). Every message calls `emitter.setState(...)`, which notifies the `useLiveStateSync` subscriber, which calls `setLiveState(state)` — and `setLiveState` (ue5BridgeStore.ts:88) replaces `liveSnapshot`, rebuilds `propertyWatches` via `Object.fromEntries(liveState.propertyWatches)` (a full Map→object copy), and writes `wsFrameRate` on *every* message.
- **Root cause**: No diffing/throttling between the WS firehose and the React store. The emitter clones the whole `LiveEditorState` (including a fresh `new Map(...)`, ws-live-state.ts:61) per message; the hook then does a second full copy into the store. Additionally `startFpsCounter` (ws-live-state.ts:346-350) calls `setState({ frameRate })` every 1000ms even when `frameRate` is unchanged (e.g. steady 0 while idle), forcing a store write + re-render of every component reading the store once per second forever while connected.
- **Impact**: At 30 msg/s a delta-heavy session triggers ~30 full snapshot+Map reconstructions and store writes per second, re-rendering every `useLiveStateSync`/store consumer; plus a guaranteed 1 Hz re-render even when totally idle. On a large `selectedActors`/`dirtyPackages` snapshot this is real CPU and GC pressure in the editor-companion UI.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: (a) Guard the FPS write: `if (next !== this.frameRate) this.setState({ frameRate: next })`. (b) Throttle store sync to animation-frame or a fixed ~10 Hz (coalesce bursts of deltas into one `setLiveState`). (c) Only copy `propertyWatches` into the store when watches actually changed (track a dirty flag), not on every snapshot/delta message.

## 4. Build stdout accumulates unbounded in memory and is persisted whole into SQLite, with per-chunk re-split + regex on every line
- **Severity**: medium
- **Lens**: performance
- **Category**: payload bloat / memory
- **File**: src/lib/ue5-bridge/build-pipeline.ts:128,171-187,253,332 · src/lib/ue5-bridge/build-pipeline.ts:307-334
- **Scenario**: A full UE5 editor target build emits tens of thousands of compile lines over several minutes. `handleData` does `output += text` with no cap (line 173), then `text.split('\n')` and a regex `.match` on every line of every chunk (lines 176-186) purely to detect `[N/M]` progress.
- **Root cause**: The entire raw build log is held in one growing string for the process lifetime, returned in `BuildResult.output` (line 253), and written verbatim into the `headless_builds.output` TEXT column (line 332) on every build — `getBuildHistory` then reads the full `output` back for up to 20 rows (build-pipeline.ts:361-381) even though history views rarely need the megabytes of raw text.
- **Impact**: Multi-MB build logs sit in Node heap during the build and bloat the SQLite DB row-for-row; `getBuildHistory(path, 20)` can pull tens of MB of log text into memory just to render a history list. Progress parsing re-allocates a line array per chunk.
- **Effort**: 4 · **Value**: 5
- **Fix sketch**: Keep a rolling tail (e.g. last ~256 KB) plus the parsed diagnostics rather than the full log, or gzip the `output` column. Parse progress incrementally on a line buffer (carry the partial last line between chunks) instead of `split` per chunk. Have `getBuildHistory` SELECT explicit columns and omit `output` (lazy-load full log only when a single build is opened).

## 5. `useUE5Connection` subscribes to the entire store (no selector), so the WS firehose re-renders it on every live-state write
- **Severity**: medium
- **Lens**: performance
- **Category**: missing selector / unnecessary re-render
- **File**: src/hooks/useUE5Connection.ts:25
- **Scenario**: The connection panel/header that uses `useUE5Connection` re-renders every time *any* unrelated store field changes — including the high-frequency `wsFrameRate`/`liveSnapshot`/`propertyWatches` writes from finding 3.
- **Root cause**: Line 25 destructures the whole store: `const { host, httpPort, autoConnect } = useUE5BridgeStore();`. With no selector, Zustand subscribes the component to the entire `UE5BridgeState`, so the per-message `setLiveState` writes (and the 1 Hz FPS write) trigger a re-render even though this hook only needs three persisted settings. Every other hook in this context uses per-field selectors (usePofBridge.ts:27-33, useLiveStateSync.ts:46-52) — this one is the outlier.
- **Impact**: Couples the static connection UI to the live-sync firehose; combined with finding 3 it multiplies the re-render storm across components that have nothing to do with live state.
- **Effort**: 1 · **Value**: 4
- **Fix sketch**: Use per-field selectors like the sibling hooks: `const host = useUE5BridgeStore((s) => s.host);` etc. (or a `useShallow` selector returning just `{host, httpPort, autoConnect}`).
