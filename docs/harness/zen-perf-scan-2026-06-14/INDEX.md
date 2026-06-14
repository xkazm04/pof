# Zen-Architect + Perf-Optimizer Scan — pof, 2026-06-14

> Combined structural (zen-architect) + performance (perf-optimizer) audit, top-5 highest-value findings per context.
> 35 parallel subagent runs, batched in 5 waves of ≤8. Read-only scan; ~600+ files read across the codebase.

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 35 contexts | 0 | 67 | 82 | 27 | **176** |
| Share | 0% | 38% | 47% | 15% | 100% |

Lens split: **architecture 44 · performance 87 · both 45**. (Two-way verified: `> Total:` header sum = `## N.` heading count = `Severity` bullet count = 176.)

No criticals — this is a healthy, type-clean codebase (baseline `tsc --noEmit` = 0 errors). The findings are real-but-non-fatal: re-render jank, redundant queries, dead code, and a handful of diverged-logic / lifecycle hazards.

---

## Per-context breakdown

Sorted by High desc, then Total.

| # | Context | Group | C | H | M | L | Total | Report |
|---|---|---|---:|---:|---:|---:|---:|---|
| 02 | Combat & Damage Tuning | Character & Combat | 0 | 3 | 2 | 0 | 5 | `02-combat-damage-tuning.md` |
| 22 | AI Testing & Localization | AI/Build/Pkg | 0 | 3 | 2 | 0 | 5 | `22-ai-testing-localization.md` |
| 33 | Harness Autonomous Builder | Director/Sessions | 0 | 3 | 2 | 0 | 5 | `33-harness-autonomous-builder.md` |
| 23 | Build, Cook & Packaging | AI/Build/Pkg | 0 | 2 | 3 | 1 | 6 | `23-build-cook-packaging.md` |
| 01 | Abilities & GAS System | Character & Combat | 0 | 2 | 3 | 0 | 5 | `01-abilities-gas-system.md` |
| 03 | Character & Genome Designer | Character & Combat | 0 | 2 | 2 | 1 | 5 | `03-character-genome-designer.md` |
| 04 | Economy & Balance Simulation | Items/Loot/Economy | 0 | 2 | 2 | 1 | 5 | `04-economy-balance-simulation.md` |
| 05 | Inventory System | Items/Loot/Economy | 0 | 2 | 2 | 1 | 5 | `05-inventory-system.md` |
| 06 | Loot & Affix System | Items/Loot/Economy | 0 | 2 | 2 | 1 | 5 | `06-loot-affix-system.md` |
| 07 | Bestiary & Enemy Design | Progression/World | 0 | 2 | 2 | 1 | 5 | `07-bestiary-enemy-design.md` |
| 08 | World, Quests & Procgen | Progression/World | 0 | 2 | 2 | 1 | 5 | `08-world-quests-procgen.md` |
| 12 | Visual Asset Generation | Visual Content | 0 | 2 | 2 | 1 | 5 | `12-visual-asset-generation.md` |
| 13 | Blender MCP Integration | Audio/Blender | 0 | 2 | 2 | 1 | 5 | `13-blender-mcp-integration.md` |
| 14 | Audio Generation & Scenes | Audio/Blender | 0 | 2 | 2 | 1 | 5 | `14-audio-generation-scenes.md` |
| 15 | Pipeline Artifacts & Test Gates | Catalog→UE | 0 | 2 | 2 | 1 | 5 | `15-pipeline-artifacts-test-gates.md` |
| 17 | Layout Lab & Pipeline Steps | Catalog→UE | 0 | 2 | 3 | 0 | 5 | `17-layout-lab-pipeline-steps.md` |
| 18 | Crash Analysis & Pattern Library | Quality/Health | 0 | 2 | 2 | 1 | 5 | `18-crash-analysis-pattern-library.md` |
| 19 | Project Health & Insights | Quality/Health | 0 | 2 | 2 | 1 | 5 | `19-project-health-insights.md` |
| 20 | GDD Compliance & Design Doc | Quality/Health | 0 | 2 | 2 | 1 | 5 | `20-gdd-compliance-design-doc.md` |
| 21 | Quality Evaluation Engine | Quality/Health | 0 | 2 | 3 | 0 | 5 | `21-quality-evaluation-engine.md` |
| 25 | App Shell & Navigation | CLI/Shell | 0 | 2 | 2 | 1 | 5 | `25-app-shell-navigation.md` |
| 26 | Module Registry & Feature Matrix | CLI/Shell | 0 | 2 | 2 | 1 | 5 | `26-module-registry-feature-matrix.md` |
| 27 | CLI Terminal & Task System | CLI/Shell | 0 | 2 | 2 | 1 | 5 | `27-cli-terminal-task-system.md` |
| 29 | Prompt Construction & Context | Prompt Eng | 0 | 2 | 2 | 1 | 5 | `29-prompt-construction-context.md` |
| 30 | Project Setup & Onboarding | UE5 Integration | 0 | 2 | 2 | 1 | 5 | `30-project-setup-onboarding.md` |
| 31 | Blueprint Transpiler & C++ Codegen | UE5 Integration | 0 | 2 | 2 | 1 | 5 | `31-blueprint-transpiler-c-codegen.md` |
| 32 | UE5 Bridge & Live Sync | UE5 Integration | 0 | 2 | 3 | 0 | 5 | `32-ue5-bridge-live-sync.md` |
| 34 | Session Analytics & Telemetry | Director/Sessions | 0 | 2 | 2 | 1 | 5 | `34-session-analytics-telemetry.md` |
| 35 | Game Director & Regression | Director/Sessions | 0 | 2 | 2 | 1 | 5 | `35-game-director-regression.md` |
| 09 | Progression & Save Systems | Progression/World | 0 | 1 | 3 | 1 | 5 | `09-progression-save-systems.md` |
| 10 | Animation & Rigging | Visual Content | 0 | 1 | 3 | 1 | 5 | `10-animation-rigging.md` |
| 11 | Level & Materials Authoring | Visual Content | 0 | 1 | 4 | 0 | 5 | `11-level-materials-authoring.md` |
| 16 | Item Pipeline Steps | Catalog→UE | 0 | 1 | 3 | 1 | 5 | `16-item-pipeline-steps.md` |
| 24 | AI Behavior & Squad Tactics | AI/Build/Pkg | 0 | 1 | 3 | 1 | 5 | `24-ai-behavior-squad-tactics.md` |
| 28 | Prompt Evolution & A/B Testing | Prompt Eng | 0 | 1 | 3 | 1 | 5 | `28-prompt-evolution-a-b-testing.md` |

