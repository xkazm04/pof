# Build, Cook & Packaging — zen-perf scan
> Context: AI, Build & Packaging Systems / Build, Cook & Packaging
> Total: 6
> Severity: critical=0 high=2 medium=3 low=1

## 1. Size-budget gate is dead code in the interactive cook path
- **Severity**: high
- **Lens**: both
- **Category**: missing-integration / dead feature
- **File**: src/app/api/packaging/execute/route.ts:65-74
- **Scenario**: An operator cooks a Win64 Shipping build from the Pipeline tab. The cook succeeds, `dirSizeBytes` measures the staged build, and `insertBuild` records `sizeBytes`. The configured per-platform size budget and the "% growth vs last green" regression threshold (`evaluateBuildSize`, `getBudgetConfig`, `failOnRegression`) are *never consulted* on this path.
- **Root cause**: `evaluateBuildSize`/`getBudgetConfig`/`SIZE_REGRESSION_NOTE_PREFIX` (size-budgets.ts) are only wired into `scheduled-build-runner.ts:231` (grep confirms the sole non-test caller). The whole module — the entire reason `cook-executor.ts:19-21` is so careful never to record a fake `0` size — exists to gate cooks, but the user-facing cook ignores it. The size budget feature is effectively shipped-but-unreachable for interactive builds.
- **Impact**: A bloated build (e.g. 7 GB vs the 5 GB Win64 budget, or +40% vs last green) records cleanly with no warning, no `[SIZE_BUDGET]` note, and no surfaced regression — silently defeating the advertised "size budgets" capability of the module. Confidence is high: the persistence block records size but calls no evaluator.
- **Effort**: 3 · **Value**: 8
- **Fix sketch**: In the `done` branch (route.ts:65), after `insertBuild`, fetch the last green size for the platform (`getBuildsByPlatform` or a dedicated query), call `evaluateBuildSize(profile.platform, sizeBytes, lastGreen)`, and on a non-null regression: append `regression.note` to the build's `notes` and emit a final SSE event (e.g. `{ type: 'size-regression', note }`) so `CookProgress` can surface it. Reuse the exact `scheduled-build-runner` logic to avoid a second code path.

## 2. getBuildStats runs an N+1 per-platform query inside a map
- **Severity**: high
- **Lens**: performance
- **Category**: repeated-db-query / N+1
- **File**: src/lib/packaging/build-history-store.ts:202-206
- **Scenario**: The Build History dashboard mounts (or the operator hits Refresh). `?action=stats` calls `getBuildStats`, which runs 6 aggregate queries, then for *every distinct platform* runs an additional `SELECT … ORDER BY created_at DESC LIMIT 1` to fetch the latest size (line 204, inside `platformRows.map`).
- **Root cause**: The "latest size per platform" lookup was not folded into the grouped aggregate. With 5 platforms that is 5 extra round-trips per stats call; the dashboard issues this on every mount and every Refresh.
- **Impact**: 6 + N synchronous better-sqlite3 prepares/queries per stats fetch. Each query re-prepares (no cached statement) and re-scans `build_history`. For a busy history table this is the heaviest single endpoint on the page, and it compounds with finding #4 (the dashboard fires it alongside 3 other calls).
- **Effort**: 4 · **Value**: 6
- **Fix sketch**: Replace the per-platform loop with one window-function query: `SELECT platform, size_bytes FROM (SELECT platform, size_bytes, ROW_NUMBER() OVER (PARTITION BY platform ORDER BY created_at DESC) rn FROM build_history WHERE size_bytes IS NOT NULL AND status='success') WHERE rn=1`, then join the result into the aggregate rows by platform in JS. Also `const stats = db.prepare(...)` once at module scope to reuse prepared statements.

## 3. Profile-command generation does N sequential HTTP round-trips on every mount
- **Severity**: medium
- **Lens**: performance
- **Category**: sequential-await / chatty-API
- **File**: src/components/modules/game-systems/BuildConfigSelector.tsx:75-85
- **Scenario**: `fetchProfiles` runs on mount and on every Refresh / save / delete (`fetchProfiles` is in the deps of `handleSave`, `handleDelete`, etc.). For each profile it `await`s a separate `POST /api/packaging/profiles { action: 'generate-command' }` *inside a `for` loop*, so the requests are fully serialized.
- **Root cause**: `generateUATCommand` (uat-command-generator.ts:7) is a *pure* string builder with no I/O beyond `getEnginePath`. Round-tripping it to the server, once per profile, sequentially, is pure overhead — the command could be computed client-side, or all profiles batched in one call.
- **Impact**: With K profiles the panel makes 1 + K sequential requests before commands render; each save/delete re-runs the whole sequence. UI feels laggy and the server handles K redundant POSTs that do no real work.
- **Effort**: 4 · **Value**: 5
- **Fix sketch**: Either (a) expose `generateUATCommand` to the client (it imports only `getEnginePath`; if engine path must stay server-side, pass it in) and compute the map with `useMemo`, or (b) add a `action: 'generate-commands'` batch endpoint that returns `Record<id, command>` in one call. Drop the per-profile loop.

