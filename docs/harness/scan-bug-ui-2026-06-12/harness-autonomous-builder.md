# Harness Autonomous Builder — Bug + UI scan (2026-06-12)

> Total: 5 findings (5 bug, 0 ui)

## Bug findings (new since 2026-06-09)

## 1. Every pause path falls through to the "completed" epilogue — paused runs are persisted and reported as completed, and the resume API is bricked
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/harness/orchestrator.ts:749` (pause break), `src/lib/harness/orchestrator.ts:824-830` (unconditional completed epilogue), `src/app/api/harness/route.ts:190-192, 227-230`
- **Scenario**: A user POSTs `{action:'pause'}` (or the edd8750 budget governor fires `harness:paused`). `runLoop` hits `if (paused)`, emits `harness:paused`, calls `persistTerminal('paused')`, and `break`s — but the cleanup code after the loop runs unconditionally: it emits `harness:completed` and, because `runId` was not nulled in the pause branch, calls `persistTerminal('completed')`, overwriting the just-written `paused` row in `harness_runs`.
- **Root cause**: The post-loop epilogue assumes the only way out of the `while` loop is natural completion. The pause branch breaks out without returning or marking the run as non-terminal, so a paused run is laundered into a completed one. (Natural completion also double-emits `harness:completed`.)
- **Impact**: Triple failure: (1) the run history DB records a budget-capped or user-paused run as `completed` — the budget governor's firing is invisible in history, defeating the point of edd8750; (2) the API route's event listener maps the trailing `harness:completed` to `harnessStatus='completed'`, so `POST {action:'resume'}` returns 409 "Harness is not paused" forever — pause permanently bricks resume; (3) the CLI prints the celebratory `COMPLETED — x/y features passing` banner on Ctrl+C.
- **Fix sketch**: In the pause branch, `return guide;` (after killDevServer/savePlan/saveGuide via a small shared cleanup helper) instead of `break` — or guard the epilogue with `if (!paused)`. Only null `runId` and emit `harness:completed` when the run actually completed.

## 2. `fillPool` ignores `paused` — a user pause can launch brand-new sessions, then the pool abandons all in-flight sessions without awaiting or killing them
- **Severity**: High
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/lib/harness/orchestrator.ts:614-639` (fillPool — no `paused` check), `src/lib/harness/orchestrator.ts:644-645` (abandon on break)
- **Scenario**: With `maxConcurrent: 4`, the user pauses while sessions are running. The pool is mid-`Promise.race`; when the next area finishes, the loop body processes it and calls `fillPool()` (line 686), which only checks `wouldOverflowNow()` — not `paused` — and launches replacement 30-minute `claude -p` sessions. Only then does the loop top see `paused` and `break`, returning from `runStreamingPool` with up to `maxConcurrent` live sessions still in `active`. The same abandonment happens on budget pause.
- **Root cause**: `paused` is only consulted at the top of the pool loop; nothing drains or cancels `active` on exit. The orphaned `processArea` promises keep running to completion minutes after the run was finalized: they write `progress.json`, `cost.json`, and `guide.json` *after* `persistTerminal` snapshotted the run, and their in-memory `area.status='completed'` mutations are never `savePlan`'d — the on-disk plan strands those areas as `in-progress`, which `pickNextAreas` (pending-only) will never pick up again.
- **Impact**: Pausing spends *more* money (fresh sessions launched post-pause); the terminal DB snapshot is stale versus the state files; stranded `in-progress` areas make the target pass rate unreachable on resume; and because finding 1 flips status to `completed`, a user can `start` again while orphaned sessions are still editing the same working tree — concurrent writers, corrupted output.
- **Fix sketch**: Check `paused` at the top of `fillPool`'s while loop. On pool exit, `await Promise.allSettled(active.values())` (or signal sessions to abort via SIGTERM) before returning, then `savePlan`. On plan load, reset `in-progress` areas back to `pending`.