---

## All 67 high-severity findings — one-line summary (grouped by theme)

### A. React re-render / unstable refs / selectors (13 high; 42 total)
1. **Abilities & GAS** — `spellbookData` recomputes all 7 live transforms on every sync-state toggle. `sub_ability/index.tsx:75-111`
2. **Abilities & GAS** — search index rebuilt + full substring scan on every keystroke, no debounce. `sub_ability/SpellbookSearch.tsx:19-26`
3. **Inventory** — `TradingCard` unmemoized + fresh closures every render → whole grid re-animates per keystroke. `sub_inventory/catalog/CatalogItemGrid.tsx:40`
4. **Loot & Affix** — loot-table editor live-preview bar renders ALL entries, ignoring pagination. `sub_loot/affix/LootTableEditor.tsx:187-193`
5. **Bestiary** — all archetype filter state in the parent → every tab re-renders on each keystroke. `sub_bestiary/index.tsx:48-66`
6. **World/Procgen** — slider ticks re-render the entire animated map + topology SVG subtree. `sub_world/index.tsx:60-64`
7. **Progression/Save** — `BudgetAlerting` recomputes linear-regression projections + nested lookups every render over static data. `sub_save/schema/BudgetAlerting.tsx:39`
8. **Animation** — O(E²) reverse-edge scan inside the per-edge render loop (both graph canvases; fires on drag). `AnimationStateMachine.tsx:715`, `StateMachineEditor.tsx:830`
9. **Layout Lab** — `useEntityArtifacts` memo busted every render for non-Items catalogs → full rollup recompute. `layout-lab/Baseline.tsx:78`
10. **Project Health** — `HolisticHealthView` re-POSTs `/api/project-health` on every store touch via unstable effect. `evaluator/HolisticHealthView.tsx:115-121`
11. **Quality Eval** — `emitProgress` deep-clones passStatuses + spreads findings ~140×/scan. `evaluator/deep-eval-engine.ts:129`
12. **App Shell** — every CLI session mutation re-renders every L2 sidebar badge + tab bar + bottom panel. `layout/SidebarL2.tsx:371`
13. **UE5 Bridge** — every WS message rewrites the whole snapshot into Zustand + unconditional 1 Hz FPS store write. `ue5-bridge/ws-live-state.ts:300-303`

