# Bug Hunter Scan — pof, 2026-06-09

> Elite systems-failure audit of the entire pof codebase (Next.js 16 / React 19 / TS / zustand / better-sqlite3 / three.js).
> 35 parallel subagent runs, batched in 5 waves of ≤8. Exactly 4 findings per context (the 4 highest-severity real bugs).

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 35 contexts | 18 | 70 | 52 | 0 | **140** |
| Share | 13% | 50% | 37% | 0% | 100% |

Counts verified two ways (`> Total:` header sum = `- **Severity**:` bullet count = parsed records = **140**).

Baseline health (for the Phase B7 regression gate): **tsc 0 errors**, **eslint 0 errors**, tests **3926 pass / 14 fail (pre-existing) / 1 skip**.

---

## Per-context breakdown

Sorted by criticals desc, then total. Every context capped at 4 findings.

| # | Context | Group | C | H | M | Report |
|---|---|---|---:|---:|---:|---|
| 1 | Abilities & GAS System | Character & Combat Authoring | 1 | 2 | 1 | [abilities-gas-system.md](abilities-gas-system.md) |
| 2 | AI Testing & Localization | AI, Build & Packaging | 1 | 2 | 1 | [ai-testing-localization.md](ai-testing-localization.md) |
| 3 | Audio Generation & Scenes | Audio & Blender Pipeline | 1 | 2 | 1 | [audio-generation-scenes.md](audio-generation-scenes.md) |
| 4 | Blender MCP Integration | Audio & Blender Pipeline | 1 | 2 | 1 | [blender-mcp-integration.md](blender-mcp-integration.md) |
| 5 | Build, Cook & Packaging | AI, Build & Packaging | 1 | 2 | 1 | [build-cook-packaging.md](build-cook-packaging.md) |
| 6 | CLI Terminal & Task System | CLI Terminal & Module Shell | 1 | 3 | 0 | [cli-terminal-task-system.md](cli-terminal-task-system.md) |
| 7 | Combat & Damage Tuning | Character & Combat Authoring | 1 | 2 | 1 | [combat-damage-tuning.md](combat-damage-tuning.md) |
| 8 | Crash Analysis & Pattern Library | Quality Evaluator & Health | 1 | 2 | 1 | [crash-analysis-pattern-library.md](crash-analysis-pattern-library.md) |
| 9 | Economy & Balance Simulation | Items, Loot & Economy | 1 | 2 | 1 | [economy-balance-simulation.md](economy-balance-simulation.md) |
| 10 | Game Director & Regression | Director, Sessions & Autonomy | 1 | 2 | 1 | [game-director-regression.md](game-director-regression.md) |
| 11 | GDD Compliance & Design Doc | Quality Evaluator & Health | 1 | 1 | 2 | [gdd-compliance-design-doc.md](gdd-compliance-design-doc.md) |
| 12 | Harness Autonomous Builder | Director, Sessions & Autonomy | 1 | 3 | 0 | [harness-autonomous-builder.md](harness-autonomous-builder.md) |
| 13 | Item Pipeline Steps | Catalog to UE Pipeline | 1 | 1 | 2 | [item-pipeline-steps.md](item-pipeline-steps.md) |
| 14 | Module Registry & Feature Matrix | CLI Terminal & Module Shell | 1 | 2 | 1 | [module-registry-feature-matrix.md](module-registry-feature-matrix.md) |
| 15 | Project Health & Insights | Quality Evaluator & Health | 1 | 2 | 1 | [project-health-insights.md](project-health-insights.md) |
| 16 | Prompt Evolution & A/B Testing | Prompt Engineering | 1 | 2 | 1 | [prompt-evolution-a-b-testing.md](prompt-evolution-a-b-testing.md) |
| 17 | UE5 Bridge & Live Sync | UE5 Integration & Project Setup | 1 | 2 | 1 | [ue5-bridge-live-sync.md](ue5-bridge-live-sync.md) |
| 18 | World, Quests & Procgen | Progression, World & Bestiary | 1 | 2 | 1 | [world-quests-procgen.md](world-quests-procgen.md) |
| 19 | Inventory System | Items, Loot & Economy | 0 | 3 | 1 | [inventory-system.md](inventory-system.md) |
| 20 | Project Setup & Onboarding | UE5 Integration & Project Setup | 0 | 3 | 1 | [project-setup-onboarding.md](project-setup-onboarding.md) |
| 21 | Quality Evaluation Engine | Quality Evaluator & Health | 0 | 3 | 1 | [quality-evaluation-engine.md](quality-evaluation-engine.md) |
| 22 | AI Behavior & Squad Tactics | AI, Build & Packaging | 0 | 1 | 3 | [ai-behavior-squad-tactics.md](ai-behavior-squad-tactics.md) |
| 23 | Animation & Rigging | Visual Content Generation | 0 | 2 | 2 | [animation-rigging.md](animation-rigging.md) |
| 24 | App Shell & Navigation | CLI Terminal & Module Shell | 0 | 2 | 2 | [app-shell-navigation.md](app-shell-navigation.md) |
| 25 | Bestiary & Enemy Design | Progression, World & Bestiary | 0 | 2 | 2 | [bestiary-enemy-design.md](bestiary-enemy-design.md) |
| 26 | Blueprint Transpiler & C++ Codegen | UE5 Integration & Project Setup | 0 | 1 | 3 | [blueprint-transpiler-c-codegen.md](blueprint-transpiler-c-codegen.md) |
| 27 | Character & Genome Designer | Character & Combat Authoring | 0 | 2 | 2 | [character-genome-designer.md](character-genome-designer.md) |
| 28 | Layout Lab & Pipeline Steps | Catalog to UE Pipeline | 0 | 2 | 2 | [layout-lab-pipeline-steps.md](layout-lab-pipeline-steps.md) |
| 29 | Level & Materials Authoring | Visual Content Generation | 0 | 1 | 3 | [level-materials-authoring.md](level-materials-authoring.md) |
| 30 | Loot & Affix System | Items, Loot & Economy | 0 | 2 | 2 | [loot-affix-system.md](loot-affix-system.md) |
| 31 | Pipeline Artifacts & Test Gates | Catalog to UE Pipeline | 0 | 2 | 2 | [pipeline-artifacts-test-gates.md](pipeline-artifacts-test-gates.md) |
| 32 | Progression & Save Systems | Progression, World & Bestiary | 0 | 2 | 2 | [progression-save-systems.md](progression-save-systems.md) |
| 33 | Prompt Construction & Context | Prompt Engineering | 0 | 2 | 2 | [prompt-construction-context.md](prompt-construction-context.md) |
| 34 | Session Analytics & Telemetry | Director, Sessions & Autonomy | 0 | 2 | 2 | [session-analytics-telemetry.md](session-analytics-telemetry.md) |
| 35 | Visual Asset Generation | Visual Content Generation | 0 | 2 | 2 | [visual-asset-generation.md](visual-asset-generation.md) |

