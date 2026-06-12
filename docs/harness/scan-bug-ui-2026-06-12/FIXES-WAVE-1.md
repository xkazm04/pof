# Bug+UI Scan Fix Wave 1 — CLI process lifecycle & abort theater

> 6 commits, 6 findings closed (1 Critical, 4 High, 1 Medium).
> Baseline preserved: tsc 0 src errors → 0; eslint (changed files) 0 → 0; tests **3925 pass / 15 fail / 1 skip** — every failure pre-existing (see Verification).

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|---|---|---|---|
| 1 | `9405a78` | cli-terminal-task-system #1 — null taskId latches `session.isRunning` forever | **Critical** | `useTaskQueue.ts`, `InlineTerminal.tsx` |
| 2 | `5361fda` | cli-terminal-task-system #2 — abort is a no-op on Windows (kills cmd.exe only) | High | `process-tree-kill.ts` (new), `cli-service.ts` |
| 3 | `d13e094` | quality-evaluation-engine #1 — batch-review abort/timeout never kills the CLI | High | `batch-review/route.ts` |
| 4 | `53b53dd` | build-cook-packaging #1 — cook abort orphans the UAT tree, misrecords `failed` | High | `cook-executor.ts`, `packaging/execute/route.ts` |
| 5 | `3c6fef8` | ue5-bridge-live-sync #1 — build abort leaves MSBuild/cl.exe grandchildren | Medium | `build-pipeline.ts` |
| 6 | `19d348a` | ai-testing-localization #1 — CLI round-trip never closes (dead statuses/pass-rate) | High | `ai-testing/route.ts`, `prompts/ai-testing.ts`, `cli-task.ts`, `AIBehaviorView.tsx` |

## What was fixed (one mental model: spawn → track → complete/abort, truthfully)

1. **The isRunning latch (Critical).** Every live run goes through `submitPrompt` with a null taskId, and all four completion handlers gated `onTaskComplete` on that id — so the completion signal never fired; `session.isRunning` latched true after the first prompt, wedging checklist completion, analytics, SuggestedActions, and every isRunning-gated button until refresh. The shell-restore commit 38924cd had also reduced InlineTerminal's `onStreamingChange` to a true-only gate, removing the last release path. Fix: `onTaskComplete` always fires with a sentinel `'interactive'` id (result/error/onerror/abort/START_FAILED), `registerTaskComplete` stays id-gated, and the streaming=false pass-through is restored.

2. **Windows tree-kill (3 sites, 1 helper).** `ChildProcess.kill()` is TerminateProcess on the tracked PID only — with `shell:true` (claude.cmd), a cmd.exe wrapper (RunUAT), or a launcher (UBT), the real workers are grandchildren and survive: "aborted" claude runs kept editing files and billing tokens; orphaned cooks held staging locks; orphaned cl.exe held .obj/PDB locks and wedged the build queue. New `src/lib/process-tree-kill.ts` (`taskkill /PID <pid> /T /F`, POSIX fallback) adopted in `abortExecution` + the CLI timeout, the cook abort listener, and all three UBT kill sites. Cook aborts now also record `status: 'cancelled'` (supported by BuildRecord since its creation but never written) instead of polluting failure stats.

3. **Abort theater in batch review.** `waitForExecution` stopped *waiting* on abort/timeout but never stopped the *work* — the orphaned review ran to completion, billed, and discarded its callback. Both paths now call `abortExecution` (which now tree-kills).

4. **The AI-testing round-trip.** Run Tests / Auto-detect dispatched prompts into the void — nothing wrote results back, so the 6-state status model, pass-rate ring, and Last Run Output panel were unreachable. Wired via the standard `@@CALLBACK` pattern: new `run-ai-tests` / `detect-stimuli` CLITask types + two POST actions on `/api/ai-testing` (`record-run-results`, `apply-stimuli`); dispatch marks scenarios `running`, the callback persists outcomes, `onComplete` refetches and error-resets still-running scenarios. (This fix *depends on* fix #1 — `onComplete` only fires now.)

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors in `src/` (4 pre-existing errors in generated `.next/dev/types/` only) |
| `eslint` (all 12 changed files) | 0 problems |
| `vitest run` (full suite) | **3925 pass / 15 fail / 1 skip** — all 15 pre-existing: 1× `leonardo-client` (user's uncommitted `leonardo.ts` edit, flagged by the scan), 1× `ChartPanel` jsdom flake (known since 06-09), 13× `ueStaticCheckers`/catalog-pipelines (fs/path test-env issue, present at scan baseline) |

**Environment note:** the scan-time baseline (3830 pass / 40 fail) was poisoned by a `better-sqlite3` NODE_MODULE_VERSION mismatch (Node upgraded since the module was built; ERR_DLOPEN_FAILED in ~26 tests). `npm rebuild better-sqlite3` during this wave restored the suite to the 06-09-comparable level. No code change involved.

## Cumulative status (this scan)

| Wave | Theme | Closed | Crit |
|---|---|---:|---:|
| 1 | CLI process lifecycle & abort theater | 6 | 1 |
| **Total** | | **6 / 323** | **1 / 1 (100%)** |

## Patterns established (catalogue items 26–30, continuing the 06-09 numbering)

26. **Stopping the observer is not stopping the work.** Unsubscribing, closing an SSE stream, or timing out a wait leaves the spawned process running. Every abort/timeout path must invoke the kill primitive on the execution itself — then report the state truthfully.
27. **On Windows, `ChildProcess.kill()` never cascades.** Any spawn through `shell:true`, a `.cmd` shim, or a launcher (RunUAT/UBT) tracks a wrapper PID; the real workers survive a plain kill. Use `killProcessTree()` (`src/lib/process-tree-kill.ts`) at every kill site.
28. **Never gate a latch-releasing callback on an optional correlation id.** If `onTaskComplete` releases `isRunning`, it must fire on every terminal path — use a sentinel id (`'interactive'`) when no queued-task id exists.
29. **A dispatched prompt whose results the UI claims to track needs a consumer.** Status pills, pass-rate rings, and "last run" panels are lies unless the prompt registers a `@@CALLBACK` and an API action persists the payload — and optimistic `running` states need a failure-reset in `onComplete`.
30. **Check ERR_DLOPEN_FAILED before chasing test regressions.** A native-module/Node version mismatch (better-sqlite3) turned 26 unrelated tests red and looked exactly like a code regression; `npm rebuild` fixes it.

## What remains

322 → 317 open findings in the INDEX. Next suggested wave: **B — Fix-the-fixes** (7 regression-tail items from the 06-09 fix waves: whole-word keyword matching, ArchetypeStep stale closure, /sweep clamp gap, dead Auto-Verify, dirty-baseline rollback, inert timestamp defaults, quality-star clamp). After that: D — destructive-write data loss (6).