### B. Duplicated / diverged logic (12 high; 22 total)
14. **Combat** — damage formula + fight loop **triplicated** across 3 engines and they have already drifted (AoE predicate, rounding, double-applied multiplier). `combat/simulation-engine.ts:42` · `predictive-balance.ts:79` · `choreography-sim.ts:81`
15. **Bestiary** — two parallel behavior-tree data models for the same tree. `sub_bestiary/_shared/data.ts:494-529`
16. **World/Procgen** — quest generator rebuilds adjacency + O(n²) array scans over scanned project data. `quest-generator.ts:428-468`
17. **Level/Materials** — two fully-duplicated post-process effect systems (already disagree 7 vs 10). `materials/PostProcessStackBuilder.tsx:51` · `post-process-studio/effects.ts:11`
18. **Audio** — module-review CLI plumbing duplicated verbatim across module views. `content/audio/AudioView.tsx:110-210`
19. **Item Pipeline Steps** — each of ~10 step components repeats identical StepFrame + acceptance + Produce wiring. `layout-lab/steps/ItemConceptBrief.tsx:20`
20. **AI Testing/Loc** — localization `full-pipeline` re-scans/re-filters the same corpus 5× per request. `api/localization-pipeline/route.ts:78-98`
21. **Prompt Construction** — Ability Forge prompt bypasses the entire shared context system (the one `auditPromptString` exists to catch). `prompts/ability-forge.ts:209-281`
22. **Prompt Construction** — boilerplate `extraRules`/best-practice strings copy-pasted across ~10 builders with drift. `prompts/audio-scene.ts:12`
23. **Project Setup** — `useProjectScan` lists `<project>\Source` twice per scan. `project-setup/useProjectScan.ts:154`
24. **UE5 Bridge** — two connection managers, opposite execution models, no shared lifecycle abstraction. `pof-bridge/connection-manager.ts:24` · `ue5-bridge/connection-manager.ts:24`
25. **Game Director** — re-processing a session spawns duplicate regression alerts (no dedup key on insert). `regression-tracker.ts:225`

### C. DB N+1 / over-fetch / repeated queries (10 high; 18 total)
26. **Visual Asset Gen** — `searchPolyHaven` fetches the entire catalog on every search, filters client-side. `visual-gen/asset-sources.ts:39`
27. **Audio** — `GET /api/audio-gen` N+1 query per set on every library open/refresh. `api/audio-gen/route.ts:118-122`
28. **Pipeline Artifacts** — `executor.available()` called per-job inside the drain loop → N UE round-trips per pass. `test-gate-runner/drain.ts:119`
29. **GDD Compliance** — `runComplianceAudit` issues 2×N redundant SQL + double-reads feature_matrix. `gdd-compliance.ts:235`
30. **AI Testing/Loc** — per-keystroke scenario edit fires PUT + double full-suite refetch (and clobbers local input). `game-systems/AIBehaviorView.tsx:111-116`
31. **AI Testing/Loc** — `handleRunTests` / failure-reset loops fire N sequential PUTs, each a full refetch. `game-systems/AIBehaviorView.tsx:160-170`
32. **Build/Cook** — `getBuildStats` runs an N+1 per-platform query inside a map. `packaging/build-history-store.ts:202-206`
33. **Session Analytics** — `getDashboard()` issues 1+2N queries, two of which full-scan every row per module. `session-analytics-db.ts:392-429`
34. **Session Analytics** — `getPromptQualityScore` loads the entire module history to read 20 rows. `session-analytics-db.ts:207-209`
35. **Game Director** — FindingsExplorer fan-out: one HTTP request per completed session, re-fired on every refresh (batch path exists, unused). `game-director/FindingsExplorer.tsx:52`