---

## All 18 critical findings — one-line summary

Grouped into themes for triage. Each links to its full entry in the per-context report.

### A. Security — privileged surface with no defense (2)
1. **UE5 Bridge — Command injection via headless build.** `executeBuild` spawns UnrealBuildTool with `shell: true` and interpolates unsanitized `projectPath`/`targetName`/`additionalArgs`; the route validates only non-emptiness → arbitrary host command execution. `src/lib/ue5-bridge/build-pipeline.ts:129`
2. **Audio — Path traversal in asset GET.** The guard `abs.startsWith(normalize(AUDIO_DIR))` is a separator-less prefix check that never rejects `..`, so `relPath` can read arbitrary files. `src/app/api/audio-asset/route.ts:11`

### B. Unvalidated trust boundaries — NaN/unbounded inputs poison sims & UE codegen (3)
3. **Abilities & GAS — Imported scenario crashes/hangs the simulator.** The validator only checks `isFinite`, never bounds → `count:1e9` OOMs, `attackSpeed:0` → `1/0=Infinity` non-terminating loop, negative armor → NaN; renders "Valid", then crashes/hangs on Run. `src/.../sub_ability/gas-balance/data.ts`
4. **Economy — No lower-bound/NaN guard on sim config.** Route clamps only upper bounds; `agentCount:0`/`maxLevel:0` reaches the engine, divides `0/0`, and poisons every metric, alert, and the emitted "calibrated" UE5 C++ with NaN/undefined. `src/app/api/economy-simulator/route.ts:38`
5. **GDD — Out-of-range room difficulty kills GDD generation.** `'○'.repeat(5 - difficulty)` with a negative/NaN count throws `RangeError`; the sibling `getSummary` clamps this exact field, the synthesizer doesn't. `src/lib/gdd-synthesizer.ts:379`

### C. Atomicity & write races — read-modify-write / multi-table writes with no transaction (3)
6. **Game Director — `processSession` mutates four tables with no transaction.** Mid-loop failure leaves regression history half-written and self-inconsistent (sibling writes all use `db.transaction`). `src/lib/regression-tracker.ts:136`
7. **Prompt Evolution — A/B trial recording is non-atomic RMW.** Concurrent trial submissions silently lose increments, corrupting the verdict so a worse variant can be declared winner. `src/lib/prompt-evolution/engine.ts:232`
8. **Module Registry — CLI-completed checklist items silently overwritten.** Store autosave rewrites the whole `checklist_json` blob from stale localStorage, clobbering items the CLI marked done out-of-band (last-writer-wins). `src/app/api/checklist/complete/route.ts:44`

