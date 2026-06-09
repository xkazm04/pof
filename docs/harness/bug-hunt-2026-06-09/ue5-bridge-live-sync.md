# Bug Hunt — UE5 Bridge & Live Sync
> Total: 4
> Severity: 1 critical, 2 high, 1 medium

## 1. Headless build spawns UBT through a shell with unsanitized project paths and args (command injection)
- **Severity**: critical
- **Category**: logic-error
- **File**: src/lib/ue5-bridge/build-pipeline.ts:129
- **Scenario**: If a user (or any caller of `POST /api/ue5-bridge/build`) supplies a `projectPath`, `targetName`, or `additionalArgs[]` containing shell metacharacters while a build is enqueued...
- **Root cause**: `executeBuild` constructs `ubtPath`, `target`, and `projectArg = -Project="${request.projectPath}\\${request.targetName}.uproject"` and passes them to `spawn("\"${ubtPath}\"", args, { shell: true, ... })`. With `shell: true` on Windows, every arg is re-joined into a single command line and interpreted by `cmd.exe`. The build route (`ue5-bridge/build/route.ts`) only validates that these fields are non-empty strings — it never rejects `"`, `&`, `|`, `^`, `%`, or `&&`. A `projectPath` like `C:\proj" & calc & "x` closes the quote and injects an arbitrary command, executed with full server privileges. `additionalArgs` are spread in verbatim, so even a single crafted arg is sufficient.
- **Impact**: security (arbitrary command execution on the host running the Next.js server); also silent build corruption when a benign path simply contains a space/ampersand and the shell mis-parses the args.
- **Fix sketch**: Drop `shell: true` and invoke the UBT executable directly (`spawn(ubtPath, args, { shell: false })`) so each array element is passed as a literal argv entry with no shell parsing. Validate `projectPath`/`targetName` against an allowlist (e.g. must resolve under a known projects root, no shell metacharacters) at the trust boundary in the route handler. This makes the entire class of shell-injection impossible regardless of input.

## 2. Server-side connection-manager singletons leak timers and bleed connection state across all clients
- **Severity**: high
- **Category**: resource-leak
- **File**: src/lib/ue5-bridge/connection-manager.ts:123
- **Scenario**: If any browser tab triggers `connect` (auto-connect or manual) and then navigates away, closes, or crashes — while UE5 is momentarily unreachable...
- **Root cause**: `ue5Connection` (and `pofBridgeConnection`) are module-level singletons living in the Next.js **server** process. `connect()` starts `setInterval` health checks and an unbounded exponential-backoff `scheduleReconnect()` loop. Nothing ever calls `disconnect()` on client teardown: the SSE route (`ue5-bridge/status/route.ts`) only `unsubscribe()`s its state listener on `request.signal` abort — it never tells the manager to stop. So the health-check/reconnect timers run forever in the server, and on initial failure the manager stays in a perpetual reconnect loop (`reconnectAttempts` grows without any cap or give-up). Worse, because the manager is a single global, *every* connected client shares one connection state and one set of credentials/host — one user's `connect`/`disconnect` overwrites everyone's view, and a second tab's `connect(hostB)` races the first tab's reconnect loop targeting `hostA`.
- **Impact**: resource leak (timers + sockets accumulate across sessions, never reclaimed); UX degradation / state corruption (multi-tab and multi-user sessions see each other's connection status; "connected" theater persists after the originating client is gone).
- **Fix sketch**: Make connection lifecycle reference-counted or session-scoped: track active SSE subscribers and call `disconnect()` (clearing timers) when the count hits zero. Cap reconnect attempts and surface a terminal `error` state instead of looping forever. If true multi-client isolation is needed, key managers by session rather than using a process-global singleton.

## 3. Live-state WebSocket sends (property write / watch / snapshot) silently no-op when the socket isn't OPEN
- **Severity**: high
- **Category**: silent-failure
- **File**: src/lib/ue5-bridge/ws-live-state.ts:320
- **Scenario**: If the user edits a UE5 property, subscribes to a watch, or requests a snapshot during the (frequent) `connecting`/`reconnecting`/`disconnected` window...
- **Root cause**: `send()` is `if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(...)` — when the socket is not open it does nothing, returns void, and reports no error. All public mutators funnel through it: `setProperty` (an optimistic write to the live editor), `unwatchProperty`, `requestSnapshot`, and the re-subscribe path. The UI hook (`useLiveStateSync`) exposes these as fire-and-forget actions with no return value and no rollback. `setProperty` in particular has no optimistic update + reconcile: the operator believes they changed a UE5 actor property, but the message was dropped on the floor. `unwatchProperty` compounds the inconsistency — it eagerly mutates local `propertyWatches` state even though the unsubscribe message may never reach UE5, so on reconnect the maps disagree with the server.
- **Impact**: data loss / UX degradation (edits and commands silently vanish; user has no signal to retry, and may assume the change took effect on a live editor).
- **Fix sketch**: Have `send()` return a boolean (or queue messages while `CONNECTING`/`reconnecting` and flush on `onopen`, as is already done for watches). Surface delivery failure to callers so the UI can show "not synced" and offer retry. For `setProperty`, adopt an explicit optimistic-update record keyed by an ack so a missing ack reverts the displayed value.

## 4. `autoUpdateFeatureMatrix` ignores the persistence result and emits "verified" events even when the DB write fails
- **Severity**: medium
- **Category**: silent-failure
- **File**: src/lib/pof-bridge/verification-engine.ts:88
- **Scenario**: If the `POST /api/feature-matrix` batch update fails (network blip, validation error, 500) while auto-verifying features from a PoF Bridge manifest...
- **Root cause**: The function `await tryApiFetch('/api/feature-matrix', { method: 'POST', ... })` but never inspects the returned `Result`. Immediately after, it unconditionally loops over `updates` and emits `checklist.item.changed` events (with `source: 'auto-verify'`) and returns `results` carrying the new statuses. So when the write silently fails, downstream listeners and the returned report both reflect statuses that were never persisted. On the next manifest poll the same diff recomputes and re-fires the events (event storm), because the DB still holds the old status — the system believes it keeps "changing" features that never actually changed.
- **Impact**: corruption of the feature-matrix view vs. DB (success theater: UI marks features implemented/improved that the DB never recorded); repeated spurious `checklist.item.changed` events on every poll.
- **Fix sketch**: Capture the `tryApiFetch` result; only emit `checklist.item.changed` and report the new statuses when the write succeeds. On failure, log/propagate the error and leave `previousStatus` intact so the next poll retries cleanly rather than emitting against an unpersisted state.