### D. Algorithmic complexity / hot loops (10 high; 14 total)
36. **Combat** — per-action array allocation inside the simulation tick loop. `combat/simulation-engine.ts:205`
37. **Character/Genome** — `optimize()` brute-forces O(n²) simplex when the objective is linear (optimum is always a vertex). `sub_character/attributes/data.ts:105`
38. **Economy** — `computeMetrics` full sort + double reduce every hour, then ~half results discarded. `economy/simulation-engine.ts:301-329`
39. **Economy** — `trackSupplyDemand` iterates full item list per-agent-per-hour with Map churn (~2.1M iterations). `economy/simulation-engine.ts:278-297`
40. **Loot & Affix** — Monte-Carlo simulator retains every rolled item (up to 100k) for no consumer. `loot-designer/drop-simulator.ts:210-213`
41. **Blender MCP** — `onData` re-parses the entire growing buffer per TCP chunk → O(n²) on large payloads. `blender-mcp/service.ts:197-209`
42. **Layout Lab** — `deriveEntityArtifacts` resolves acceptance with an O(steps²) registry walk. `layout-lab/hooks/useEntityArtifacts.ts:52-62`
43. **Module Registry** — NBA dependent-count: O(features≈190) scan nested in O(items)×O(modules≈40), every render. `nba-engine.ts:147`
44. **Prompt Evolution** — agglomerative clustering is O(n³) — full pairwise rescan every merge, on a blocking route. `prompt-evolution/clustering.ts:93`
45. **Blueprint Transpiler** — `generateNodeLogic` exec-edge traversal matches pin IDs against node IDs/pin names — both wrong and O(n²·pins). `blueprint-cpp-codegen.ts:378`

### E. Dead code (unwired / orphaned) (7 high; 21 total)
46. **Character/Genome** — entire genome-editor + attribute-optimizer vertical slice orphaned (never imported). `sub_character/genome/CharacterGenomeEditor.tsx:36`
47. **Blender MCP** — connection "connected" state goes stale forever; health-check constant + `refreshStatus` defined but wired to nothing. `blender-mcp/service.ts:104`, `constants.ts:143`, `blenderMCPStore.ts:157`
48. **Crash Analysis** — imported crash logs are a dead-end: never pattern-matched, never re-stat'd, never persisted. `crashAnalyzerStore.ts:76-105`
49. **Build/Cook** — size-budget/regression gate is dead code in the interactive cook path (only the nightly scheduler uses it). `api/packaging/execute/route.ts:65-74`
50. **Module Registry** — `DependencyInfo.chain` transitive BFS is dead computation kept alive by one test. `feature-definitions.ts:466`
51. **Project Setup** — `UE5RemoteController` + `LiveCodingPanel` (~1,360 LOC) are dead — never mounted. `project-setup/UE5RemoteController.tsx:605`
52. **Blueprint Transpiler** — duplicated/diverged `generateEffectsCode`; live copy emits a misleading `// Period:` line the canonical (dead) copy was fixed to drop. `gas-codegen.ts:119`

