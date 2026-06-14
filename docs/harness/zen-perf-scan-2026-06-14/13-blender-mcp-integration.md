# Blender MCP Integration — zen-perf scan
> Context: Audio & Blender Pipeline / Blender MCP Integration
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Connection "connected" state goes stale forever — health-check constant defined but never wired
- **Severity**: high
- **Lens**: both
- **Category**: connection-lifecycle / dead-config
- **File**: src/lib/blender-mcp/service.ts:104 (socket `close` handler) · src/lib/constants.ts:143 (`blenderHealthCheck: 15_000`) · src/stores/blenderMCPStore.ts:157 (`refreshStatus`)
- **Scenario**: Blender is closed, crashes, or the box sleeps while PoF shows "Connected". The OS tears the TCP socket down; the service's `close` handler flips its own `connection.connected = false` and nulls the socket — but nothing pushes that to the client. The store's `connection.connected` stays `true`, so the pill shows green and the Capture / Execute buttons stay enabled.
- **Root cause**: There is no periodic liveness probe. `UI_TIMEOUTS.blenderHealthCheck` (15s) was added for exactly this and is referenced nowhere in `src` (grep confirms zero call sites). `refreshStatus()` exists in the store but is also never invoked anywhere — it is the missing consumer. So a dropped socket is only discovered lazily, when the user fires the *next* command and it fails with "Not connected to Blender".
- **Impact**: Misleading UI state; first action after a silent drop always fails; the auto-retry backoff loop (which only arms on a failed `connect`) never engages because the store still believes it is connected, so the connection never self-heals.
- **Effort**: 4 · **Value**: 8
- **Fix sketch**: While `connection.connected`, run a `setInterval(get().refreshStatus, blenderHealthCheck)` (mount it in `BlenderConnectionBar` or as a store-managed module-level timer like `retryTimer`); clear it on disconnect. Make the service treat a socket `close` as "needs reconnect" so a stale status flips to disconnected and, if `autoConnect`, kicks `scheduleRetry()`. Either use `refreshStatus`/`blenderHealthCheck` or delete both — right now both are dead.

## 2. `onData` re-parses the entire growing buffer on every TCP chunk — O(n²) over large screenshot/asset payloads
- **Severity**: high
- **Lens**: performance
- **Category**: socket-read / quadratic-work
- **File**: src/lib/blender-mcp/service.ts:197-209
- **Scenario**: `getViewportScreenshot()` returns a base64 PNG (max_size 800, PNG) — tens to hundreds of KB; asset-search results and `get_scene_info` on a busy scene are similarly large. The framing protocol has no length prefix, so the reader accumulates `buffer += chunk` and calls `JSON.parse(buffer)` on **every** chunk until it succeeds.
- **Root cause**: Large payloads arrive split across many ~64KB TCP segments. Each arriving chunk re-parses the full accumulated string and (on the failing attempts) re-throws. With k chunks of total size n, work is ~O(k·n) ≈ O(n²) plus k discarded exception allocations. For a multi-hundred-KB screenshot this is the hot path that backs the viewport preview.
- **Impact**: Noticeable CPU spike and main-event-loop blocking inside the API route on every capture/large response; gets worse precisely as payloads grow.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Cheap parse-readiness gate before `JSON.parse`: only attempt once the buffer looks complete (e.g. trailing `}`/`]` after trimming, or track brace depth incrementally). Better: only re-parse when the *last* received chunk plausibly closes the object. Also add a max-buffer guard (see #3) so a never-closing response fails fast instead of growing for the full 30s timeout while being reparsed each chunk.

## 3. No bounded receive buffer + 30s blanket timeout on every command — a wedged/garbage response ties up the single command chain
- **Severity**: medium
- **Lens**: both
- **Category**: timeout / resource-bound
- **File**: src/lib/blender-mcp/service.ts:159-222 (buffer at :169, timer at :181 using `blenderTcpTimeout: 30_000`)
- **Scenario**: The addon sends a partial/garbled response (no closing brace) or a flood of bytes that never parses. Because commands are strictly serialized on `commandChain`, the whole bridge stalls for the full 30s `blenderTcpTimeout` while `buffer` grows without bound, then poisons the connection.
- **Root cause**: `buffer` has no size ceiling, and a single 30s timeout is applied uniformly — too long for a quick `get_scene_info`/status poll, and there is no early bail when the buffer is clearly oversized garbage. The serialized chain means one slow command blocks all others (status, screenshot) behind it.
- **Impact**: A misbehaving addon response freezes all Blender interaction for up to 30s and can briefly balloon memory with the unbounded buffer.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Add a max-buffer cap (e.g. a few MB) that `settle(err(...))` + `disconnect()` the moment it is exceeded. Consider per-command-class timeouts (short for status/scene, long for downloads/imports) instead of one 30s blanket, so cheap calls fail fast.

## 4. `AssetInventory` recomputes per-card dependency edge counts on every render (no memo)
- **Severity**: medium
- **Lens**: performance
- **Category**: missing-memoization / re-render
- **File**: src/components/modules/content/models/AssetInventory.tsx:455
- **Scenario**: Each rendered card runs `scanResult.dependencies.filter(e => e.from === asset.name || e.to === asset.name).length` inline in JSX. With C visible cards and D dependency edges this is O(C·D) recomputed on **every** render — and renders are frequent here (search keystrokes, type-filter clicks, sort toggles, hover/expand state, framer-motion layout animations all re-render the grid).
- **Root cause**: The edge-count-per-asset is derived data computed in the render body rather than precomputed once from `scanResult.dependencies`. `displayAssets` is memoized but the per-card edge count is not.
- **Impact**: On a real UE5 Content/ scan (hundreds–thousands of assets, many dependency edges) every keystroke in the search box re-walks the full dependency list once per card — janky filtering/typing.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Build an edge-count map once with `useMemo` keyed on `scanResult.dependencies` (`Map<assetName, number>`, increment for both `from` and `to`), then read `edgeCount.get(asset.name) ?? 0` in the card. Same `assetMap` pattern already used inside `DependencyGraph` (line 68) — hoist it.

## 5. `refreshStatus` store action is dead code
- **Severity**: low
- **Lens**: architecture
- **Category**: dead-code
- **File**: src/stores/blenderMCPStore.ts:157-168
- **Scenario**: `refreshStatus` is declared in the state interface (:38) and implemented (:157), making a POST `{action:'status'}` round-trip, but grep finds no caller anywhere in `src`.
- **Root cause**: It was presumably the intended consumer of the never-wired health-check loop (see #1). Without that loop it is pure surface area: another action component authors might wire up incorrectly, plus an unused `/api/blender-mcp` `status` branch kept alive only for it.
- **Impact**: Low — confusion and maintenance weight; signals an unfinished feature (the health check).
- **Effort**: 1 · **Value**: 3
- **Fix sketch**: Either delete `refreshStatus` (and reassess the `status` action's other caller — the server route also serves it for `getStatus`), or, preferably, resolve #1 by wiring `refreshStatus` into the periodic health check so it earns its place.
