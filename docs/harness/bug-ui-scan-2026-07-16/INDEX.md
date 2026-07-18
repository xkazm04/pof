# Bug-Hunter + UI-Perfectionist Scan — pof, 2026-07-16

> Combined bug-hunter + ui-perfectionist audit, UI/component-scoped (backend/lib/store/API-route files excluded per user's side-scope choice).
> 32 contexts scanned (of 35 total; 3 skipped — see "Skipped contexts" below), one combined subagent per context, dispatched in 4 waves of 8.

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 32 contexts | 9 | 51 | 131 | 103 | **294** |
| Share | 3.1% | 17.3% | 44.6% | 35.0% | 100% |

Verified two ways: sum of each report's `> Total:` header = 294; count of `**Severity**:` bullets across all reports = 294. Match.

## Skipped contexts (0 files after UI-only filter)

These 3 contexts are pure backend/lib with no `.tsx`/`/components/`/`/hooks/` files, so the UI/components-only scope filter left nothing to scan:
- **Pipeline Artifacts & Test Gates** (Catalog to UE Pipeline) — SQLite artifact store, lifecycle, test-gate runner
- **Prompt Construction & Context** (Prompt Engineering) — prompt-builder library
- **Harness Autonomous Builder** (Director, Sessions & Autonomy) — orchestrator lib

If a future pass should cover these, re-run with "both" side-scope (or backend-only) for just these 3.

---

## Per-context breakdown

(Sorted by Critical desc, then High desc. Severity sub-counts are best-effort parsed from each report's finding blocks — a couple of reports have a 1-count parsing variance vs. their header Total due to non-standard field ordering in one finding; treat the `Total` column, which comes from each report's own header, as authoritative.)

| # | Context | Group | Critical | High | Medium | Low | Total | Report |
|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | World, Quests & Procgen | Progression, World & Bestiary | 2 | 1 | 2 | 4 | 9 | world-quests-procgen.md |
| 2 | CLI Terminal & Task System | CLI Terminal & Module Shell | 1 | 3 | 3 | 2 | 9 | cli-terminal-task-system.md |
| 3 | Project Setup & Onboarding | UE5 Integration & Project Setup | 1 | 3 | 4 | 2 | 10 | project-setup-onboarding.md |
| 4 | Item Pipeline Steps | Catalog to UE Pipeline | 1 | 2 | 4 | 2 | 9 | item-pipeline-steps.md |
| 5 | Blueprint Transpiler & C++ Codegen | UE5 Integration & Project Setup | 1 | 2 | 4 | 3 | 10 | blueprint-transpiler-c-codegen.md |
| 6 | Quality Evaluation Engine | Quality Evaluator & Health | 1 | 1 | 5 | 2 | 9 | quality-evaluation-engine.md |
| 7 | Combat & Damage Tuning | Character & Combat Authoring | 1 | 1 | 6 | 1 | 9 | combat-damage-tuning.md |
| 8 | Animation & Rigging | Visual Content Generation | 1 | 0 | 4 | 4 | 9 | animation-rigging.md |
| 9 | Character & Genome Designer | Character & Combat Authoring | 0 | 4 | 3 | 2 | 9 | character-genome-designer.md |
| 10 | Layout Lab & Pipeline Steps | Catalog to UE Pipeline | 0 | 3 | 3 | 3 | 9 | layout-lab-pipeline-steps.md |
| 11 | AI Behavior & Squad Tactics | AI, Build & Packaging Systems | 0 | 3 | 5 | 2 | 10 | ai-behavior-squad-tactics.md |
| 12 | Inventory System | Items, Loot & Economy | 0 | 2 | 5 | 3 | 10 | inventory-system.md |
| 13 | App Shell & Navigation | CLI Terminal & Module Shell | 0 | 2 | 4 | 4 | 10 | app-shell-navigation.md |
| 14 | Level & Materials Authoring | Visual Content Generation | 0 | 2 | 5 | 2 | 9 | level-materials-authoring.md |
| 15 | Module Registry & Feature Matrix | CLI Terminal & Module Shell | 0 | 2 | 5 | 2 | 9 | module-registry-feature-matrix.md |
| 16 | Loot & Affix System | Items, Loot & Economy | 0 | 2 | 4 | 4 | 10 | loot-affix-system.md |
| 17 | Progression & Save Systems | Progression, World & Bestiary | 0 | 2 | 4 | 3 | 9 | progression-save-systems.md |
| 18 | Blender MCP Integration | Audio & Blender Pipeline | 0 | 2 | 4 | 4 | 10 | blender-mcp-integration.md |
| 19 | AI Testing & Localization | AI, Build & Packaging Systems | 0 | 2 | 5 | 2 | 9 | ai-testing-localization.md |
| 20 | GDD Compliance & Design Doc | Quality Evaluator & Health | 0 | 2 | 5 | 3 | 10 | gdd-compliance-design-doc.md |
| 21 | Session Analytics & Telemetry | Director, Sessions & Autonomy | 0 | 1 | 4 | 3 | 8 | session-analytics-telemetry.md |
| 22 | UE5 Bridge & Live Sync | UE5 Integration & Project Setup | 0 | 1 | 3 | 4 | 8 | ue5-bridge-live-sync.md |
| 23 | Prompt Evolution & A/B Testing | Prompt Engineering | 0 | 1 | 3 | 4 | 8 | prompt-evolution-a-b-testing.md |
| 24 | Abilities & GAS System | Character & Combat Authoring | 0 | 1 | 4 | 4 | 9 | abilities-gas-system.md |
| 25 | Visual Asset Generation | Visual Content Generation | 0 | 1 | 5 | 3 | 9 | visual-asset-generation.md |
| 26 | Crash Analysis & Pattern Library | Quality Evaluator & Health | 0 | 1 | 5 | 3 | 9 | crash-analysis-pattern-library.md |
| 27 | Build, Cook & Packaging | AI, Build & Packaging Systems | 0 | 1 | 5 | 3 | 9 | build-cook-packaging.md |
| 28 | Audio Generation & Scenes | Audio & Blender Pipeline | 0 | 1 | 4 | 4 | 9 | audio-generation-scenes.md |
| 29 | Project Health & Insights | Quality Evaluator & Health | 0 | 1 | 5 | 4 | 10 | project-health-insights.md |
| 30 | Game Director & Regression | Director, Sessions & Autonomy | 0 | 1 | 3 | 6 | 10 | game-director-regression.md |
| 31 | Economy & Balance Simulation | Items, Loot & Economy | 0 | 1 | 3 | 5 | 9 | economy-balance-simulation.md |
| 32 | Bestiary & Enemy Design | Progression, World & Bestiary | 0 | 0 | 5 | 3 | 8 | bestiary-enemy-design.md |

---

## All 9 critical findings — one-line summary

### A. Concurrency / re-entrancy races that corrupt shared state
1. **Combat & Damage Tuning — Concurrent simulation runs corrupt state via last-write-wins.** Double-clicking "Run 1000 Fights" fires two overlapping `runSimulationStreaming` calls that both write into the same zustand fields with no request-token guard. `src/stores/combatSimulatorStore.ts:142-203`
2. **Project Setup & Onboarding — `useProjectScan.scan()` has no re-entrancy guard.** Four independent triggers (path-change effect, manual rescan, three CLI `onComplete` callbacks) can race; whichever resolves last wins, misdirecting the first-run "do this next" CTA. `src/components/modules/project-setup/useProjectScan.ts:53-197`
3. **CLI Terminal & Task System — Force-completing a "running" task on 409 conflict doesn't kill the underlying process.** A stale registry row is marked failed and a new task dispatches on the same session, so two CLI processes can end up concurrently editing the same project files with no way to cancel the orphan. `src/components/cli/useTaskQueue.ts:483-487`

### B. Success theater — gates/actions that always look green
4. **Item Pipeline Steps — Test Gate always reports PASS regardless of upstream quality.** `produce()` hard-codes `pass: true` unconditionally; no sibling artifact is ever read. `src/components/layout-lab/steps/itemsSteps.ts:411`
5. **Quality Evaluation Engine — Cancelling a Deep Eval silently corrupts the regression baseline.** Modules cut short by an abort get merged in as "zero findings," marking their real prior findings RESOLVED and persisting the corruption server-side. `src/components/modules/evaluator/DeepEvalResults/useDeepEvalResults.ts:80-108` (root cause `src/lib/evaluator/deep-eval-engine.ts:280-310`)

### C. Silent wrong-target actions
6. **World, Quests & Procgen — Regenerate action can silently target the wrong zone.** When the level-filtered zone has no catalog entry yet, the code falls back to `zoneEntries[0]` — an arbitrary unrelated zone — instead of showing "not found." `src/components/modules/core-engine/sub_world/index.tsx:83-87`
7. **World, Quests & Procgen — Non-null assertion on `primaryEntry` crashes `useGeneration` when the catalog is empty.** Same root data gap as #6, but crashes the whole tab instead of silently misfiring. `src/components/modules/core-engine/sub_world/index.tsx:87`

### D. Reviewed-then-mismatched writes
8. **Blueprint Transpiler & C++ Codegen — Confirmed write can silently persist content never shown in the reviewed diff.** If Transpile re-runs while the dry-run confirm modal is open, `confirmWrite` closes over the *new* header/source props while the on-screen diff still reflects the *old* ones. `.../BlueprintTranspilerView/WriteToProjectButton.tsx:36-68`

### E. Reachable crash with no guard
9. **Animation & Rigging — Deleting all states in the Visual State Machine Editor crashes code generation.** No minimum-state guard; Export/View Code throw synchronously with no user-visible error. `.../StateMachineEditor/codegen.ts:19-24`

---

## Triage themes

| Theme | Approx count | Why this is a wave, not just individual fixes |
|---|---:|---|
| A. Concurrent-invocation / stale-response races (no re-entrancy guard, no request sequencing) | ~18 | Same shape everywhere: an async action can be re-triggered before the prior one resolves, and the older response wins. One fix pattern (request-token / AbortController / disable-while-pending) applies across combat sim, economy sim, project scan, feature matrix fetch, global search, prompt evolution, CLI task queue, UE5 bridge rAF race, catalog gear-tab double-click. |
| B. Success theater — controls/gates that look functional but have no backing logic | ~9 | Test Gate hard-coded PASS, Deep Eval cancel corrupting baseline, snoozed findings never auto-expiring, Data Recovery/Cloud Sync mock controls, AI Testing debounce that "flushes" but doesn't commit, Scan Project button with no error surface. Same fix pattern: wire the control to real state or remove the false affordance. |
| C. Context-map drift (near-universal) | n/a (process finding) | Almost every one of the 32 contexts had files refactored from flat `.tsx` into folders since the context map was last generated (e.g. `AudioEventCatalog.tsx` → `AudioEventCatalog/` with 6+ files); a few listed files don't exist at all anymore (`useIntentDispatch.ts`, `useBuildPipeline.ts`, `PipelineRollup.tsx`, `LiveCodingPanel.tsx`/`UE5RemoteController.tsx` deliberately removed). Recommend a `refresh_context` pass across all 32 contexts before the next scan. |
| D. Global/unscoped shared state leaking across logical boundaries | ~6 | Audio event catalog is one global store shared across all scenes (editing under scene A corrupts scene B); Post-Process stack has two independent state sources (Materials tab local state vs. Evaluator global store) that silently diverge. |
| E. Unconfirmed destructive actions | ~5 | Delete Suite (AI Behavior sandbox), Reset button (Animation checklist), and others fire immediately with no confirmation dialog and no guard against an in-flight operation. |
| F. Design-system inconsistency (hardcoded hex, non-responsive grids, missing focus-visible) | ~35 (UI lens, spread across nearly all contexts) | Recurring UI-Perfectionist findings: hardcoded color literals bypassing theme tokens, fixed-column grids that don't reflow when data shape changes (e.g. 3-column stat grid vs. 5 build presets), missing `focus-visible` styles on inputs, hover-only affordances with no keyboard/touch path. |
| G. Dead/orphaned code presented as live features | ~4 | `useGenomeHistory.ts` implements a full undo/redo stack that's completely unwired to the live `genomeStore`; several referenced hooks/files don't exist on master at all. |

---

## Suggested next-phase split

A 6-wave plan, criticals + highs first (60 findings), then a Medium/Low tail by theme:

- **Wave 1 — Concurrency races, part 1 (Criticals)**: findings #1, #2, #3 above (Combat sim, Project Scan, CLI Task Queue) — the 3 Critical concurrency bugs, each in a different high-traffic surface.
- **Wave 2 — Success theater + wrong-target (Criticals)**: findings #4, #5, #6, #7, #8, #9 — Item Pipeline Test Gate, Deep Eval cancel corruption, World zone fallback (2 bugs, same file), Blueprint write-diff mismatch, Animation state machine crash.
- **Wave 3 — Concurrency races, part 2 (Highs)**: the remaining ~15 High-severity race findings across Character Wizard, Inventory catalog, Feature Matrix, Prompt Evolution, App Shell global search, UE5 Bridge rAF race, Preflight Panel project-scoping.
- **Wave 4 — Remaining Highs (theme B/D/E)**: unconfirmed destructive actions, global-state leaks (audio catalog, post-process dual-state), remaining success-theater Highs.
- **Wave 5 — Design-system consistency pass (Medium UI findings)**: hardcoded colors, non-responsive grids, focus-visible gaps — batchable since the fix pattern repeats.
- **Wave 6 — Low-severity tail + dead-code cleanup**: unwire or wire up orphaned features (genome undo stack), remove/fix references to deleted files, remaining Low findings.

**Process recommendation (not a fix wave):** run `refresh_context` across all 32 scanned contexts before the next audit — the near-universal flat-file → folder drift (theme C) means the context map's `filePaths` are stale for most of the project and will misdirect the next scan's subagents the same way this one had to self-correct.

---

## How this scan was run

- **Scanner**: combined bug-hunter + ui-perfectionist role prompt (from `src/lib/prompts/registry/agents/bug-hunter.ts` and `ui-perfectionist.ts` in the Vibeman repo), one subagent per context, targeting 3-5 findings per lens (up to 10/context).
- **Date**: 2026-07-16. **Scope**: all 35 contexts requested; 32 scanned, 3 skipped (0 files after the UI-only filter — see above).
- **Side scope**: UI/components only (per user choice) — `.tsx` files, `/components/`, `/hooks/` paths; `lib/`, `stores/`, and API routes excluded.
- **Method**: 4 waves of ≤8 parallel subagents (32 total dispatches), read-only analysis, no code modified during scanning.
- **Verification**: findings counts cross-checked two ways (report header sum vs. bullet count) — both equal 294.
- **Baseline** (for the upcoming fix waves): `npx tsc --noEmit` → 0 errors. `npx vitest run` → 4456 passed / 1 failed / 5 skipped (715/720 test files), captured 2026-07-16 before this scan.
