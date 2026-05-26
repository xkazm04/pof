# Module System

Every UI panel, checklist, prompt, and quality evaluation in PoF is anchored to a **module** — a game-development domain such as `arpg-combat` or `materials`. Three static registries define what each module contains and what drives it at runtime. A fourth layer (the NBA engine) wires those registries together into actionable recommendations.

---

## Key Files

| Path | Responsibility |
|------|---------------|
| `src/types/modules.ts` | `SubModuleId` union literal, `ChecklistItem`, `QuickAction`, `KnowledgeTip`, `SubModuleDefinition`, `CategoryDefinition`, `ModuleSchema` types |
| `src/lib/module-registry.ts` | All `SubModuleDefinition` objects (checklists, quick actions, knowledge tips), `CATEGORIES`, `SUB_MODULE_MAP`, `ARPG_SUB_MODULES`, helper lookups |
| `src/lib/feature-definitions.ts` | `MODULE_FEATURE_DEFINITIONS` (per-module `FeatureDefinition[]` with `dependsOn`), `MODULE_PREREQUISITES`, `buildDependencyMap`, `computeBlockers`, `getRecommendedNextModules`, `getUnmetPrerequisites` |
| `src/lib/evaluator/module-eval-prompts.ts` | `MODULE_CONTEXTS` (per-module eval focus + pass checks), `EVAL_PASSES`, `buildEvalPrompt`, `getPassesForModule` |
| `src/lib/nba-engine.ts` | `computeNBA` — the Next Best Action engine; reads all three registries plus Zustand stores |
| `src/hooks/useNBA.ts` | React hook wrapping `computeNBA` with feature-status API fetch |
| `src/components/modules/shared/RecommendedNextBanner.tsx` | UI consumer of `getRecommendedNextModules` (module-level recommendations) |
| `src/components/modules/shared/RoadmapChecklist.tsx` | UI consumer of `MODULE_PREREQUISITES` |

---

## How It Works

### 1. Identity — `SubModuleId` (`src/types/modules.ts:6–51`)

The canonical `SUB_MODULE_IDS` const array lists every module slug. The derived union type `SubModuleId = (typeof SUB_MODULE_IDS)[number]` is the single source of type identity across the codebase. Adding a new module requires adding its slug here first — the comment in the file (`ModuleSchema`) describes the five domains that must stay in sync: type identity, registry entry, feature graph, store key, and component factory.

### 2. Registry 1 — Sub-module definitions (`src/lib/module-registry.ts`)

`ARPG_CHECKLISTS` (line 22) and `ARPG_QUICK_ACTIONS` are declared as plain `Record<string, ChecklistItem[]>` and `Record<string, QuickAction[]>` objects, then **referenced by the `SUB_MODULES` array** of `SubModuleDefinition` objects. The flat `SUB_MODULE_MAP` dictionary and `CATEGORY_MAP` are built from those arrays at module load time (lines 1217–1220).

Each `SubModuleDefinition` carries:

- `id: SubModuleId` — the slug
- `categoryId: CategoryId` — determines which sidebar group it appears in
- `checklist?: ChecklistItem[]` — ordered steps, each with `{ id, label, description, prompt }` plus optional `dependsOn` (other checklist item IDs in the same module), `features` (feature names from registry 2), `visualCheck`, `lightingCheck`, `characterCheck` flags
- `quickActions: QuickAction[]` — one-shot prompts without progress tracking
- `knowledgeTips: KnowledgeTip[]` — **UI only**; shown as banners in `ModuleShell.tsx` (line 124) and never injected into dispatch prompts (see Conventions below)
- `feasibilityRating?: 'strong' | 'moderate' | 'challenging'` — controls feasibility banner display

`CATEGORIES` (line 373) lists seven `CategoryDefinition` objects. The `core-engine` category's `subModules` array is intentionally left empty — its members are resolved by filtering `SUB_MODULES` against the private `CORE_ENGINE_IDS` array (line 434). All other categories enumerate their module IDs inline.

### 3. Registry 2 — Feature dependency graph (`src/lib/feature-definitions.ts`)

`MODULE_FEATURE_DEFINITIONS` (line 169) is a `PartialModuleMap<FeatureDefinition[]>` — not every module has entries. Each `FeatureDefinition` has:

- `featureName: string` — label unique within the module
- `category: string` — grouping label
- `dependsOn?: string[]` — references to either `'featureName'` (same module) or `'moduleId::featureName'` (cross-module)

`MODULE_PREREQUISITES` (line 7) is a separate, coarser graph at the **module** level (e.g., `arpg-combat` requires `arpg-gas` and `arpg-animation`). It drives `getRecommendedNextModules` and the `RoadmapChecklist` UI — it is **not** the same as the feature-level `dependsOn` graph.

`buildDependencyMap()` (line 452) converts `MODULE_FEATURE_DEFINITIONS` into a memoized `Map<featureKey, DependencyInfo>` where each key is `moduleId::featureName`. The result is static and memoized. `computeBlockers(depMap, statusMap)` (line 498) produces a fresh copy annotated with live `isBlocked / blockers` fields based on a caller-supplied `featureKey → status` map fetched from the API.

### 4. The NBA Engine (`src/lib/nba-engine.ts`)

