# Bug Hunt — Build, Cook & Packaging
> Total: 4
> Severity: 1 critical, 2 high, 1 medium

## 1. Cook always records `sizeBytes: 0` — size budgets, trends, and stats are permanently blind
- **Severity**: critical
- **Category**: silent-failure
- **File**: src/lib/packaging/cook-executor.ts:135 (and src/app/api/packaging/execute/route.ts:70)
- **Scenario**: Any real cook runs to completion via `cookExecutor`. The `done` event is hard-coded to `sizeBytes: 0` because RunUAT's stdout never prints the staged output size and nothing ever `stat`s the stage directory. The execute route then persists that `0` straight into `build_history.size_bytes`.
- **Root cause**: The design assumes the cook stream can supply the package size, but `cookExecutor` has no filesystem step to measure the staged build, so it emits a placeholder `0` that the rest of the system treats as a real measurement. `evaluateBuildSize` (size-budgets.ts:97) returns `null` for `sizeBytes <= 0`, so the entire size-budget gate (`failOnRegression`, growth thresholds, the 5 GB caps) silently never fires for builds produced by the actual pipeline. Only manually-recorded builds (BuildHistoryDashboard form) carry a real size.
- **Impact**: Data loss + UX degradation: the headline size-regression guardrail is dead on real cooks; `getBuildStats` skips `size_bytes IS NOT NULL` rows so avg/latest size and the SizeTrendChart are computed only from hand-entered records, silently misrepresenting "the cook produced a 0-byte build" as success. A genuinely bloated cook ships with no warning.
- **Fix sketch**: Make size a measured fact, not a stream guess: after exit code 0, recursively sum the stage directory (`stageDir`) on disk and put that byte count in the `done` event; if the dir is unresolved, emit `sizeBytes: null` (not `0`) and have `evaluateBuildSize`/stats treat `null` as "unknown" rather than "zero". Never let a placeholder masquerade as a measurement.

## 2. WITH_EDITOR audit mis-tracks `#else`/`#if !WITH_EDITOR` — editor-only code slips into Shipping while the gate shows green
- **Severity**: high
- **Category**: silent-failure
- **File**: src/lib/packaging/preflight.ts:194-205
- **Scenario**: A plugin Runtime module contains either `#if WITH_EDITOR ... #else <editor-only call here> #endif` or `#if !WITH_EDITOR <editor-only call here> #else ... #endif`. The auditor pushes `editorGuard.test(...)` onto the stack at the `#if` and does nothing on `#else`/`#elif`, so the guard boolean never flips for the alternate branch.
- **Root cause**: The scanner models "am I under a WITH_EDITOR guard?" as a single boolean per `#if` level, but a guard's truth value inverts across `#else` and the condition can be negated (`!WITH_EDITOR`, `#if !WITH_EDITOR`). Because `editorGuard` (`/^#if\s+(?:.*\b)?(WITH_EDITOR...)/`) matches `#if !WITH_EDITOR` too, that block is wrongly marked "guarded," and the `#else` branch keeps the stale parent boolean. Both cases produce false negatives: the unguarded editor-only API in the non-editor branch is never flagged.
- **Impact**: Crash/build-break with success theater: preflight returns `with-editor-audit: pass`, the operator proceeds, and the Shipping cook fails 20+ minutes in on an unresolved editor symbol — exactly the SP-C failure class the check exists to prevent.
- **Fix sketch**: Track each `#if` frame as `{ raw, active }` and recompute `active` on `#else`/`#elif` (flip/replace the branch's guard truth); treat `!WITH_EDITOR` as *not* an editor guard rather than letting `.*\b` swallow the negation. Better: tokenize the preprocessor condition into a small boolean expression instead of regex-sniffing the line.

## 3. `attachSmokeResultToLatestBuild` overwrites `notes`, clobbering the size-budget regression note
- **Severity**: high
- **Category**: data-loss
- **File**: src/lib/packaging/build-history-store.ts:169
- **Scenario**: A nightly/scheduled build records a successful cook, the size-budget evaluator writes a `[SIZE_BUDGET] … grew 14% vs last green` note onto that row, then the post-cook smoke-test runs and calls `attachSmokeResultToLatestBuild`, which does `UPDATE build_history SET notes = ?` with only the smoke-test string.
- **Root cause**: The function assumes `notes` is its own private field, but `notes` is a shared column already used by the size-budget pipeline (`SIZE_REGRESSION_NOTE_PREFIX`, surfaced by `hasSizeRegressionNote`/`extractRegressionNote`). A blind overwrite discards whatever was there. Compounding it, "latest success for platform+config" is a heuristic for "the build I just verified" that breaks if two cooks of the same profile finish close together — the smoke note can land on the wrong build.
- **Impact**: Data loss: the size-regression warning vanishes from history, so `hasSizeRegressionNote` later reports clean and the operator never sees the bloat alert that was correctly detected. Under concurrent same-profile cooks, the note attaches to the wrong row.
- **Fix sketch**: Append to `notes` (read-modify-write, newline-join, dedupe by prefix) instead of replacing, and target the specific build id the cook produced (thread the inserted build id through the cook→smoke flow) rather than re-querying "latest success."

## 4. Smoke-test reports `pass` when a *different, pre-existing* game process is already running
- **Severity**: medium
- **Category**: logic-error
- **File**: src/lib/packaging/smoke-test.ts:125-129
- **Scenario**: The bootstrap exe fails to actually start the game (bad cook, missing content), but an instance of the same image (`PoF-Win64-Shipping.exe`) from a prior manual launch — or from a previous smoke-test that `killImage` failed to fully reap — is still running. After the observe window, `tasklist(gameImage)` finds *that* unrelated process and returns `gameAlive: true`.
- **Root cause**: Liveness is keyed only on image *name*, not on the PID actually launched. The code captures `child.pid` but checks survival by image substring, so any same-named process (stale instance, a second concurrent smoke-test, the player's own copy) satisfies the "it runs" assertion. The cleanup then `killImage(gameImage)` blows away that innocent bystander too.
- **Impact**: Success theater (a broken build passes the only "it actually runs" gate) plus collateral process kill of an unrelated running game instance.
- **Fix sketch**: Resolve the game PID from the launched bootstrap's process tree (or correlate by creation time / parent PID) and check *that* PID's liveness; scope the kill to the spawned tree (`killPid`/taskkill `/PID … /T`) rather than `/IM <image>`. Make the assertion "the process I started is alive," never "some process with this name is alive."