### D. Concurrency on shared singletons & process lifecycle (3)
9. **Blender MCP — Concurrent commands cross-wire on one shared socket.** Per-call `data` listeners with no request/response correlation; overlapping route handlers resolve with each other's payloads, corrupting scene/status/import data with no crash. `src/lib/blender-mcp/service.ts:117`
10. **CLI Terminal — Abort closes the stream but never kills the Claude process.** The `executionId` is discarded client-side, so orphaned editors keep editing files and burning tokens until the 100-min timeout; retries stack concurrent processes. `src/components/cli/useTaskQueue.ts:477`
11. **Harness — Checkpoint `git reset --hard` runs during concurrent sibling writes.** Default concurrency is 4, not the sequential mode the rollback assumes → wipes siblings' uncommitted work and corrupts the tree. `src/lib/harness/orchestrator.ts:382`

### E. Logic-correctness defects that corrupt the headline output (4)
12. **Combat — Player armor squared, enemy armor scaled by a damage knob.** `calculateDamage` re-applies `playerArmorMul` on top of already-scaled armor and scales enemy armor by `enemyDamageMul`, so every survival/DPS/alert number is wrong once any slider leaves 1.0. `src/lib/combat/simulation-engine.ts:58`
13. **Crash Analysis — Anti-pattern keywords match unanchored substrings.** Generic 4+ char keywords matched with `includes()` trip false "this approach failed 85% — switch?" warnings on unrelated prompts, eroding trust in the guardrail. `src/lib/pattern-library-db.ts:639`
14. **Item Pipeline — Stale-closure double-produce drops a whole batch.** Rapid Produce reads the same render's `history` closure and re-derives the batch id from `batches.length`, so the second dispatch overwrites the first instead of appending. `src/components/layout-lab/steps/ItemArt.tsx:27`
15. **World/Quests — Every quest's "Tell me more" choice points to a non-existent node.** `nextNodeId` is a fresh `did()` id whose node is never pushed → dangling pointer in 100% of quests that dead-ends any dialogue walker. `src/lib/quest-generator.ts:372`

### F. Schema / data-integrity landmines (2)
16. **AI Testing — `ON DELETE CASCADE` silently no-ops.** SQLite `foreign_keys` is never enabled on the shared connection, so deleting a suite orphans scenario rows forever; whether cascade works is non-deterministic across module init order. `src/lib/ai-testing-db.ts:36`
17. **Project Health — Mixed `completed_at` timestamp formats break week filtering.** App writes ISO `T`-format; the column default `datetime('now')` writes space-separated; the lexicographic `>= ?` range filter silently drops space-format rows for the whole week. `src/lib/weekly-digest.ts:42`

### G. Silent failure on a safety gate (1)
18. **Build/Cook — Cook always records `sizeBytes: 0`.** `evaluateBuildSize` returns null for size ≤ 0, silently disabling the entire size-budget gate on every real cook; trends/stats only reflect hand-entered builds. `src/lib/packaging/cook-executor.ts:135`

---

## Triage themes

13 cross-cutting patterns detected by clustering the 140 findings' categories + scenarios. Category mix overall: logic-error 37, silent-failure 31, state-corruption 25, edge-case 19, data-loss 12, race-condition 11, resource-leak 5.

| Theme | ~Count | Why this is a wave, not just individual fixes |
|---|---:|---|
| **T1. Unvalidated trust boundaries** (import/config/API → NaN/negative/unbounded) | ~16 | One shared fix shape: clamp + integer + finite guards at the boundary; the project already has correct clamps in sibling code to copy. |
| **T2. Non-atomic writes & RMW races** (no transaction / check-then-act) | ~10 | All fixed by wrapping in `db.transaction` or atomic SQL `UPDATE … SET x = x + 1`; same mental model across DB modules. |
| **T3. Silent failure / success theater** (swallowed errors, fake "done"/"healed"/"written") | ~18 | Each needs a real status surfaced; one error-handling convention applied repeatedly. |
| **T4. Optimistic update without rollback / stale entity** | ~7 | Add a cancellation/entity-token guard + rollback-on-reject; one pattern. |
| **T5. Concurrency on shared singletons** (sockets, connections, processes) | ~6 | Request/response correlation + lifecycle teardown; deep but single domain. |
| **T6. UE5 C++/CSV codegen correctness** (escaping, regex, type maps, enum dups) | ~7 | All about making generated UE code provably valid; shared escaping/validator helpers. |
| **T7. Determinism / seeded-RNG** (signed shift, `Math.random` in "seeded" paths, order-dependence) | ~5 | Centralize on the one correct seeded RNG and thread the seed; shared fix. |
| **T8. React stale closures** (mount-only state, `useState` init from async store) | ~5 | Same `useEffect`/ref/`useSyncExternalStore` discipline applied per component. |
| **T9. Divide-by-zero / NaN math** (sim formulas, economy gates) | ~6 | Guard denominators + `Number.isFinite` on outputs; overlaps T1 but lives in compute, not boundary. |
| **T10. Timestamp / timezone format** (UTC parsed local, mixed formats, lexicographic ranges) | ~4 | One normalization helper for stored timestamps + range queries. |
| **T11. Cross-project / cross-module state contamination** (state not cleared on switch, missing `module_id` filter) | ~3 | Scope resets + key all queries by the owning entity; shared invariant. |
| **T12. Dead / unwired features** (toggles with no handler, stored-but-never-read columns) | ~5 | Either wire them or remove them; these are "success theater" at the UI layer. |
| **T13. Security hardening** (path traversal, command injection) | ~2 | Both are privileged surfaces missing a standard defense; treat as their own gate. |

