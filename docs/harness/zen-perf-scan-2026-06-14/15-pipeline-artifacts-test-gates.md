# Pipeline Artifacts & Test Gates — zen-perf scan
> Context: Catalog to UE Pipeline / Pipeline Artifacts & Test Gates
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. `executor.available()` called per-job inside the drain loop — N round-trips to UE per drain
- **Severity**: high
- **Lens**: performance
- **Category**: N+1 / redundant probe
- **File**: src/lib/test-gate-runner/drain.ts:119
- **Scenario**: A drain over a catalog with K deferred L3 jobs (worker tick, or `POST /api/pipeline-artifacts/drain`). `drainJobs` iterates every job and calls `await executor.available()` for each one before running it.
- **Root cause**: Availability is treated as per-job state, but for the bridge executor `available()` is a full HTTP GET to `http://127.0.0.1:30040/pof/status` (bridgeExecutor.ts:95-102) wrapped in a 120s-timeout AbortController. The bridge's reachability does not change across the jobs of a single drain pass — it is a per-pass property, not a per-job one.
- **Impact**: K extra HTTP round-trips per drain (one status probe per deferred job). On a cold/unreachable bridge each probe must fail/time out before the job is skipped, so a queue of 50 deferred jobs against a down editor pays 50 sequential status failures every worker tick (default 5-min cooldown still re-probes the whole set on the next eligible tick). Pure latency + socket churn against a non-reentrant editor.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Probe each distinct `executor` once at the top of `drainJobs` (e.g. `const avail = new Map(); for (const e of executors) avail.set(e, await e.available())`), then consult the map inside the loop. Keeps the "skipped: `${executor.id} unavailable`" semantics, drops K probes to ≤2 per pass.

## 2. Drain worker `cooldownUntil` map grows unbounded and never evicts stale keys
- **Severity**: high
- **Lens**: both
- **Category**: memory leak / missing cleanup
- **File**: src/lib/test-gate-runner/worker.ts:36,52
- **Scenario**: The always-on worker runs `runDrainTick` every `intervalMs`. Every skipped job writes `cooldownUntil.set(keyOf(r.job), now + cooldown)` (worker.ts:52). Entries are only ever removed when that exact `catalogId|entityId|step` is re-collected and runs successfully (worker.ts:53).
- **Root cause**: Once an artifact stops being `deferred` (it passed elsewhere, was deleted, re-keyed, or its catalog was removed), its key is never re-collected, so its cooldown entry is never deleted — it lives for the lifetime of the process. There is no TTL sweep and no cap. The map is a module-level singleton that survives across worker restarts only via `startDrainWorker` calling `cooldownUntil.clear()` (worker.ts:64), so a long-running worker that is never restarted accumulates one dead entry per job that ever skipped-then-vanished.
- **Impact**: Slow unbounded heap growth on a long-lived server process driving a churning catalog; also a subtle correctness smell (a re-created entity with a reused key inherits a stale cooldown). Low per-entry cost but it is a classic never-ending-process leak.
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: After computing `summary.results`, prune entries whose `expiry <= now` and that were not in the just-collected job set; or simpler — at the top of each tick drop all entries with `value <= now` (an expired cooldown is dead weight regardless). A `Map` size cap with oldest-eviction is a cheap backstop.

## 3. `listDeferredArtifacts` full-scans `pipeline_artifacts` — no index on `status`/`tier`
- **Severity**: medium
- **Lens**: performance
- **Category**: missing index
- **File**: src/lib/pipeline-artifacts-db.ts:74-83 (DDL at :24-35; index-pattern reference db.ts:113)
- **Scenario**: `collectDeferred` → `listDeferredArtifacts` runs on every worker tick and every drain GET/POST. Its WHERE is `status = 'deferred' [AND tier = ?] [AND catalog_id = ?] [AND entity_id = ?]`.
- **Root cause**: The only index on the table is the `PRIMARY KEY (catalog_id, entity_id, step)`. The deferred query's leading predicate is `status`, which is not the PK prefix, so SQLite cannot use the PK index and scans the full table every time. db.ts shows the codebase already creates secondary indexes for exactly these access patterns (idx_session_log_*, idx_build_history_*), so the omission is an oversight, not a convention.
- **Impact**: Full table scan per tick. Negligible at tens of rows; linear degradation as the artifact table grows across many catalogs/entities/steps. The drain worker makes this a recurring cost, not a one-off.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: In `ensureTable()` add `CREATE INDEX IF NOT EXISTS idx_pipeline_artifacts_deferred ON pipeline_artifacts(status, tier, catalog_id, entity_id)`. Cheap, matches the existing db.ts pattern, makes the runner's hot query an index range scan.

