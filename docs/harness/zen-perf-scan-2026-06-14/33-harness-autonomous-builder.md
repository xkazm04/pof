# Harness Autonomous Builder — zen-perf scan
> Context: Director, Sessions & Autonomy / Harness Autonomous Builder
> Total: 5
> Severity: critical=0 high=3 medium=2 low=0

## 1. Dev server subprocess leaks on every error/crash and is unkillable on Windows
- **Severity**: high
- **Lens**: performance
- **Category**: process cleanup
- **File**: src/lib/harness/orchestrator.ts:849 (cleanup only on happy path) + 137-142 (`shell: true` spawn) + 862-873 (error path never cleans up)
- **Scenario**: The visual gate needs a dev server, so `ensureDevServer` spawns `npx next dev` (orchestrator.ts:137). `killDevServer()` is only called at the very end of `runLoop()` (line 849). When `runLoop` throws, `runLoopWithErrorCapture` (862) catches, persists, and re-throws — never calling `killDevServer()`. Worse, the server is spawned with `shell: true` (line 140), so on Windows `devServerProc.kill()` (line 175) kills only the wrapping `cmd.exe` shell, orphaning the actual `node` dev-server process holding port 3000.
- **Root cause**: Cleanup lives on a single non-`finally` code path, and `kill()` on a `shell:true` child does not reap the process tree.
- **Impact**: Each crashed/aborted run leaks a Next.js dev server bound to port 3000. The next run's `checkPort(3000)` (line 129) then sees the stale zombie as "alive" and skips starting a fresh one, so the visual gate screenshots a stale build forever. Memory/port exhaustion across repeated runs.
- **Effort**: 3 · **Value**: 8
- **Fix sketch**: Wrap the loop body in `try { … } finally { killDevServer(); }` inside `runLoop` (or move the cleanup into `runLoopWithErrorCapture`'s `finally`). For real tree-kill on Windows, spawn `next dev` with `detached: true` and kill the process group, or use `tree-kill`/`taskkill /pid /t /f`. Clear the 30s `ensureDevServer` timeout in the error/resolve branches (it already is, but the stdout listener is never detached).

## 2. Budget governor overshoots the cap by up to (maxConcurrent − 1) sessions
- **Severity**: high
- **Lens**: both
- **Category**: concurrency / cost control
- **File**: src/lib/harness/orchestrator.ts:614-643 (`fillPool`) + 423 (`recordSessionCost` runs only after the session returns)
- **Scenario**: `fillPool` launches up to `maxConcurrent` sessions in a tight `while` loop, checking `wouldOverflowNow()` (623) before each launch. But cost is only recorded in `processArea` *after* a session finishes (line 423 `recordSessionCost(area.id, execResult.costUsd)`). At the start of an iteration `cost.spentUsd` is unchanged, so the governor green-lights all N concurrent launches before a single dollar is booked.
- **Root cause**: Spend is accounted post-hoc per completed session, but admission control reads only already-settled spend; there is no in-flight reservation.
- **Impact**: With the run-harness default `--concurrency 4` (run-harness.ts:198) and 30-min sessions averaging ~$0.50+ each, a near-cap budget can be exceeded by 3 full sessions (~$1.50+ and ~90 min of unbudgeted CLI work) before the pause fires. Defeats the point of a hard `budgetUsd` ceiling.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Reserve projected spend at launch time — add `avgSessionCost(cost)` (or `SESSION_COST_ESTIMATE_USD`) to a `cost.reservedUsd` when a session starts and release/reconcile it in `recordSessionCost`. Have `wouldOverflowNow()` factor in `reservedUsd × in-flight count`. Cheaper interim fix: clamp the per-iteration launch count so projected spend for the whole batch stays under the cap.

## 3. Visual gate re-spawns a full Playwright `npx` run + browser per area
- **Severity**: high
- **Lens**: performance
- **Category**: subprocess / orchestration cost
- **File**: src/lib/harness/visual-gate.ts:262-269 (regenerate spec + `npx playwright test`) called from verifier.ts:199 inside the per-area `verify()` loop
- **Scenario**: `verify()` runs for every area (orchestrator.ts:449, and again after self-heal at 478). When a visual gate is configured (WEBAPP_GATES, verifier.ts:179), each call rewrites an identical `_visual-gate.spec.ts` (visual-gate.ts:262) and shells out to `npx playwright test … --timeout=180000` (line 269), which cold-starts the Playwright runner, launches a browser, navigates `/`, and clicks through *every* registered module — regardless of which area changed.
- **Root cause**: The visual gate is full-suite and stateless per invocation; nothing scopes it to the touched module, caches the runner, or dedupes the generated spec.
- **Impact**: For a 50-area plan that's ~50–100 Playwright cold starts (`npx` resolution + browser boot ≈ several seconds each, plus the per-module walk), and a self-heal pass doubles it for failing areas. This is the dominant wall-clock and CPU cost of verification, mostly redundant re-screenshotting of unchanged modules.
- **Effort**: 5 · **Value**: 7
- **Fix sketch**: Write the spec once (skip rewrite when content is unchanged). Run Playwright directly via its programmatic API or a long-lived `playwright test --ui=false` worker instead of `npx` per area. Scope the gate to modules plausibly touched by the area (use `executeArea`'s `touchedUI` signal / `filesModified`) and only run the full sweep at end-of-run or on the integration-audit areas.

## 4. Uncleared fallback `setTimeout` kill-timers keep the event loop alive after every gate
- **Severity**: medium
- **Lens**: performance
- **Category**: timer cleanup
- **File**: src/lib/harness/verifier.ts:42-44 + src/lib/harness/visual-gate.ts:307
- **Scenario**: `runCommand` (verifier.ts:27) uses `exec` with its own `timeout` option, then *additionally* schedules `setTimeout(() => proc.kill('SIGTERM'), timeoutMs + 1000)` (line 42) that is never cleared after the command resolves. `runVisualGate` does the same with a 241s timer (visual-gate.ts:307). Every gate invocation registers a long-lived timer that survives until it fires.
- **Root cause**: Redundant belt-and-suspenders kill timer that is never `clearTimeout`'d on the normal resolve path.
- **Impact**: For each area, every gate (build/lint/test) leaves a 121s+ pending timer, and each visual gate a 241s timer, pinning the Node event loop awake and holding a closure over the (already-dead) child process. Across an iteration's worth of gates this stacks up dozens of dangling timers and prevents the standalone `run-harness` process from exiting promptly. The `exec` `timeout` option already covers the actual kill, so the fallback is pure overhead.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Capture the handle (`const t = setTimeout(...)`) and `clearTimeout(t)` inside the `exec` callback before resolving — in both `runCommand` and `runVisualGate`. Or drop the manual timer entirely and rely on `exec`'s built-in `timeout` + `killSignal`.

## 5. `wireAreaDependencies` creates a dense all-areas-to-all-areas graph that over-serializes the auto plan
- **Severity**: medium
- **Lens**: both
- **Category**: dependency modeling / concurrency
- **File**: src/lib/harness/plan-builder.ts:403-428 (`wireAreaDependencies`) + 411-417 (cross-module fan-out)
- **Scenario**: For the auto-generated `buildGamePlan` path (25 modules, plan-builder.ts:438), `wireAreaDependencies` makes *every* area of module B depend on *every* area of each prerequisite module A (lines 414-417), then also chains siblings sequentially (419-423). A module with 2 areas depending on 3 prereq modules (each 2-3 areas) accumulates 6-9 dependency edges per area.
- **Root cause**: Module-level prerequisites are expanded to a full cartesian product of areas instead of a single representative/"last" area, and there is no de-duplication of transitively-implied edges.
- **Impact**: `pickNextAreas` (orchestrator.ts:266) requires *all* `dependsOn` to be resolved, so the dense graph forces near-sequential execution even when `maxConcurrent > 1` — the streaming pool rarely fills. It also bloats `game-plan.json` (re-serialized after every area, orchestrator.ts:682) with O(areas²) edge data. Confidence is slightly lower because the curated `--scenario` paths (config.areas) bypass this and set their own leaner deps.
- **Effort**: 4 · **Value**: 5
- **Fix sketch**: Depend only on the *last* area of each prerequisite module (the sibling chain already guarantees intra-module ordering), and drop edges already implied transitively. This shrinks the graph to roughly linear and lets independent module branches run concurrently.
