# Bug Hunter + UI Perfectionist Scan — pof, 2026-06-12

> Dual-lens audit of the entire pof codebase (Next.js 16 / React 19 / TS / zustand / better-sqlite3 / three.js).
> 35 parallel subagent runs (one per context, both lenses per agent), batched in 5 waves of ≤8.
> **Bug lens deduped against the 2026-06-09 bug-hunt INDEX** — every bug below is NEW since that scan (or a regression introduced by its fix waves). The UI lens is a first-ever audit.
> Cap: top 5 findings per lens per context.

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Bug lens (new since 06-09) | 1 | 41 | 78 | 34 | **154** |
| UI lens (first audit) | 0 | 45 | 90 | 34 | **169** |
| **Combined** | **1** | **86** | **168** | **68** | **323** |

Counts verified two ways (`> Total:` header sum = `- **Severity**:` bullet count = parsed records = **323**).

**Baseline health (for the Phase B7 regression gate, captured 2026-06-12):**
- `tsc --noEmit`: 4 errors — **all in generated `.next/dev/types/`** (stale dev artifacts; `src/` is clean)
- `eslint --quiet src/`: **9 errors** (was 0 at the 06-09 scan — drifted)
- `vitest run`: **3830 pass / 40 fail / 1 skip** in 603 files (was 3926 pass / 14 fail at 06-09 — drifted; the 31 failing files include a `ueStaticCheckers` fs/path-availability pattern worth a look in wave fixing)
- pof working tree at scan time: uncommitted changes in `src/lib/leonardo.ts` (breaks its own unit test — see visual-asset-generation #2), `docs/index.bleve`, untracked `tools/`

---

## Per-context breakdown

Sorted by criticals, then bug-highs + ui-highs. Bug columns then UI columns.

| # | Context | bC | bH | bM | bL | uH | uM | uL | Total | Report |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | CLI Terminal & Task System | 1 | 1 | 3 | 0 | 1 | 3 | 1 | 10 | [cli-terminal-task-system.md](cli-terminal-task-system.md) |
| 2 | Combat & Damage Tuning | 0 | 2 | 1 | 0 | 2 | 3 | 0 | 8 | [combat-damage-tuning.md](combat-damage-tuning.md) |
| 3 | World, Quests & Procgen | 0 | 2 | 2 | 1 | 2 | 2 | 1 | 10 | [world-quests-procgen.md](world-quests-procgen.md) |
| 4 | Blender MCP Integration | 0 | 2 | 2 | 1 | 2 | 3 | 0 | 10 | [blender-mcp-integration.md](blender-mcp-integration.md) |
| 5 | Audio Generation & Scenes | 0 | 2 | 2 | 1 | 2 | 3 | 0 | 10 | [audio-generation-scenes.md](audio-generation-scenes.md) |
| 6 | Quality Evaluation Engine | 0 | 3 | 2 | 0 | 1 | 3 | 1 | 10 | [quality-evaluation-engine.md](quality-evaluation-engine.md) |
| 7 | App Shell & Navigation | 0 | 2 | 3 | 0 | 2 | 3 | 0 | 10 | [app-shell-navigation.md](app-shell-navigation.md) |
| 8 | Character & Genome Designer | 0 | 2 | 2 | 1 | 1 | 4 | 0 | 10 | [character-genome-designer.md](character-genome-designer.md) |
| 9 | Inventory System | 0 | 1 | 1 | 2 | 2 | 2 | 1 | 9 | [inventory-system.md](inventory-system.md) |
| 10 | Visual Asset Generation | 0 | 1 | 2 | 2 | 2 | 1 | 2 | 10 | [visual-asset-generation.md](visual-asset-generation.md) |
| 11 | Pipeline Artifacts & Test Gates | 0 | 1 | 2 | 0 | 2 | 3 | 0 | 8 | [pipeline-artifacts-test-gates.md](pipeline-artifacts-test-gates.md) |
| 12 | Layout Lab & Pipeline Steps | 0 | 2 | 2 | 0 | 1 | 2 | 2 | 9 | [layout-lab-pipeline-steps.md](layout-lab-pipeline-steps.md) |
| 13 | Project Health & Insights | 0 | 1 | 2 | 2 | 2 | 3 | 0 | 10 | [project-health-insights.md](project-health-insights.md) |
| 14 | AI Testing & Localization | 0 | 1 | 2 | 1 | 2 | 2 | 1 | 9 | [ai-testing-localization.md](ai-testing-localization.md) |
| 15 | Module Registry & Feature Matrix | 0 | 2 | 1 | 1 | 1 | 3 | 1 | 9 | [module-registry-feature-matrix.md](module-registry-feature-matrix.md) |
| 16 | Prompt Evolution & A/B Testing | 0 | 2 | 3 | 0 | 1 | 1 | 3 | 10 | [prompt-evolution-a-b-testing.md](prompt-evolution-a-b-testing.md) |
| 17 | Project Setup & Onboarding | 0 | 2 | 2 | 0 | 1 | 3 | 1 | 9 | [project-setup-onboarding.md](project-setup-onboarding.md) |
| 18 | Blueprint Transpiler & C++ Codegen | 0 | 1 | 3 | 1 | 2 | 2 | 1 | 10 | [blueprint-transpiler-c-codegen.md](blueprint-transpiler-c-codegen.md) |
| 19 | Harness Autonomous Builder | 0 | 3 | 2 | 0 | 0 | 0 | 0 | 5 | [harness-autonomous-builder.md](harness-autonomous-builder.md) |
| 20 | Game Director & Regression | 0 | 1 | 3 | 1 | 2 | 2 | 1 | 10 | [game-director-regression.md](game-director-regression.md) |
| 21 | Economy & Balance Simulation | 0 | 1 | 3 | 1 | 1 | 3 | 1 | 10 | [economy-balance-simulation.md](economy-balance-simulation.md) |
| 22 | Animation & Rigging | 0 | 1 | 2 | 2 | 1 | 3 | 1 | 10 | [animation-rigging.md](animation-rigging.md) |
| 23 | Level & Materials Authoring | 0 | 0 | 3 | 1 | 2 | 3 | 0 | 9 | [level-materials-authoring.md](level-materials-authoring.md) |
| 24 | Item Pipeline Steps | 0 | 1 | 1 | 3 | 1 | 3 | 1 | 10 | [item-pipeline-steps.md](item-pipeline-steps.md) |
| 25 | Crash Analysis & Pattern Library | 0 | 1 | 2 | 1 | 1 | 3 | 1 | 9 | [crash-analysis-pattern-library.md](crash-analysis-pattern-library.md) |
| 26 | GDD Compliance & Design Doc | 0 | 1 | 4 | 0 | 1 | 3 | 1 | 10 | [gdd-compliance-design-doc.md](gdd-compliance-design-doc.md) |
| 27 | Build, Cook & Packaging | 0 | 1 | 4 | 0 | 1 | 4 | 0 | 10 | [build-cook-packaging.md](build-cook-packaging.md) |
| 28 | AI Behavior & Squad Tactics | 0 | 0 | 3 | 1 | 2 | 3 | 0 | 9 | [ai-behavior-squad-tactics.md](ai-behavior-squad-tactics.md) |
| 29 | Abilities & GAS System | 0 | 1 | 4 | 0 | 0 | 4 | 1 | 10 | [abilities-gas-system.md](abilities-gas-system.md) |
| 30 | Bestiary & Enemy Design | 0 | 0 | 1 | 2 | 1 | 2 | 2 | 8 | [bestiary-enemy-design.md](bestiary-enemy-design.md) |
| 31 | Progression & Save Systems | 0 | 0 | 2 | 1 | 1 | 2 | 2 | 8 | [progression-save-systems.md](progression-save-systems.md) |
| 32 | Prompt Construction & Context | 0 | 0 | 2 | 2 | 1 | 0 | 3 | 8 | [prompt-construction-context.md](prompt-construction-context.md) |
| 33 | Session Analytics & Telemetry | 0 | 0 | 2 | 1 | 1 | 2 | 2 | 8 | [session-analytics-telemetry.md](session-analytics-telemetry.md) |
| 34 | Loot & Affix System | 0 | 0 | 2 | 3 | 0 | 3 | 2 | 10 | [loot-affix-system.md](loot-affix-system.md) |
| 35 | UE5 Bridge & Live Sync | 0 | 0 | 1 | 2 | 0 | 4 | 1 | 8 | [ue5-bridge-live-sync.md](ue5-bridge-live-sync.md) |

---

## The 1 critical + 41 bug-high findings — one-line summaries, themed

### A. CLI process lifecycle & abort theater (6) — "abort" and "complete" don't mean what they say
1. **CRITICAL — CLI Terminal #1.** Every live run goes through `submitPrompt` with a null taskId, so `session.isRunning` latches true forever after the first prompt — checklists, analytics, and module buttons wedge until refresh. `src/components/cli/InlineTerminal.tsx:156`
2. **CLI Terminal #2.** Abort still doesn't stop the run on Windows — `process.kill()` terminates the `cmd.exe` shell, not claude's node process (gap in the a5a5795 fix). `src/lib/claude-terminal/cli-service.ts:336`
3. **Quality Eval #1.** Batch-review "Abort" (and the 10-min timeout) never kills the underlying CLI execution — orphaned token-burning process. `src/app/api/feature-matrix/batch-review/route.ts:41`
4. **Build/Cook #1.** Aborting a cook kills only the `cmd.exe` wrapper — the UAT tree survives, holds staging locks, and the run is misrecorded as `failed`. `src/lib/packaging/cook-executor.ts:92`
5. **AI Testing #1.** The Run-Tests/Auto-detect CLI round-trip never closes — statuses, lastRunOutput, and the pass-rate ring are permanently dead (success theater). `src/components/modules/game-systems/AIBehaviorView.tsx:132`
6. **UE5 Bridge #1 (Medium, same family).** Aborted headless builds SIGTERM only the UBT parent; MSBuild/cl.exe grandchildren survive and wedge the queue. `src/lib/ue5-bridge/build-pipeline.ts:135`

### B. Regressions / incomplete fixes from the 06-09 fix waves (6) — the dedup instruction paid off
7. **Crash Analysis #1.** The whole-word fix (25d6de5) killed multi-word trigger keywords — the anti-pattern guardrail is silently dead for state-machine/montage/data-driven approaches. `src/lib/pattern-library-db.ts:644`
8. **Layout Lab #1.** The 3d50330 `produceFrom` fix migrated only ItemArt — `ArchetypeStep` keeps the verbatim stale-closure batch-drop. `src/components/layout-lab/steps/ArchetypeStep.tsx:91`
9. **Economy #1.** The config-clamp fix landed only on `simulate` — `generate-code` and the 31-run `/sweep` route still feed raw configs to `runSimulation` (NaN codegen + CPU-DoS reopened). `src/app/api/economy-simulator/route.ts:73`
10. **Module Registry #1.** Auto-Verify's batch POST sends partial rows to a full upsert that binds `undefined` → write 500s every time; after 2dd1e06's `writeResult.ok` gate the whole feature is dead while the banner claims success. `src/lib/pof-bridge/verification-engine.ts:88-113`
11. **Harness #3.** Checkpoint baseline anchors at HEAD, not the dirty tree — first rollback still wipes pre-run uncommitted changes even in sequential mode (residual gap of 73a447a). `src/lib/harness/orchestrator.ts:392-402`
12. *(Medium, same family)* **Session Analytics #1.** The 8b7856f timestamp defaults sit inside `CREATE TABLE IF NOT EXISTS` — inert on every existing DB; the vanishing-row bug remains armed. **GDD #3**: the wave-1 `.repeat()` clamp missed the quality-star path.

### C. UE5 codegen correctness (4) — generated C++ that is wrong or won't compile
13. **Abilities #1.** Authored "Cooldown" is silently codegen'd as a GameplayEffect *Period* (DoT tick) — cooldowns become periodic damage in every codegen path. `src/lib/gas-codegen.ts:141`
14. **Genome #1.** The 19206ae "hardened" codegen sanitizes strings but not numbers — `GravityScale = 1f;` invalid float literals make every preset genome's .cpp fail to compile. `src/lib/genome/codegen.ts:66`
15. **Animation #1.** Non-identifier state names (spaces, empty, leading digit) pass the new linter clean and emit uncompilable C++ enums. `src/components/modules/content/animations/StateMachineEditor.tsx:1239`
16. **Blueprint Transpiler #1.** Editing the Module field inside the dry-run modal makes "Confirm write" overwrite files the user never saw diffed. `BlueprintTranspilerView.tsx:569`

### D. Destructive writes & data loss (6)
17. **Genome #2.** Clearing the genome name silently deletes the genome and all its checkpoints on next reload. `GenomeHeaderPanel.tsx:43`
18. **Item Pipeline #1.** "Populate demo" silently destroys the entire kept generation history — locally and on the server. `itemsSteps.ts:400`
19. **Module Registry #2.** One transient GET failure on mount triggers auto-seed, which overwrites a module's entire review data with `unknown`/empty. `useFeatureMatrix.ts:107-112`
20. **Quality Eval #3.** A *completed* scan with errored passes wipes the module's regression baseline and fabricates "Resolved" findings. `deep-eval-engine.ts:176`
21. **Audio #2.** Event Catalog edits are silently wiped on every tab switch. `AudioEventCatalog.tsx:113`
22. **Project Setup #1.** Project switch never re-scans (`initialScanDone` ref) — the stale "Create project" CTA can scaffold over an existing project. `useProjectScan.ts:197-208`

### E. Queues, races & orphaned async (5)
23. **Blender #1.** cbb5840's command chain has no flush on disconnect — dead commands starve the queue; reconnects stall behind them. `src/lib/blender-mcp/service.ts:117`
24. **Blender #2.** No post-timeout drain — a late response answers the *next* command, permanently off-by-one (the exact cross-wire the fix claims impossible). `service.ts:155`
25. **Inventory #1.** Switching catalog cards mid-generation re-keys the single `useGeneration` session — premature false-failure completion + orphaned real completion. `CatalogGearTab.tsx:82-84`
26. **Harness #2.** `fillPool` ignores `paused` — a user pause can launch brand-new sessions, then abandon all in-flight sessions un-awaited. `orchestrator.ts:614-639`
27. **Visual Assets #1.** A single transient status-poll failure permanently fails an in-flight MCP 3D job — remote generation orphaned, credits wasted. `useForgeStore.ts:157`

### F. Trust boundaries & sim correctness (4)
28. **Combat #1.** Player ability fallback bypasses cooldown *and* mana gates — caster loadouts cast free Fireballs forever; survival/DPS numbers are fiction. `simulation-engine.ts:344`
29. **Combat #2.** API accepts unvalidated `scenario.enemies` — unbounded `count` hangs the server; all-unknown archetypes return a silent 100%-survival result. `combat-simulator/route.ts:53`
30. **World/Procgen #1.** Boss-zone diamonds are drawn in pixel space on a percent-coordinate map — every boss node renders detached from its label/edges. `MapCanvas.tsx:132`
31. **World/Procgen #2.** Density tab's level axis is frozen at MAX_LEVEL=7 while zones reach 50 — six rows blank/clipped. `DensityLevelGroup.tsx:78`

### G. Stale state, dead reads & orphaned features (6)
32. **GDD #1.** Compliance report never invalidated — stale scores survive project switches. `gddComplianceStore.ts:24`
33. **Game Director #1.** SessionDetail never refetches after a simulate completes — header says "12 findings", tab says "No findings yet". `SessionDetail.tsx:65`
34. **Quality Eval #2.** BatchReviewPanel's polling interval is never recreated on remount/resume — frozen UI, swallowed recovery. `BatchReviewPanel.tsx:61`
35. **Prompt Evolution #1.** Persisted A/B tests are unreachable after reload — no list endpoint, never loaded; running tests become unconcludable orphans. `promptEvolutionStore.ts:109`
36. **Prompt Evolution #2.** Module picker hardcodes 5 phantom module ids and omits 5 real ones. `PromptEvolutionView.tsx:66-79`
37. **Health Insights #1.** The pattern miner stamps the module-wide success rate onto every approach cluster — failing approaches get labeled "promising" and recommended. `pattern-extractor.ts:183`

### H. App shell & onboarding hazards (4)
38. **App Shell #1.** "+" terminal tabs create sessions with no `moduleId` that can never render anywhere — and hide the current inline terminal. `CLITabBar.tsx:116-125`
39. **App Shell #2.** Renaming a project rewrites `projectPath` to a nonexistent folder and persists it to SQLite. `TopBar.tsx:139-159`
40. **Project Setup #2.** "Start Fresh" hardcodes `C:\Users\kazda` as the default projects path — breaks first-run on any other machine. `SetupWizard.tsx:16,91`
41. **Pipeline Artifacts #1.** Scenario-only L3 jobs reach the bridge executor, which runs an unfiltered automation pass and correlates against ALL recorded results. `drain.ts:115`
42. **Harness #1.** Every pause path falls through to the unconditional "completed" epilogue — paused runs persist as completed; the resume API is bricked (409). `orchestrator.ts:749`

---

## The 45 UI-high findings — themed

### U1. Keyboard / assistive-tech inaccessibility (26 of 45 highs; 61 a11y findings total)
The single dominant UI theme: core authoring surfaces are built from mouse-only clickable `div`s, icon-only buttons without accessible names, hover-only reveals, and hand-rolled modals without focus management. Highest-leverage entries:
- **Shared layout-lab controls kill the focus ring globally** — `LabTextarea`/`LabInput` set `outline:none` with no replacement; flagged independently by two contexts. `src/components/layout-lab/steps/controls.tsx:22`
- **The shell's three overlay surfaces each do dialog semantics differently** (search palette / activity drawer / dropdown — none fully correct); fixing the shared pattern fixes every consumer. `GlobalSearchPanel.tsx:170-176`
- **CLI tab close "X" is a fake nested button** unreachable by keyboard. `CLITabBar.tsx:101-111`
- Canvas/graph editors (StateMachineEditor, MapCanvas, TopologyGraph, BT flowchart, FlankAngleHeatmap, paper-doll slots, item grid drawer, crash rows, "Needs Attention" rows, diff cards, economy charts, radar drill-down, …) are operable only by mouse.
- Hand-rolled keyboardless modals: CodePreview, Blender lightbox, transpiler dry-run dialog (the app *has* an accessible `Modal` primitive it bypasses).

### U2. Unconfirmed destructive actions (5)
One-click, irreversible, no-undo deletes: audio scenes (`AudioView.tsx:415`), AI test suites — flagged by two contexts (`AIBehaviorView.tsx:265`), build history entries (`BuildHistoryDashboard.tsx:163`), plus cascade semantics nobody warns about. One shared ConfirmDialog primitive + adoption pass closes all five.

### U3. Silent-failure UX & dead affordances (8)
- Dead primary CTAs: "Scan Project" (`ProjectHealthDashboard.tsx:271`), "Browse" (`NewSessionPanel.tsx:169`), built-but-never-rendered sort controls (Blender inventory).
- Errors rendered as "no data": Genre Evolution (`TelemetryEvolution.tsx:47`), deferred test-gate runs discarding their DrainSummary (`Baseline.tsx:133-143`), tooltip detail dropped by `useEntityArtifacts.ts:61`.
- Assistant replies hard-truncated at 200 chars with no expansion (`TerminalOutput.tsx:73`); findings-triage collapsing the whole explorer into a spinner (`FindingsExplorer.tsx:52`).

### U4. Visual consistency & color language (4)
Error-red used as the GDD compliance view's accent (loading/CTA/selection all read as failure, `GDDComplianceView.tsx:195`); two clashing visual languages in the Materials tab strip; topology nodes overflowing a hard-coded 460×300 canvas; transpiler modal bypassing the design system.

### U5. Missing recovery affordances (2)
Setup wizard has no manual browse/path fallback (undetectable projects can't be opened, `SetupWizard.tsx:215-240`); "Try again" after failed refinement silently regenerates from scratch and clears the instruction (`forge/index.tsx:151`).

---

## Triage themes (combined)

| Theme | ~Count | Why this is a wave, not individual fixes |
|---|---:|---|
| A. CLI process lifecycle & abort theater | 6 (1 C) | One mental model: spawn → track → complete/abort on Windows (`taskkill /T`, completion routing, null-taskId path). Fixes share `cli-service` / `useModuleCLI` plumbing. |
| B. Fix-the-fixes (06-09 regression tail) | 7 | Each is "the fix was right but partial" — same verification discipline; all have a prior finding + commit to test against. |
| C. UE5 codegen correctness | 4–6 | All emit C++ from authored data; one shared sanitize/validate layer (identifiers, float literals, semantic fields) covers the class. |
| D. Destructive writes & data loss | 6 | One pattern: guard the write path (confirm/merge/soft-delete) instead of trusting transient UI state. |
| E. Queues, races & orphaned async | 5 | Queue lifecycle invariants: flush on disconnect, drain on timeout, key completions by id not by current selection. |
| F. Trust boundaries & sim correctness | 4 | Validate at the API edge; clamp + reject unknown ids; shared zod-style schema per sim route. |
| G. Stale state & dead reads | 6 | Refetch/invalidate discipline: key caches by project, refetch on completion events, hydrate persisted stores. |
| H. Shell & onboarding hazards | 4 | Small, high-blast-radius shell fixes (tab creation, rename, hardcoded paths). |
| U1. Keyboard/AT access | 61 (26 H) | Fix shared primitives first (controls.tsx focus ring, dialog pattern, row-button pattern), then sweep consumers. |
| U2. Destructive-action confirms | 5 | One ConfirmDialog primitive + adoption. |
| U3. Silent-failure UX | 8 | One pattern: errors must render as errors; dead CTAs either work or disappear. |
| U4/U5. Visual consistency + recovery | 6 | Token/primitive adoption pass. |

---

## Suggested next-phase split (wave plan)

| Wave | Theme | Scope | Est. fixes |
|---|---|---|---:|
| 1 | **A — CLI lifecycle & abort theater** | The Critical + 5 process/completion fixes | 6 |
| 2 | **B — Fix-the-fixes** | 7 regression-tail items from the 06-09 waves | 7 |
| 3 | **D — Destructive writes & data loss** | 6 data-loss guards | 6 |
| 4 | **C — UE5 codegen correctness** | sanitize/validate layer + 4 emitters | 5 |
| 5 | **E — Queues & races** | Blender queue, forge poll, inventory re-key, harness pool | 5 |
| 6 | **F+G — Trust boundaries + stale state** | API-edge validation + refetch discipline (could split in two) | 8 |
| 7 | **H + U3 — Shell hazards + silent-failure UX** | shell fixes + dead CTAs + error rendering | 7 |
| 8 | **U2 + U1-primitives — Confirms + a11y foundations** | ConfirmDialog, controls.tsx focus ring, shared dialog semantics, row-button pattern | 6 |
| 9+ | **U1-sweep — Keyboard access for authoring surfaces** | consumer-by-consumer adoption (likely 2–3 waves) | 20+ |

Medium/Low tail (168 M + 68 L) remains in the per-context reports for opportunistic pickup when a wave touches the same file.

---

## How this scan was run

- **Scanner prompts**: Vibeman registry `bug-hunter` (agent_bug_hunter) + `ui-perfectionist` (agent_ui_perfectionist), condensed into one dual-lens subagent per context (deviation from single-role dispatch: same coverage at half the dispatch/file-read cost; both lenses confirmed workable in one pass).
- **Dedup mode**: each subagent read its context's `docs/harness/bug-hunt-2026-06-09/<slug>.md` first; only NEW bugs reported. Several subagents explicitly verified recent fix commits (0a01cd8, 19206ae, 25d6de5, 2dd1e06, 3d50330, 73a447a, 8b7856f, a47ba57, a5a5795, ae32fa0, baffff5, bb939d8, cbb5840, cd1580f, 1f51224, 6f9fa4d, 596d964) — 6 regressions/incomplete fixes found (theme B), 11 fixes verified clean.
- **Scope**: all 35 contexts in 12 groups (client-side only by nature — no `src-tauri` in pof), `_scope/<slug>.json` per context; cap top 5 per lens.
- **Waves**: 5 waves of ≤8 parallel general-purpose subagents (2026-06-12). Wave 2 was interrupted by a session limit; both affected agents had already written complete reports (verified by bullet-count = header total), so no re-runs were needed.
- **Stale scope entries noticed by subagents** (context drift): `src/lib/item-dna/index.ts`, `src/components/.../auto-rig/index.ts`, `asset-browser/index.ts`, `src/hooks/useBuildPipeline.ts`, `ResizeHandle.tsx`, `knowledge/index.ts` no longer exist — contexts in Vibeman should be refreshed.
- **Files read**: ~740 file reads across 35 subagents (≈21 per context: full scope + coupled neighbors + prior report).
- **Verification**: `> Total:` header sum (323) = severity-bullet count (323) = parsed `_findings.json` records (323).
