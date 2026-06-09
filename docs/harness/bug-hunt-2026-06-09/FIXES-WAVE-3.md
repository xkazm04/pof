# Bug Hunter Fix Wave 3 — Silent-failure safety gates

> 3 commits, 3 findings closed (1 critical, 1 high, 1 medium). Remaining silent-failure findings (self-heal-without-verify, item-produce success-theater, postArtifact fire-and-forget) deferred — see "Deferred".
> Baseline preserved: tsc 0→0 errors, eslint 0→0 errors. Related packaging + harness test files 42/42 + 30/30 pass.

## Theme

Gates and meters that report success without doing (or checking) the work: a cook that records a fake `0` size so the size budget never fires, a budget governor that never sees any spend, and a feature-matrix updater that emits "changed" events even when the write failed. Each fix makes the gate reflect reality — measure the fact, fail closed, or only signal on confirmed success.

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|--------|----------------|----------|-------|
| 1 | `cd1580f` | build-cook-packaging #1 | critical | `lib/packaging/cook-executor.ts`, `…/scheduled-build-runner.ts` |
| 2 | `edd8750` | harness-autonomous-builder #2 | high | `lib/harness/claude-session.ts`, `…/orchestrator.ts` |
| 3 | `2dd1e06` | ue5-bridge-live-sync #4 | medium | `lib/pof-bridge/verification-engine.ts` |

## What was fixed

1. **Cook records a fake `0` size** (`cd1580f`). `cookExecutor` hard-coded `sizeBytes: 0` on the `done` event (RunUAT never prints the size) and the execute route persisted it; `evaluateBuildSize` returns null for size ≤ 0, so the **entire size-budget gate** (regression, growth thresholds, 5 GB caps) silently never fired on real cooks, and trends/stats reflected only hand-entered builds. The `done` event now recursively sums the stage directory on disk and reports the **measured** byte count, or **`null`** when unmeasurable (never a placeholder `0`); the event type is `sizeBytes: number | null` and `insertBuild` already stores `null` as unknown.
2. **Budget governor is a no-op** (`edd8750`). `claude-session` only read `parsed.cost_usd`, but current CLIs emit `total_cost_usd`, so `costUsd` was always `undefined`; `recordSessionCost` then early-returned on a falsy cost, leaving `sessions = 0` / `spentUsd = 0`, so `avgSessionCost`/`budgetWouldOverflow` always returned `0`/`false` and an unattended run could blow far past `budgetUsd`. Now `claude-session` accepts `total_cost_usd ?? cost_usd`, and `recordSessionCost` **always counts the session**, charging the real cost or a fallback per-session estimate when none is reported, so the governor advances toward the cap (fail-closed).
3. **Feature-matrix events on failed write** (`2dd1e06`). `autoUpdateFeatureMatrix` POSTed the batch update but never inspected the returned `Result`, then unconditionally emitted `checklist.item.changed` events — so a failed write left listeners reflecting statuses the DB never recorded, and the next poll recomputed the same diff and re-fired the events (storm). The emit loop is now gated on `writeResult.ok`.

## Verification

| Gate | Result |
|------|--------|
| `tsc --noEmit` | 0 errors (caught + fixed a `number \| null` ripple into `scheduled-build-runner.ts`) |
| `eslint` (changed files) | 0 errors |
| Related tests (cook-executor, packaging-execute, size-budgets, scheduled-build-runner, claude-session) | all pass |

## Deferred (not done this wave)

- **harness-autonomous-builder #3 — self-heal reports "healed" without verifying (high).** The correct fix is a tri-state (`healed | unverified | failed`) return from `attemptSelfHeal` that ripples through the harness re-verify control flow; deferred to avoid a control-flow change in the autonomous builder I can't validate end-to-end (same conservative call as the Wave-4 lifecycle deferral).
- **item-pipeline-steps #4 (produce success-theater)** and **layout-lab `postArtifact` fire-and-forget** — React/data-flow surfaces better exercised against the running app.

## Cumulative status (across waves so far)

| Wave | Theme | Closed | Crit | High |
|------|-------|-------:|-----:|-----:|
| 1 | Trust-boundary input validation | 7 | 3 | 4 |
| 6 | Security hardening | 2 | 2 | 0 |
| 4 | Shared-singleton concurrency | 3 | 3 | 0 |
| 2 | Atomicity & write races | 3 | 3 | 0 |
| 5 | UE5 codegen correctness | 3 | 1 | 2 |
| 3 | Silent-failure safety gates | 3 | 1 | 1 |
| **Total** | | **21 / 140** | **13 / 18** | **7 / 70** |

## Patterns established (catalogue items 16–18)

16. **A placeholder must never masquerade as a measurement.** When a value can't be obtained, emit `null`/unknown — not `0`. Downstream gates that special-case `0`/empty (a size budget, a rate) silently die when fed a fake zero, and stats that filter `IS NOT NULL` quietly exclude it.
17. **A safety rail must fail closed.** A budget/quota that depends on an external signal (cost reporting) must keep advancing when the signal is absent — count the work and charge an estimate — rather than treating "no signal" as "no spend". The most common output shape is exactly where a fail-open rail dies.
18. **Inspect the result of any write you act on.** Fire-and-forget is only safe when you genuinely don't care it failed. For a gate or an event emission, branch on success — an ignored failed write produces success theater and, on a polling loop, an event storm.

## What remains

21 of 140 closed; 13 of 18 criticals. Remaining criticals (5): combat armor squared (logic), crash-analysis substring (logic), item double-produce (race), AI-testing FK cascade (schema), project-health timestamp (data-loss) — across Wave 7 (determinism / timestamps / stale closures) and scattered logic findings. Plus the deferred highs from Waves 2/3/4/5.