`computeNBA(moduleId, featureStatusMap?)` is the primary consumer of registries 1 and 2. For each uncompleted checklist item it produces an `NBARecommendation` with a 0–100 composite score built from five weighted dimensions:

| Dimension | Weight | Source |
|-----------|--------|--------|
| urgency | 30 | Feature dependency fan-out (how many features this item unblocks) |
| successProbability | 25 | Pattern library match + module task-history success rate |
| impact | 20 | Dependency fan-out (duplicate of urgency factor, different coefficient) |
| recency | 15 | Evaluator scan recommendations for this module |
| readiness | 10 | Whether all `dependsOn` deps are satisfied in `depMap` |

Checklist items are matched to `FeatureDefinition` entries by fuzzy label-word matching (line 119–122). If no match, the item is treated as unblocked with readiness = 70 % of max.

### 5. Registry 3 — Evaluator prompts (`src/lib/evaluator/module-eval-prompts.ts`)

`EVAL_PASSES` (line 18) defines the standard four-pass sequence: `ground-truth → structure → quality → performance`. One module (`arpg-combat`) also has a fifth `combat-trace` pass defined in `getPassesForModule`.

`MODULE_CONTEXTS` (line 70) maps each `moduleId` to a `ModuleEvalContext` with `focus`, `structureChecks`, `qualityChecks`, `performanceChecks`, and an optional `tracePass`. Modules without an entry in `MODULE_CONTEXTS` receive generic pass descriptions.

`buildEvalPrompt(params)` (line 346) assembles the full prompt string from the context + a shared `FINDING_SCHEMA` that instructs the model to return a JSON array of findings with `{ category, severity, file, line, description, suggestedFix, effort }`.

---

## Module Categories

| Category ID | Label | Component Path | Notes |
|-------------|-------|----------------|-------|
| `core-engine` | Core Engine | `src/components/modules/core-engine/` | 12 `arpg-*` modules + `core-engine-plan` pseudo-module; members resolved via `CORE_ENGINE_IDS` |
| `content` | Content | `src/components/modules/content/` | models, animations, materials, level-design, ui-hud, audio |
| `game-systems` | Game Systems | `src/components/modules/game-systems/` | ai-behavior, physics, multiplayer, save-load, input-handling, dialogue-quests, packaging, blueprint-transpiler |
| `evaluator` | Evaluator | `src/components/modules/evaluator/` | game-design-doc; quality dashboards, GDD compliance |
| `game-director` | Game Director | `src/components/modules/game-director/` | Session tracking, regression |
| `visual-gen` | Asset Studio | `src/components/modules/visual-gen/` | asset-viewer, asset-forge, material-lab, blender-pipeline, asset-browser, import-automation, auto-rig, procedural-engine, scene-composer |
| `project-setup` | Project Setup | `src/components/modules/project-setup/` | No sub-modules currently wired in `CATEGORIES` |

The `core-engine` `SubModuleDefinition` objects are nested further under `src/components/modules/core-engine/sub_*/` (e.g., `sub_combat/`, `sub_character/`, `sub_loot/`).

---

## Conventions / Gotchas

**`knowledgeTips` are UI-only.** They are rendered as dismissable banners in `ModuleShell.tsx` for modules with `feasibilityRating === 'moderate'` (line 124). They are **never injected into dispatch prompts**. What does reach prompts is `UE_GOTCHAS` (`src/lib/knowledge/ue-gotchas.ts`) filtered by `appliesTo: PromptKind[]`, and a binary-content tripwire injected by `buildProjectContextHeader()` in `src/lib/prompt-context.ts`.

**Two separate dependency graphs coexist.** `MODULE_PREREQUISITES` is module-to-module (coarse, drives `RoadmapChecklist` and `getRecommendedNextModules`). `MODULE_FEATURE_DEFINITIONS[moduleId][].dependsOn` is feature-to-feature (fine, drives the NBA engine via `buildDependencyMap` / `computeBlockers`). They are maintained independently and can disagree.

**`MODULE_FEATURE_DEFINITIONS` is `PartialModuleMap`.** Many modules — including all content modules except `animations` and `materials` — have feature definitions; some (e.g., `audio`, `physics`) do not. `computeNBA` returns an empty array for modules with no checklist or no feature entries.

**`core-engine-plan` is a pseudo-module.** It has `isSpecialItem: true`, an empty `checklist`, and empty `quickActions`. The registry includes it as a sentinel for the cross-module planning view; it does not participate in the NBA engine or evaluator.

**`CATEGORY_MAP` / `SUB_MODULE_MAP` are mutable at module load.** `SUB_MODULE_MAP` is populated by a `for` loop (line 1218); there is no `Object.freeze`. Callers must not mutate these maps.

**`buildDependencyMap()` is memoized globally.** The cached map is shared across all callers. Pass it to `computeBlockers()` to get a status-annotated copy; do not annotate the shared map directly.

**`ChecklistItem.dependsOn` is intra-module only.** These are checklist item IDs (e.g., `'ae-1'`), not feature keys. Cross-module ordering is expressed in `MODULE_PREREQUISITES` (module level) or `FeatureDefinition.dependsOn` (feature level), not in checklist `dependsOn`.

---

## See Also

- [Overview](overview.md)
- [Prompts and CLI](prompts-and-cli.md)
- [Catalog pipeline index](../catalog/index.md)
