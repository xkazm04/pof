# Bug Hunt — Blender MCP Integration
> Total: 4
> Severity: 1 critical, 2 high, 1 medium

## 1. Concurrent commands on the shared singleton socket cross-wire responses
- **Severity**: critical
- **Category**: race-condition
- **File**: src/lib/blender-mcp/service.ts:117-161 (sendCommand) + 346-349 (getService singleton)
- **Scenario**: If two API routes run concurrently — e.g. the ViewportPreview auto-capture hits `/api/blender-mcp/screenshot` while a generate-status poll hits `/api/blender-mcp/generate/status`, or `getSceneInfo()` (the connect health check) overlaps any user request — both call `sendCommand` on the same process-wide `BlenderMCPService` instance, and each registers its own `socket.on('data', onData)` listener against the **same** `this.socket`.
- **Root cause**: The design assumes one in-flight command at a time, but the service is a module singleton (`getService()`) shared across all Next.js route handlers, which serve requests concurrently. The wire protocol has "no delimiter, no length prefix" (types.ts), so there is no request/response correlation. Every `data` chunk is delivered to *every* registered `onData` closure; whichever closure's private `buffer` first parses as valid JSON resolves — possibly with the **other** command's payload — and consumes bytes the sibling command still needs. Responses get attributed to the wrong promise.
- **Impact**: corruption — `getSceneInfo` returns a screenshot blob, `pollJobStatus` returns scene data, status flips, imports report wrong objects. Silent wrong-data, not a crash, so it is invisible until someone debugs "why did my asset list become a base64 string".
- **Fix sketch**: Make concurrency impossible at the transport: serialize commands through a single FIFO queue (one outstanding request per socket, next dequeues on resolve/timeout), or add a per-command request id + length-prefix framing and a single persistent `data` handler that demuxes by id. Never attach a fresh `data` listener per call to a shared socket.

## 2. Response buffer accumulates across commands and is unbounded, hanging the next command
- **Severity**: high
- **Category**: silent-failure
- **File**: src/lib/blender-mcp/service.ts:127-148
- **Scenario**: If a command times out (its `onData` listener is removed at line 129) but Blender later flushes that command's bytes onto the socket, those bytes are still buffered by the OS and delivered to the **next** command's fresh `onData`. The new buffer becomes `<<stale response>><<my response>>`, i.e. `{...}{...}`, which `JSON.parse` can never accept — so the new command never resolves and silently hangs for the full 30s `blenderTcpTimeout`. The same happens any time two responses' bytes coalesce into one chunk.
- **Root cause**: Try-parse framing assumes the buffer contains exactly one whole JSON object and nothing trailing. There is no resynchronization after a timeout/partial read and no cap on buffer growth. A leftover/extra response permanently poisons the stream for that connection. A large viewport screenshot (base64 PNG) that never produces a parseable terminator also grows `buffer` without bound, pinning memory until timeout.
- **Impact**: UX degradation / availability — every subsequent command on a connection that ever saw a stale or coalesced response dead-hangs 30s and then errors, making the panel feel broken until reconnect. Unbounded buffer is a memory risk on large payloads.
- **Fix sketch**: Tie buffer ownership to the connection, not the call (single persistent reader), with explicit framing (length prefix or newline-delimited JSON) so each response is sliced off deterministically; drop/realign leftover bytes on timeout; enforce a max buffer size that errors loudly instead of hanging.

## 3. Dropped TCP connection is never detected — UI shows "Connected" forever (no heartbeat)
- **Severity**: high
- **Category**: silent-failure
- **File**: src/stores/blenderMCPStore.ts:157-168 (refreshStatus, never called) + src/lib/blender-mcp/service.ts:96-99 (close handler)
- **Scenario**: If Blender crashes, is closed, or restarts after a successful connect, the server-side socket fires `'close'` and the service quietly sets `this.socket = null` / `connected: false`. But the client store's `connection.connected` was set to `true` at connect time and is **only** re-read by `connect`/`disconnect`/`refreshStatus`. `refreshStatus` is defined but invoked nowhere in the codebase (grep confirms zero call sites; there is no polling interval for Blender as there is for the UE5/PoF bridges). So the connection pill stays green indefinitely.
- **Root cause**: The store treats `connected` as a fact established once at connect, not as live state that must be re-validated. Auto-retry only fires on a *failed* `connect()`, never on a *dropped established* connection, so there is no recovery path for the common "Blender went away mid-session" case.
- **Impact**: UX degradation / success theater — the user sees "Connected", clicks Capture/Execute/Import, and every call returns "Not connected to Blender" with no diagnosis, and the auto-reconnect machinery (which exists and works) never engages.
- **Fix sketch**: Make liveness observable: have the API `'close'`/error propagate an event (SSE/poll) or run a lightweight heartbeat that calls `refreshStatus` on an interval while `connected`, and on detecting a drop set `connection.connected=false` and route into the existing `scheduleRetry()` backoff loop when `autoConnect` is on.

## 4. connect() clears its timeout before the health check, so connect can hang ~2× the timeout
- **Severity**: medium
- **Category**: edge-case
- **File**: src/lib/blender-mcp/service.ts:63-101
- **Scenario**: If the TCP handshake succeeds but Blender is busy (modal dialog, heavy bake) when the post-connect `getSceneInfo()` health check runs, the connect-level `timer` was already `clearTimeout`-ed at line 72, so the only bound left is `sendCommand`'s own 30s timeout. Total `connect()` latency becomes ~`blenderTcpTimeout` (connect) effectively unbounded up to a second full 30s for the health check — and during that window the `'error'` event can still fire and call `resolve` a second time (ignored), while `this.socket`/`connected` may already have been set to a live socket by the connect callback, leaving an orphaned connected socket the store believes failed.
- **Root cause**: The connect timeout is scoped to the TCP handshake only; the design assumes the health check is instant. It treats "socket open" as "connected" (sets `this.socket`/`connected:true` at lines 73-74) *before* the addon is verified, so an error or slow health check during that window corrupts the connected/socket state the rest of the service reads.
- **Impact**: UX degradation — "Connecting…" can stall up to ~60s with the connect button disabled; on the slow path an orphaned socket can linger while the UI reports failure (resource confusion, not freed until next connect's `disconnect()`).
- **Fix sketch**: Use a single overall deadline that spans handshake + health check (one timer cleared only on final resolve), and don't publish `this.socket`/`connected:true` until the addon health check passes — promote to connected state only on the success path so partial-connect windows can't leak state.