## 3. Checkpoint baseline anchors at HEAD, not the dirty tree — first rollback still wipes the user's pre-run uncommitted changes even in sequential mode (residual gap of 73a447a)
- **Severity**: High
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/lib/harness/orchestrator.ts:392-402, 656-672` (rollbackBeforePromote), `src/lib/harness/checkpoint.ts:143-163, 191-197` (init baseline + reset)
- **Scenario**: User starts a checkpoint run on a repo with uncommitted modifications to tracked files (work in progress, local config tweaks). `Checkpointer.init()` records `rev-parse HEAD` as the baseline green checkpoint — a commit that does *not* contain those modifications. The first processed area exhausts its retries before any area has gone green, so `rollbackBeforePromote` → `git reset --hard <HEAD>` discards every uncommitted tracked-file change the user had when they started.
- **Root cause**: Commit 73a447a fixed the *concurrency* half of the 2026-06-09 critical (sequential is now forced when `checkpoint===true`), but the baseline is still a SHA the working tree never matched. The first `commitArea` would have captured the dirty state (`git add -A`), but the rollback window between `init()` and the first green checkpoint is unprotected. Secondary: `init()` runs `git checkout -B harness/<runId>` and nothing ever restores the user's original branch when the run ends.
- **Impact**: Silent, unrecoverable loss of the user's pre-run uncommitted work (tracked files) in fully sequential, "fixed" checkpoint mode — plus the repo is left sitting on the `harness/<runId>` branch after every run.
- **Fix sketch**: In `init()`, if `git status --porcelain` is non-empty, commit the dirty tree as the baseline checkpoint (`add -A` + commit on the harness branch) instead of recording bare HEAD — or refuse to enable checkpointing on a dirty tree with an explicit event. Restore the original branch in run cleanup.

## 4. Cost ledger is never reset — a fresh run inherits the lifetime spend of its statePath, so the budget governor fires on day one (activated by edd8750)
- **Severity**: Medium
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/lib/harness/orchestrator.ts:73-76, 358, 848` (loadCost on every start), `src/lib/harness/orchestrator.ts:379-385` (always-accumulate recordSessionCost)
- **Scenario**: A run spends $18 (real or `$0.50/session` estimates) into `<project>/.harness/cost.json`. Days later the user deletes `game-plan.json` (or POSTs `start` for a new run with `budgetUsd: 20`). `start()` does `cost = loadCost(...)` — `spentUsd` resumes at $18, so the governor sees $2 of headroom and pauses (then, via finding 1, reports "completed") after a couple of sessions. `byArea` also keeps accumulating across runs, and `startRun` stores the inherited historical spend as the *new* run's opening cost.
- **Root cause**: `cost.json` persistence was designed for pause/resume restart-safety, but `start()` (a new `runId`, a new DB row) loads it identically to `resume()`, and nothing distinguishes "this run's spend" from "this directory's lifetime spend". Before edd8750 this was unreachable — `cost_usd` never parsed, so `spentUsd` was permanently 0; the fix that made every session count activated the stale-ledger path. New-bug-via-recent-fix.
- **Impact**: Wrong budget accounting: fresh runs can be immediately throttled or blocked by spend from previous runs; per-run cost reporting in `harness_runs` and the guide's Cost section misattributes historical spend to the current run.
- **Fix sketch**: Stamp `runId` into `cost.json`; in `start()` (new runId minted) reset totals to `emptyCost(budgetUsd)` and only inherit the ledger in `resume()` / when the stored runId matches. Keep a separate `lifetimeUsd` field if cross-run totals are wanted.

## 5. An exception inside `processArea` bypasses retry accounting — the pool respawns the same area in a tight loop, spending a session per spin
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/harness/orchestrator.ts:636` (`.catch(() => ({ result: 'failed' }))`), `src/lib/harness/orchestrator.ts:278-280, 652-655` (retry counter from progress entries)
- **Scenario**: `processArea` throws *after* the executor session but before its progress entry lands — e.g. `appendProgressEntry`/`saveGuide` → `writeJsonFile` throws `EBUSY/EPERM` because progress.json/guide.md is locked by an editor or AV scanner on Windows, or the disk is full. The `.catch` maps the throw to `result:'failed'` without appending any progress entry, so `getRetryCount` (which counts non-success *progress entries*) stays at its old value. `retries < maxRetries` resets the area to `pending`, `fillPool` re-picks it immediately, a new full `claude -p` session is spawned, and the same throw repeats — forever within one iteration, never reaching the `maxIterations` backstop.
- **Root cause**: Retry exhaustion is keyed solely off persisted progress entries, but the exception path is exactly the path where persisting fails. The error is swallowed to a bare `'failed'` with no record, so the loop's own bookkeeping can't see the repetition.
- **Impact**: Unbounded session spawning and API spend on a persistent local fault (with no `budgetUsd` set there is no ceiling at all; with one, money still burns until the estimate-based cap trips); the underlying error is never surfaced to the user.
- **Fix sketch**: In the `.catch`, capture the error, emit `harness:error`, and append a synthetic failure entry (or keep an in-memory `failuresByArea` counter merged into `getRetryCount`) so retries always advance. Treat N consecutive exceptions for one area as retry exhaustion.

## UI findings

No UI findings — the audit scope for this context contains no React components (all twelve files are Node-side harness libraries, data catalogs, and one JSON API route handler at `src/app/api/harness/route.ts`). The harness front-end components live outside this context's scope and were not audited here.
