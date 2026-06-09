# Bug Hunt — Pipeline Artifacts & Test Gates
> Total: 4
> Severity: 0 critical, 2 high, 2 medium, 0 low

## 1. Two uncoordinated concurrency guards both drive the single non-reentrant UE editor
- **Severity**: high
- **Category**: race-condition
- **File**: src/app/api/pipeline-artifacts/drain/route.ts:9-12, src/lib/test-gate-runner/worker.ts:34, 71-77
- **Scenario**: If an operator starts the always-on drain worker (POST `/drain/worker {action:'start'}`) and *also* fires a manual `POST /drain` — or fires two manual drains with different filter scopes (one global `{}`, one `{catalogId:'items'}`) — both run gates against the same running editor at the same time.
- **Root cause**: The non-reentrancy invariant ("the drain talks to a shared, non-reentrant UE editor — overlapping requests would clobber each other and produce garbage verdicts") is enforced by *two separate* in-process locks that don't know about each other: the route's `drainInFlight` Set and the worker's `tickInFlight` boolean. Worse, `drainInFlight` is keyed by `${catalogId ?? '*'}|${entityId ?? '*'}`, so a global drain (`*|*`) and a scoped drain (`items|*`) take *different* keys and the 409 guard never trips even though both reach the same editor. The lock is per-request-shape, not per-resource (the editor is the resource — there is exactly one).
- **Impact**: corruption — interleaved `run-automation` POSTs and `/test/results` polls cross-contaminate; one drain reads the other's test verdict and writes it back to the wrong artifact (false pass/fail persisted, the explicitly-feared "garbage verdicts").
- **Fix sketch**: Make the editor a single global lease, not a per-key/per-caller flag. One process-wide async mutex (or a single global `Set` keyed by a constant resource id) that *both* the worker tick and every drain request must acquire before touching an executor; requests that can't acquire it return 409 / are skipped. The guard must key on the shared resource, never on the request's filter shape.

## 2. Results correlation uses substring matching — an unrelated test's failure poisons the gate
- **Severity**: high
- **Category**: logic-error
- **File**: src/lib/test-gate-runner/bridgeExecutor.ts:42-50
- **Scenario**: If the gate's `testName` is `"Fireball"` and the editor's automation results array also contains a sibling test whose id embeds that substring (e.g. `"FireballChain"`, `"FireballRank2"`, or a namespaced `"PoF.Ability.Fireball.Edge"`), `matched` collects *all* of them, and any one of those siblings failing forces this gate to `fail`.
- **Root cause**: Correlation is `r.testId.includes(matchName)` (substring), not an exact / boundary-anchored match. UE automation test ids are hierarchical dotted names, so one test name is frequently a prefix of another. The code assumes the recorded `testId` "may embed the automation name" and treats *any* containment as identity, conflating distinct tests. The same containment is reused to decide pass/fail over the whole matched set, so a foreign failure is attributed to this gate.
- **Impact**: corruption / UX degradation — a passing entity is recorded as `fail` (and emits a `gate.verdict.changed` regression event + webhook ping) because an unrelated test in the same run failed. Conversely, if only siblings match and the real test isn't recorded yet, a sibling's `passed` can mark the gate `pass` prematurely.
- **Fix sketch**: Correlate on exact identity. Prefer the `testId` the POST returned (already threaded through `interp.testId`) and match `r.testId === testId`; if falling back to name, require an anchored match (`r.testId === matchName` or a dotted-boundary check), never bare `includes`. Make "which result rows belong to this job" a single well-defined predicate, not a substring heuristic.

## 3. Deferred artifacts of any non-L4 tier are silently coerced to L3 and the stored tier is permanently overwritten
- **Severity**: medium
- **Category**: state-corruption
- **File**: src/lib/test-gate-runner/drain.ts:47, 60-69
- **Scenario**: If a `pipeline_artifacts` row is `deferred` with a `tier` that is null, `'L2'`, or any value other than `'L4'` (e.g. an L2-tier acceptance that was deferred, or a row written without a tier), `collectDeferred` builds the job with `tier: a.tier === 'L4' ? 'L4' : 'L3'` — it becomes an L3 job — and after the run `drainOne` upserts `tier: job.tier`, persisting `'L3'` over whatever was stored.
- **Root cause**: The runner assumes "deferred jobs are L3/L4 only" (stated in `parseTier`) but `collectDeferred`/`listDeferredArtifacts` never enforce it — the `WHERE status='deferred'` query returns rows of any tier, and the ternary launders them all into L3 instead of skipping the non-runnable ones. Then `drainOne` treats the job's coerced tier as authoritative truth and writes it back, so a read-time coercion mutates the source of record.
- **Impact**: corruption / data loss — an L2-deferred (or untiered) artifact gets executed by the L3 bridge against a test name it never declared, and its real tier is destroyed in the DB, making the acceptance-ladder history unrecoverable and the row mis-bucketed forever.
- **Fix sketch**: Filter at collection time: `listDeferredArtifacts` should only surface rows whose tier is actually a runnable gate tier (`L3`/`L4`), via `parseTier`; rows that aren't should never become jobs. In `drainOne`, preserve `existing.tier` rather than overwriting with the job's coerced tier — the verdict write must not be a tier-mutation.

## 4. Optimistic `applyLifecycle` never reconciles with the server — a rejected transition still shows as advanced/verified
- **Severity**: medium
- **Category**: state-corruption
- **File**: src/stores/catalogStore.ts:49-71
- **Scenario**: If the client optimistically advances an entity (e.g. `wired → verified`) via `applyLifecycle` and the paired `POST /api/catalog` is rejected by the server gate (409 — `resolveTransition` returns null because the server's stored `currentState` differs, or `testResult !== 'pass'`), the store keeps the advanced state. There is no rollback path.
- **Root cause**: The client and server each independently run `resolveTransition`, but against *different* base states: the store advances from its in-memory `current.lifecycle`, while the server advances from `getLifecycle()` (the DB). The store assumes its optimistic decision will match the server's, and provides no mechanism to revert when the server says no. The optimistic update is fire-and-forget — success theater.
- **Impact**: corruption / UX degradation — an entity displays as `verified` (green, "done") to the user and to any downstream rollup while the DB still has it at `wired`. A drain or reload that later loads server lifecycle (`loadLifecycle`) only overwrites entities present in the response, so the divergence can persist; decisions ("this is shippable") are made on a lie.
- **Fix sketch**: Treat the server as the only authority for committed lifecycle: either (a) don't apply the new lifecycle until the POST resolves, applying the server's returned `LifecycleRecord`, or (b) snapshot the prior entity before the optimistic set and roll back (re-applying the snapshot) in the POST's catch/non-2xx branch. Make "advance only what the server confirmed" the single code path so an unconfirmed advance is structurally impossible.