### F. Resource leaks / cleanup / lifecycle (6 high; 13 total)
53. **Inventory** — grid uses two sources of truth: static `DUMMY_ITEMS` for content, store `entries` only for lifecycle (Add Item is dead). `sub_inventory/catalog/CatalogGearTab.tsx:44`
54. **Visual Asset Gen** — MCP poll callback overlaps itself → concurrent in-flight requests on a single job + state-flip race. `visual-gen/asset-forge/useForgeStore.ts:157`
55. **Pipeline Artifacts** — drain worker `cooldownUntil` map grows unbounded, never evicts. `test-gate-runner/worker.ts:36`
56. **CLI Terminal** — server-side execution/session maps grow unbounded; cleanup helpers defined but never called; per-run stdout duplicated in events. `claude-terminal/cli-service.ts:351`
57. **Harness Builder** — dev-server subprocess leaks on every error path and is unkillable on Windows (`shell:true` spawn orphans `next dev`). `harness/orchestrator.ts:849`
58. **Harness Builder** — visual gate re-spawns a full Playwright `npx` run + browser per area inside the verify loop. `harness/visual-gate.ts:262-269`

### G. Other high (3 high; 13 total — DDL/serial/governor)
59. **Crash Analysis** — every error-memory / pattern-library read re-runs DDL (CREATE TABLE/INDEX/PRAGMA/ALTER) on the hot path. `error-memory-db.ts:147-196`
60. **Quality Eval** — deep-eval runs every module × pass (~69 passes) strictly serially, no concurrency. `evaluator/deep-eval-engine.ts:139`
61. **Harness Builder** — budget governor overshoots cap by up to (maxConcurrent−1) sessions (cost booked only after return). `harness/orchestrator.ts:614-643`

### H. Missing memoization / redundant recompute (3 high; 12 total)
62. **Combat** — `computeSummary` makes ~12 full passes over the fights array + redundant re-sorts. `combat/simulation-engine.ts:493`
63. **AI Behavior/Squad** — coverage heatmap O(segments×points) nearest-point scan + unmemoized derivations on hover. `game-systems/TacticalCoverAnalysis.tsx:226`
64. **App Shell** — `GlobalSearchPanel` rebuilds the entire FTS5 index synchronously on every open. `layout/GlobalSearchPanel.tsx:66`

### I. Correctness / state hazards / missing wiring (2 high; 16 total)
65. **Project Health** — overall-completion denominator disagrees with weekly digest + digest client count (dashboards show divergent progress). `health-engine.ts:27`
66. **GDD Compliance** — `resolve-gap` mutates a shared server-side singleton → cross-client/cross-project corruption (round-trip is pure hazard; store already holds the report). `api/gdd-compliance/route.ts:6`

### J. Structure / SRP / coupling (1 high; 5 total)
67. **CLI Terminal** — `buildTaskPrompt` is a 540-line switch mixing prompt text, callback registration, and per-type asset logic. `cli-task.ts:459-1000`

---

## Triage themes

| Theme | Total | High | Why this is a wave, not just individual fixes |
|---|---:|---:|---|
| React re-render / unstable refs / selectors | 42 | 13 | Same memo/selector discipline applies everywhere; one mental model (stabilize refs, narrow Zustand selectors, lift filter state down, `React.memo` list items). |
| Duplicated / diverged logic | 22 | 12 | Consolidation work — needs behavior-parity care. Riskier; the triplicated damage formula must keep all 3 views agreeing. |
| Dead code (unwired / orphaned) | 21 | 7 | Mostly pure deletions / one-line wiring. Lowest risk, immediate clarity, shrinks the surface for every later wave. |
| DB N+1 / over-fetch / repeated queries | 18 | 10 | Server-side query consolidation, contained to `*-db.ts` / route files. High value, low UI risk. |
| Correctness / state hazards / missing wiring | 16 | 2 | Shared-mutable singletons, duplicate-insert, denominator mismatches — bug-shaped, fix individually but share a "trust the store / dedup the write" model. |
| Algorithmic complexity / hot loops | 14 | 10 | Localized algorithmic rewrites (O(n²)→O(n), drop dead arrays). High value, each fix is self-contained and testable. |
| Resource leaks / cleanup / lifecycle | 13 | 6 | Subprocess/socket/timer/map lifecycle — stability theme. Higher care (spawn behavior, eviction) but contained. |
| Missing memoization / redundant recompute | 12 | 3 | Overlaps with re-render theme; fold the perf-only recompute fixes in with Wave on re-renders or queries. |
| Other (DDL-on-hot-path, serial exec, governor) | 13 | 3 | Cross-cutting — the per-call DDL pattern recurs across many DB modules; worth one sweep. |
| Structure / SRP / coupling | 5 | 1 | Larger refactors (540-line switch); defer unless a feature needs to touch them. |

