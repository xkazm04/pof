# Bug+UI Scan Fix Wave 2 — Success Theater, Wrong-Target & Crash Criticals

> 5 commits, 6 Critical findings closed (2 share one commit — same file/root data gap).
> All 9 Criticals from the scan are now closed (Waves 1+2).

## Commits

| # | Commit | Finding(s) closed | Severity | Files |
|---|---|---|---|---|
| 1 | `005128b6` fix(world): no arbitrary zone fallback + no crash on empty zone catalog | world-quests-procgen #1 + #2 | Critical ×2 | sub_world/index.tsx |
| 2 | `e17635cb` fix(blueprint-transpiler): write exactly what was reviewed in the dry-run diff | blueprint-transpiler-c-codegen #1 | Critical | WriteToProjectButton.tsx |
| 3 | `913b5c27` fix(animations): state-machine codegen survives an empty state list | animation-rigging #1 | Critical | StateMachineEditor/* (6 files) |
| 4 | `5bafe3f1` fix(item-pipeline): Test Gate verdict derived from upstream acceptance | item-pipeline-steps #1 | Critical | itemsSteps.ts, ItemGate.tsx, StaticStepFrame.tsx, useEntityArtifacts.ts, useBaseline.ts |
| 5 | `a0213071` fix(evaluator): honest modulesEvaluated on cancelled deep eval + regression pin | quality-evaluation-engine #1 (partially stale) | Critical | deep-eval-engine.ts + new test |

## What was fixed

1. **World zone wrong-target + crash** (Fable agent). `primaryEntry` no longer falls back to `zoneEntries[0]`; a `ZoneLifecycleBar` extraction makes the `useGeneration` hook receive only a guaranteed entry (hook-order safe). Missing-entry → inline "Not in catalog yet — generation unavailable" notice, no Regenerate button; empty catalog → centered `role=status` panel following the ChartEmptyState pattern.

2. **Blueprint stale-diff write** (Fable agent). `dryRun` snapshots `{header, source, className, moduleName}` with the plan; `confirmWrite` sends only the snapshot. Live-prop divergence while the modal is open shows an amber "code changed since this diff was computed" banner with one-click Refresh-diff; confirm disabled until refreshed.

3. **Animation state-machine zero-state crash** (Fable agent). All four codegen generators early-return a commented stub on `states=[]`. Editor gets a first-class empty model: Export/View Code/Blender NLA disabled with tooltips, centered canvas empty state with inline Add State CTA, honest "No states" line in Priority Cascade. Full deletion stays allowed — fits the free-form editor model.

4. **Item Pipeline Test Gate success theater** (orchestrator). `produce()` no longer fabricates `pass: true` — it records only that the test ran. New `GATE_CHECK_DEPS` maps each named gate check to the upstream steps it verifies; `deriveGateChecks()` evaluates them via each sibling's own `accept()`. `CheckerContext.siblings` — declared in the type but never populated anywhere — is now wired at all three call sites (StaticStepFrame, deriveEntityArtifacts, useBaseline write-through sync), so the badge, posted server status, checklist rows, and log share one derivation. The gate can genuinely FAIL now, with "blocked by <steps>" detail. Legacy `pass:true` artifacts keep passing when no context is available.

5. **Deep Eval cancel** (orchestrator — **finding partially stale**). Verification showed the scanner's claimed corruption path was already defended: unreached passes stay `pending`/`running` and `modulesWithErroredPasses` counts those into `failedModules`, which `applyScanResult` subtracts from scope. What remained genuinely wrong: the abort path returned `modulesEvaluated` = the full requested list, relying entirely on the compensating field. Now the abort/error path returns only fully-completed modules — safe by construction for any consumer — and a new regression test pins the invariant.

## Verification

| Gate | Baseline (pre-scan) | After Wave 2 |
|---|---|---|
| `tsc --noEmit` | 0 errors | 0 errors |
| `vitest run` | 4456 passed / 1 failed (LayoutLab.navigation, pre-existing) / 5 skipped | 4457 passed (+1 new regression test) / 1 failed (same pre-existing) / 5 skipped — **0 regressions** |

Per-fix targeted verification during the wave: layout-lab suite 314/315 (only the pre-existing navigation flake), blueprint-transpiler 12/12, StateMachineEditor 22/22, sub_world-matching 292/292, evaluator 15/15 (incl. 1 new test).

## Patterns established (catalogue items 4–7)

4. **Verify Criticals before fixing them** — one of six "Criticals" (Deep Eval cancel) was already ~90% defended; the durable fix was an honest-contract hardening + a regression pin, not the sketched rewrite. Scanner findings are hypotheses, not verdicts.
5. **Snapshot-at-review, write-the-snapshot** — any confirm-modal whose payload derives from live props can write something the user never reviewed. Freeze the reviewed content into state with the plan; treat live-prop divergence as a visible stale state, never silent.
6. **Derived gates need the sibling plumbing checked** — a context field declared in a type (`CheckerContext.siblings`) that no call site populates is a trap: checkers written against it silently degrade. Wiring the data is the fix; grep for "declared but never constructed" context fields.
7. **Empty-collection reachability** — editors that allow deleting every item must decide the zero-item model explicitly (block the last delete OR first-class empty state); codegen/export paths must handle `[]` regardless.

## What remains

Waves 3–6 per INDEX.md: ~15 High-severity concurrency races (Wave 3), remaining Highs — destructive-action guards, global-state leaks (Wave 4), the design-system consistency sweep (Wave 5, Fable), Low tail + dead-code cleanup (Wave 6).