## 4. Bridge poll loop arms a 120s AbortController on every poll iteration
- **Severity**: medium
- **Lens**: performance
- **Category**: subprocess/timeout handling
- **File**: src/lib/test-gate-runner/bridgeExecutor.ts:81-89,124-130
- **Scenario**: After `run-automation` returns a non-terminal `accepted`/`running`, `run()` polls `/test/results` up to `maxPolls` (60) times, `pollMs` (2s) apart. Every poll goes through `call()`, which creates a fresh `AbortController` + `setTimeout(…, timeoutMs)` with `timeoutMs` defaulting to 120_000.
- **Root cause**: A single per-request timeout constant is reused for both the initial synchronous `run-automation` POST and each lightweight results GET. A results poll that should fail fast instead can hang for up to 120s, and the worst-case wall-clock for one job is `maxPolls × (pollMs + up-to-timeoutMs)` ≈ 60 × 122s before the loop gives up — far longer than the intended ~2-minute gate, and it blocks the single-resource lease the whole time (drainJobs runs jobs strictly serially).
- **Impact**: A flaky/slow bridge can stall one drain job for minutes and, because the drain is serialized and non-reentrant, starve every other deferred job behind it. The watchdog story that the spawn executor has (SIGKILL after a bounded timeout) has no equivalent ceiling on the bridge poll path.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Use a short timeout for poll GETs (e.g. `pollMs`-scaled, a few seconds) distinct from the long `run-automation` POST timeout; and/or cap total poll wall-clock with a single deadline computed once before the loop, breaking when `Date.now() > deadline`.

## 5. L4 visual gate is structurally unreachable from the drain worker (dead branch)
- **Severity**: low
- **Lens**: architecture
- **Category**: dead code / config gap
- **File**: src/lib/test-gate-runner/worker.ts:44 (with executors.ts:28-41)
- **Scenario**: The worker builds executors via `buildExecutors(cfg.executor ?? { executor: 'bridge' })`. `buildExecutors` only appends the L4 `visual-bridge` executor when `cfg.appOrigin` is truthy (executors.ts:28). `WorkerConfig.executor` is an `ExecutorConfig`, but nothing in the worker path ever populates `appOrigin` (only the drain API route does, via `getOriginFromRequest`, drain/route.ts:53).
- **Root cause**: The worker has no notion of the server's own origin, so it can never assemble an L4 executor. Any L4 deferred job collected by the worker falls into `drainJobs`' `no L4 executor` skip (drain.ts:111) and is then cooled for 5 minutes — every tick, forever. The comment at worker.ts:19 ("defaults to the bridge — L4 needs a screenshot") acknowledges L3-only but the L4 jobs still get collected and churned.
- **Impact**: Mostly clarity/dead-path debt: L4 jobs the worker collects can never run through it and just consume collect + skip + cooldown cycles. No correctness break (the API route can still drain L4), but it is a silently inert capability and a small recurring no-op cost.
- **Effort**: 4 · **Value**: 3
- **Fix sketch**: Either (a) let the worker filter out L4 at collection time (`cfg.filter.tier` defaulting to L3) so it never collects what it cannot run, documenting that L4 is API-only; or (b) thread an `appOrigin` into `WorkerConfig` so the worker can build the visual executor when a screenshot resolver is configured. Pick one and make the L4-via-worker contract explicit.
