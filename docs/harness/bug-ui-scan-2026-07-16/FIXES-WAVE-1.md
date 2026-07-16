# Bug+UI Scan Fix Wave 1 — Concurrency Criticals

> 3 commits, 3 Critical findings closed.
> Baseline preserved: tsc 0 → 0 errors; vitest 4456 passed / 1 pre-existing fail → (see verification table).

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|---|---|---|---|
| 1 | `e1657869` fix(combat-sim): guard concurrent simulation runs with a run token | combat-damage-tuning #1 | Critical | src/stores/combatSimulatorStore.ts |
| 2 | `5eaf1f62` fix(project-setup): generation-guard overlapping useProjectScan runs | project-setup-onboarding #1 | Critical | src/components/modules/project-setup/useProjectScan.ts |
| 3 | `fe153ffb` fix(cli-tasks): kill the orphaned CLI process during 409 conflict recovery | cli-terminal-task-system #1 | Critical | src/types/cli-task-registry.ts, src/app/api/cli-task-registry/route.ts, src/components/cli/taskRegistry.ts, src/components/cli/useTaskQueue.ts, + 1 test mock |

## What was fixed

1. **Combat simulator last-write-wins race.** Both `runSimulation` and `runSimulationStreaming` now capture a monotonic module-level `simRunCounter` token at start; only the newest run may commit progress frames, final results, or errors to the shared zustand fields. A superseded run resolves `null` without touching the store, so an older slower run can no longer overwrite a newer run's Monte-Carlo output.

2. **`useProjectScan` re-entrancy.** `scan()` is reachable from four overlapping triggers (path-change effect, manual re-scan, three CLI `onComplete` callbacks). A `scanGeneration` ref now guards every state commit point (`setEngines`, `setChecklist`, `setProjectFiles`, the terminal `settled` transition); superseded scans early-return, so the checklist — and the NextStepBanner CTA derived from it — always reflects the newest scan.

3. **CLI 409 conflict recovery orphaned the real process.** Two compounding gaps: (a) `registerTaskStart` used `apiFetch`, which throws away the 409 response's `details.runningTask` — the recovery branch could literally never see the conflicting record (dead code); (b) the registry had no link from a task to its claude-terminal execution, so nothing could kill the process. Fixed by returning the 409 payload via raw fetch, adding `TaskRecord.executionId` + an `attach-execution` registry action (populated fire-and-forget by `executeTask` after the query POST), and best-effort `DELETE`-ing the orphan execution before force-completing the row.

## Verification

| Gate | Baseline (pre-scan) | After Wave 1 |
|---|---|---|
| `tsc --noEmit` | 0 errors | 0 errors |
| `vitest run` | 4456 passed / 1 failed (LayoutLab.navigation, pre-existing) / 5 skipped | 4456 passed / 1 failed (same pre-existing) / 5 skipped — **0 regressions** |

## Patterns established (catalogue items 1–3)

1. **Module-level run-token for zustand async actions** — when an async store action streams into shared fields, capture `++counter` at entry and gate every `set()` (including the catch path) on `token === counter`. Disabled-button UI state alone cannot prevent overlap (click-to-rerender gap).
2. **Generation ref for multi-trigger hooks** — a `useCallback` async fn invoked from N independent triggers needs a `useRef(0)` generation captured at entry, checked before each `setState` batch. Guarding only the terminal commit is not enough if intermediate commits (e.g. `setEngines`) also write shared UI state.
3. **Force-fail must kill, not just mark** — any "conflict recovery" that flips a DB/registry row to failed must also terminate the live resource behind it (process, socket, subscription), which requires the registry to record the resource handle at start/attach time. Also: `apiFetch`-style throw-on-error helpers silently discard structured error payloads (409 details) — recovery flows need the raw response.

## What remains

Wave 2 (next): the other 6 Criticals — Item Pipeline hard-coded PASS gate, Deep Eval cancel corrupting the regression baseline, World zone wrong-target fallback + empty-catalog crash (2 findings, same file), Blueprint write-diff mismatch, Animation state-machine zero-state crash. Then Waves 3–6 per INDEX.md.