---

## Suggested next-phase split (7 fix waves)

Each wave is one focused session (~5–7 fixes, single mental model) so per-fix context stays warm and the fixes compound.

- **Wave 1 — Trust-boundary input validation (T1 + T9 crits).** GAS scenario import (#3), economy config bounds (#4), GDD room difficulty (#5), genome `sanitizeProfile`, DropWeight import, level-design difficulty, `asZone` connections cast. *Highest crash/corruption payoff; the project already has reference clamps to copy.*
- **Wave 2 — Atomicity & write races (T2 + T4).** regression-tracker transaction (#6), A/B trial atomic counter (#7) + active-flag uniqueness, module checklist last-writer-wins (#8), idempotency check-then-act, audio scene lost-update, pipeline `applyLifecycle` rollback.
- **Wave 3 — Silent failure / success theater on safety gates (T3).** cook `sizeBytes` (#18) + size-gate, harness budget no-op + self-heal-without-verify, item "produce reports success", `postArtifact` fire-and-forget, `autoUpdateFeatureMatrix` ignores write result, clipboard "Copied!" on reject.
- **Wave 4 — Shared-singleton concurrency & process lifecycle (T5).** Blender socket correlation (#9), CLI abort must kill the spawned process (#10), UE5 connection-manager timer/state leak, harness `git reset --hard` vs concurrency (#11).
- **Wave 5 — UE5 codegen correctness (T6).** genome CSV/identifier escaping (uses the unused hardened `@/lib/genome/codegen.ts`), GAS tag-name sanitize, `cpp-semantic-parser` nested `Meta=(…)` regex, `blueprintTypeToCpp` fallback, state-machine duplicate-enum lint, bestiary `applyModifiers` clamp divergence.
- **Wave 6 — Security hardening (T13).** audio-asset path traversal (#2), UE5 build-pipeline command injection (#1), plus a sweep of the other API routes for the same prefix-check / `shell:true` shapes.
- **Wave 7 — Determinism, timestamps, stale closures & contamination (T7 + T8 + T10 + T11 + T12).** loot xorshift `>>>`, quest/fetch `Math.random` → seeded, timestamp normalization (#17 + prompt-construction UTC + app-shell `getTimePeriod`), React stale closures (#14, genome compare, app-shell rehydration gate), cross-project checklist + `markResolved` module scope, dead-feature wiring.

Criticals are distributed across Waves 1–6; doing Waves 1–4 closes 14 of the 18 criticals.

---

## How this scan was run

- **Scanner:** `bug_hunter` (Bug Hunter — "Elite systems failure analyst") from Vibeman's `src/lib/prompts/registry/agents/bug-hunter.ts`.
- **Date:** 2026-06-09. **Project:** pof (`C:\Users\kazda\kiro\pof`), id `994c4d7f-5b3e-42be-b345-ef6421f4ee3e`.
- **Scope:** all 35 contexts across 12 groups (full coverage). No `src-tauri/` exists — the project is pure client/Next.js, so no side-scope split applied.
- **Method:** 35 isolated `general-purpose` subagents, 5 waves of ≤8, each given the Bug Hunter role, its context's `filePaths` (from `_contexts.json`), and a hard cap of exactly 4 findings (the 4 highest-severity real bugs). Each wrote one structured report; the orchestrator read only terse reply summaries during scanning.
- **Files read:** ~580 across all subagents (avg ~16.5 per context, including in-scope dependencies each agent pulled in).
- **Verification:** findings counted two independent ways — sum of `> Total:` headers (140) and count of `- **Severity**:` bullets (140) — and reconciled against 140 parsed records. Match.
- **Caveat:** subagents flagged a handful of stale `filePaths` entries in the context manifest (barrel files that no longer exist, e.g. `visual-gen/asset-browser/index.ts`, `visual-gen/auto-rig/index.ts`, `knowledge/index.ts`, some `FeatureCard`/`FeatureMatrix`/`ResizeHandle` paths); they audited the real files instead. Worth refreshing those contexts in Vibeman.