---

## Suggested next-phase split (wave plan)

Each wave = one focused session (5–7 fixes, single mental model). Ordered low-risk-high-clarity first, riskier consolidation last.

- **Wave 1 — Dead code purge (7 fixes).** #46, #50, #51, #52 (pure deletions: orphaned genome slice, dead BFS chain, 1,360-LOC UE5 panels, dead codegen copy) + wire-or-cut decisions for #48 (crash-log dead-end), #49 (size-budget gate), #47 (stale connection state). Lowest risk, shrinks surface for later waves.
- **Wave 2 — DB N+1 / over-fetch (7 fixes).** #27, #28, #29, #32, #33, #34, #35 — collapse N+1s into single queries, use existing batch paths. Contained to db/route files, no UI risk.
- **Wave 3 — Algorithmic hot loops (6 fixes).** #37 (simplex→vertex), #44 (O(n³) clustering), #40 (drop 100k-item array), #38/#39 (economy sim), #41 (TCP buffer reparse). Self-contained, high value, testable.
- **Wave 4 — React re-render, batch 1 (6 fixes).** #3, #4, #5, #6, #9, #43 — list-item memoization + lift filter state down + stabilize derived refs.
- **Wave 5 — React re-render, batch 2 (7 fixes).** #1, #2, #7, #10, #11, #12, #13 — selector narrowing, debounce, drop unconditional store writes.
- **Wave 6 — Resource leaks / lifecycle (6 fixes).** #54, #55, #56, #57, #58, #59 — poll overlap, unbounded maps, subprocess leak, per-call DDL sweep.
- **Wave 7 — Correctness + diverged logic (5–7 fixes).** #66 (shared singleton), #25/#35-dup (duplicate alert), #65 (denominator), then the higher-care consolidation #14 (triplicated damage formula), #17 (post-process dup). Riskiest — keep behavior parity, run targeted tests.

Mediums (82) and lows (27) are folded into their theme waves opportunistically (a re-render wave will sweep nearby medium re-renders in the same file). A second pass can target mediums after the highs are closed.

---

## How this scan was run

- **Scanners:** combined `zen-architect` (structural/simplicity) + `perf-optimizer` (speed/efficiency) role prompts from Vibeman's registry (`src/lib/prompts/registry/agents/{zen-architect,perf-optimizer}.ts`), fused into one lens per subagent.
- **Findings cap:** top-5 highest-value per context (value = impact × confidence relative to effort & risk), spanning both lenses, no forced quota. Padding with trivia explicitly disallowed.
- **Scope:** all 35 contexts (12 groups), full file lists from Vibeman's context map (543 scoped file paths; subagents pulled in load-bearing neighbors as needed).
- **Method:** 35 isolated `general-purpose` subagents, 5 waves of ≤8, each read its scope file + source files and wrote one report; orchestrator read only terse replies.
- **Baseline (Phase B2):** `tsc --noEmit` = 0 errors. (Test/lint baselines to be captured before the first fix wave.)
- **Verification:** two-way — `> Total:` header sum (176) = `## N.` heading count (176) = `Severity` bullet count (176). 0 mismatches across 35 files.
- **Date:** 2026-06-14. Project: `pof` (Next.js 16 / React 19 / TS / Zustand v5 / better-sqlite3 / Tailwind 4).
