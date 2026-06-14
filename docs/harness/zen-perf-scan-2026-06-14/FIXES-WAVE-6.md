# Zen-Perf Fix Wave 6 — Resource Leaks / Lifecycle

> 6 commits, 6 findings closed. Theme: bound unbounded growth, clean up on all paths,
> and stop redundant cold-starts/DDL — adding cleanup/eviction/guards without changing behavior.
> Baseline preserved: tsc 0→0; tests 15 fail / 3946 pass (identical); 0 lint errors.

## Commits

| # | Commit | Finding | File(s) |
|---|---|---|---|
| 1 | `9b76b64` | #54 (ctx 12) | visual-gen/asset-forge/useForgeStore.ts |
| 2 | `73fb0eb` | #55 (ctx 15) | test-gate-runner/worker.ts |
| 3 | `4426793` | #56 (ctx 27) | claude-terminal/cli-service.ts |
| 4 | `9efb41d` | #57 (ctx 33) | harness/orchestrator.ts |
| 5 | `96f8e6a` | #58 (ctx 33) | harness/visual-gate.ts |
| 6 | `c94a6e8` | #59 (ctx 18) | error-memory-db.ts, pattern-library-db.ts |

## What was fixed

1. **Forge poll overlap + state race (#54).** `setInterval` with an async body let a slow status fetch overlap the next tick, and the timer was cleared only after a long `/import` await — so a completed job's late poll could flip `importing` back to `generating`. Replaced with a self-scheduling `setTimeout` recursion (next poll only after the current settles) + a `stopped` flag checked after every await; `stop()` clears the pending timer before the import await. Same endpoints/interval/failure handling. 15 tests.
2. **Drain cooldown map eviction (#55).** `cooldownUntil` grew unbounded. Added a sweep at the top of each drain tick deleting entries with `until <= now`. Gating semantics unchanged (the eligibility check already treats missing == expired; active cooldowns untouched).
3. **CLI execution map + stdout duplication (#56).** The module-global `activeExecutions` map grew unbounded — `cleanupExecutions()` was defined but never called; wired it into `startExecution` (prunes only non-running, aged entries). Also stopped retaining each raw stdout chunk in `execution.events` (it duplicated the whole stdout stream in memory); stdout is still delivered live to `onEvent`/listeners, and every `events` consumer already skips `stdout`. 34 tests.
4. **Harness dev-server leak + Windows kill (#57).** Teardown happened only on the happy path (leaked on every error/crash), and `shell:true` made `.kill()` orphan the real `next dev` node holding port 3000. Moved teardown into a `finally` wrapping the loop; `killDevServer` now tree-kills (`taskkill /pid <pid> /T /F` on win32, `process.kill(-pid)` on a detached group elsewhere). Same command/args (array — no injection)/cwd/env + same readiness detection. 64 tests.
5. **Visual-gate in-flight de-dupe (#58).** The gate spawned a full `npx playwright test` + browser per area inside the per-area verify loop, though the suite is identical for every area in an iteration. Concurrent area verifications now share one in-flight run keyed on `(statePath, iteration)`. **Hardened beyond the initial pass:** the shared promise is dropped on settle — a pure in-flight de-dupe, NOT a result cache — so a self-heal re-verify in the same iteration starts a fresh run and can't read a stale pre-heal result. Per-area results unchanged. 69 tests.
6. **Bootstrap-once DDL guard (#59).** `ensureErrorMemoryTable`/`ensurePatternLibraryTable`/`ensureAntiPatternTable` re-issued full DDL (CREATE + PRAGMA + ALTER probes + CREATE INDEX) at the top of every read — and `checkPromptForAntiPatterns` is on the prompt-dispatch hot path. Guarded each with a module-level `bootstrapped` flag: DDL runs once per process, first-call bootstrap unchanged. ~3 / ~11 / 2 DDL statements per read → 0 after first use. 7 tests.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3946 pass — identical to baseline (no regressions) |
| ESLint (7 changed files) | 0 errors, 0 warnings |

## Patterns established (catalogue, items 16–20)

16. **Defined-but-never-called cleanup** — an eviction/`cleanupX()` helper exists but is wired to nothing, so a map/buffer grows unbounded. Grep for the helper's call sites; if zero, wire it at a natural cadence (on start/completion), using it as written.
17. **Unbounded keyed map without eviction** — a Map keyed by transient ids never evicts. Evict on expiry/read or sweep per pass; preserve gating semantics (treat missing == expired so dropping stale keys is a no-op).
18. **`setInterval` with an async body** — overlapping in-flight work + the timer cleared only after a long trailing await. Use a self-scheduling `setTimeout` (next tick scheduled after the current settles) + a `stopped` flag checked post-await; clear the timer before long awaits.
19. **Subprocess cleanup on all paths + tree-kill** — spawn teardown only on the happy path leaks on every error (use `finally`); `shell:true` makes `.kill()` hit the shell wrapper and orphan the real child (tree-kill: `taskkill /T` on win32, detached + `process.kill(-pid)` on POSIX). Keep args as an array to avoid injection.
20. **In-flight de-dupe vs result cache** — to coalesce concurrent identical work, share the in-flight promise but DROP it on settle. Persisting the *resolved* result turns it into a cache that can serve stale data to a later (sequential) caller — fine only if the value is truly immutable for the key's lifetime.

(Plus reinforces item 21-style **bootstrap-once guard**: idempotent DDL called per-read → module-level `bootstrapped` flag, first-call correctness preserved.)

## Cumulative status (waves 1–4, 6)

| Wave | Theme | Findings closed |
|---|---|---|
| 1 | Dead code purge + dormant-feature activation | 8 |
| 2 | DB N+1 / over-fetch (server-side) | 6 |
| 3 | Algorithmic hot loops | 7 (+#37 by deletion) |
| 4 | React re-renders (batch 1) | 6 (#3 reverted/deferred) |
| 6 | Resource leaks / lifecycle | 6 |

**Total closed: 33 / 176.** Remaining: ~143.

## What remains
- **Wave 5 (re-render batch 2):** #2 (search debounce), #4 (loot live-preview pagination), #6 (map/topology SVG memo), #9 (Baseline steps memo-bust), #10 (HolisticHealthView unstable-effect re-POST), #13 (ws-live-state unconditional store writes); plus deferred **#3 inventory** (cardRefs-owner refactor) and the **#12 follow-on** (CLITabBar/CLIBottomPanel).
- **Wave 7 (correctness + diverged-logic):** #14 triplicated damage formula, #45 blueprint exec-edge, #66 GDD shared-singleton, duplicate regression alerts.
- Mediums/lows (~120) across all themes, opportunistically.