## 4. Dashboard issues 4 separate history requests where 1 composite call would do
- **Severity**: medium
- **Lens**: both
- **Category**: chatty-API / repeated-db-query
- **File**: src/components/modules/game-systems/BuildHistoryDashboard.tsx:350-355
- **Scenario**: `fetchAll` (mount, Refresh, after Record, after Delete, after version bump) fires `Promise.all` of four GETs to `/api/packaging/history` — `list`, `stats`, `trend`, `version`. Each is a separate route invocation hitting the DB independently; `stats` alone is the N+1 from finding #2.
- **Root cause**: The history route is a single switch keyed by `?action=`, but the client never has a way to ask for the common bundle, so the dashboard fans out four requests for one logical "load the dashboard" operation. Every mutating action (`handleRecord`, `handleDelete`, `handleBump`) calls `fetchAll`, re-fetching all four even when only one changed.
- **Impact**: 4× the request and DB-query count for every dashboard load and every mutation. `handleBump` already gets the new version in its own response yet still triggers a full 4-way `fetchAll` via `setVersion` paths in sibling handlers — redundant work.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Add `action=dashboard` returning `{ builds, stats, trend, version }` in one handler (reusing the existing store functions) and have `fetchAll` call it once. For mutations, prefer targeted refetch (e.g. `handleBump` already returns the version — just `setVersion`, no `fetchAll`).

## 5. Cook log derived-state recomputes the full 2000-line array on every appended line
- **Severity**: medium
- **Lens**: performance
- **Category**: missing-incremental / re-render cost
- **File**: src/components/modules/game-systems/CookProgress.tsx:265-291, 79-82
- **Scenario**: During a live cook RunUAT emits thousands of lines; `cook-executor` throttles to ~10 log events/sec. Each event runs `setLogs((prev) => appendCookLog(...))` which does `[...prev, entry]` (O(n) copy, line 80), then three `useMemo`s — `counts` (line 265), `displayedLines` (line 276), `errorRows` (line 287) — each re-scan the entire (up to 2000-entry) `logs` array because `logs` changed identity.
- **Root cause**: Counts are recomputed from scratch rather than incremented per appended line, and the array is rebuilt by spread on each append. The cap keeps it bounded at 2000, so it is not unbounded, but it is O(n) work per event for the whole hot path of a long cook.
- **Impact**: Sustained O(n) array copy + 3× O(n) scans on every log tick for the duration of a 10–60 minute cook. On a busy cook the console re-derivation is the dominant render cost of the packaging tab. Bounded (≤2000) so not critical, but avoidable.
- **Effort**: 4 · **Value**: 4
- **Fix sketch**: Maintain running `counts` incrementally (adjust on append, subtract on the trimmed-off head when over `max`). Keep `displayedLines`/`errorRows` memoized but recompute only when `filter` changes or via a ref-backed incremental filter. Optionally store logs in a ref + a small "version" counter to avoid the spread copy.

## 6. Smoke-test always sleeps the full observe window even when the spawn fails instantly
- **Severity**: low
- **Lens**: both
- **Category**: wasted-wait / control-flow
- **File**: src/lib/packaging/smoke-test.ts:111-125
- **Scenario**: `runSmokeTest` spawns the bootstrap; if the launch fails synchronously (caught at line 119) or asynchronously via the `error` listener (line 118), the code still unconditionally `await sleep(observeMs)` (default 25s, line 124) before computing `gameAlive = spawnError ? false : …`.
- **Root cause**: The observe wait is not short-circuited on a known spawn failure. The async-error path also means a fast ENOENT only sets `spawnError` partway through the 25s sleep, but the synchronous-throw path holds the API request open for the full window for nothing.
- **Impact**: The `/api/packaging/smoke-test` request blocks ~25s on a build that could never have launched, delaying the failure verdict the operator is waiting on. Low severity (correct result, just slow) but a free win.
- **Effort**: 2 · **Value**: 3
- **Fix sketch**: After the synchronous spawn block, `if (spawnError) { return { status: 'fail', gameAlive: false, … } }` before sleeping. For the async path, race the sleep against the bootstrap `error` event so a launch failure resolves early.
