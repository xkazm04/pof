# Catalog Pipeline Architecture

Shared reference for every per-catalog doc in this folder. It explains the **chassis** all 31 catalog pipelines run on: how a step is shaped, how acceptance is judged, and how authored data reaches the Unreal Engine project.

> This describes the **Blueprint** (going-forward) world only — the `/layout` design studio and the `src/lib/catalog/` pipeline engine. The legacy 7×37 sidebar module system (`src/components/modules/`, dzin-panels, Evaluator, Game Director) is being discontinued and is not documented here.

---

## 1. The mental model

A **catalog** is an entity *type* (Items, Quests, Bestiary…). An **entity** is one row of that type (one sword, one quest, one enemy). A **pipeline** is the ordered list of **steps** that takes an entity from a blank idea to realized, verified UE5 content.

```
Category ──▶ Catalog ──▶ Entity ──▶ [ Step 1 · Step 2 · … · Step N ]
(Game Assets)  (Items)   (Iron Longsword)   each step = View / Produce / Acceptance
```

Pipelines are **declarative and self-registering**. Each file in `src/lib/catalog/pipelines/<id>.ts` calls `registerCatalogPipeline({ catalogId, steps: [...] })` at import time; a generated barrel (`registry.generated.ts`, gitignored, rebuilt by `npm run gen:pipelines`) wires them in. Adding a pipeline = adding a file. No central edit, no merge contention between parallel authors.

Key code map:

| Concern | Location |
|---------|----------|
| Pipeline definitions (one file per catalog) | `src/lib/catalog/pipelines/*.ts` |
| Step/View/Pipeline types | `src/lib/catalog/stepSpec.ts` |
| Self-registration registry | `src/lib/catalog/pipeline-registry.ts` (`registerCatalogPipeline`, `getCatalogPipeline`, `allCatalogPipelines`) |
| Catalog metadata + seeds | `src/lib/catalog/new-catalogs.ts`, `src/lib/catalog/sections.ts` |
| Acceptance checkers | `src/lib/catalog/acceptance/*.ts` |
| Project Canon rules | `src/lib/catalog/canon/*` |
| The `/layout` studio that renders all this | `src/components/layout-lab/` |

---

## 2. The View / Produce / Acceptance model

Every step is one screen with three faces (`StepSpec` in `stepSpec.ts`):

```ts
interface StepSpec {
  archetype: ArchetypeId;                 // which reusable step template
  label: string;                          // e.g. "Affixes"
  view: ViewDescriptor;                   // how to render current state
  produce: (entity: LabEntity) => StepOutput;   // CLI/user action → data + ueAssets + links
  accept: Checker;                        // derived gate (never a manual toggle)
  staticChecks?: (entity: LabEntity) => UeChecker[];  // optional L2 source checks
}
```

- **View** — a purpose-built visualization of the step's current state (prose, table, gallery, checklist, manifest, graph). All type ≥14px; responsive panel grid.
- **Produce** — the action face. A CLI/LLM session (or the user) supplies direction; the step's own `buildPrompt(direction)` logic runs; the result is validated and written. `produce()` returns `{ data, ueAssets?, links? }`:
  - `data` — the JSON payload persisted for this step.
  - `ueAssets` — UE asset paths the step creates/references (`/Game/...`).
  - `links` — cross-catalog references (`{ catalogId, entityId, role }`) — e.g. an item links to a material; loot links to items. Links **reference, never re-author** the target (canon `proj-links`).
- **Acceptance** — a **derived** verdict read from SQLite/UE truth. Never a checkbox a human ticks. If Produce fails, the reason is surfaced, not swallowed.

The shared UI lives in `src/components/layout-lab/steps/`: `CliProduce` (the Produce panel), `StepFrame` (acceptance banner + view grid), `ArchetypeStep` (the generic renderer), plus bespoke per-step components where a catalog needs richer UI (the Items pipeline has the fullest set).

---

## 3. The archetype library

Most steps are instances of a small set of reusable **archetypes**, so a new pipeline is mostly assembled, not hand-built. A step with a registered `archetype` and no bespoke component renders through `ArchetypeStep`, which also injects the relevant Project Canon rules.

| Archetype | View | Used for | Typical checker |
|-----------|------|----------|-----------------|
| `brief` | prose | the opening narrative/design pitch | `minLength` (L0) |
| `schema` | table | populate a fixed attribute set | `fieldsPopulated` (L0) |
| `rules` | table | logic, formulas, tier tables | `fieldsPopulated` / custom (L0) |
| `balance` | table | numeric tuning inside a budget | `withinPercent` (L0) |
| `gallery` | gallery | pick an asset from generated candidates | `selected` (L1) |
| `graph` | graph | node/edge state machine or flow | `graphValid` (L0) |
| `checklist` | checklist | runtime presence/behaviour gate | `runtimeDeferred` (L3) |
| `manifest` | manifest | the final UE asset packaging list | `minCount` (L0) |
| `custom` | bespoke | step-specific UI (e.g. bridge-driven movement) | varies |

Generative `gallery` steps keep **every re-roll batch** (browse → compare → select), stamped with the art direction that produced them (`CandidateGallery` + `genHistory.ts`).

---

## 4. The acceptance ladder (Tiers of Truth)

Acceptance is tiered by **how grounded the evidence is**. The result type (`acceptance/types.ts`):

```ts
type AcceptanceTier   = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
type AcceptanceStatus = 'pass' | 'pending' | 'fail' | 'deferred';
interface AcceptanceResult { label; status; tier; detail; reason? }
```

| Tier | Proves | How it's checked | Parallel-safe? | Checkers |
|------|--------|------------------|----------------|----------|
| **L0 Data** | the spec is complete & in-budget | read the SQLite artifact, no external deps | ✅ | `minLength`, `fieldsPopulated`, `withinPercent`, `minCount`, `graphValid` |
| **L1 Selection** | a human chose the asset | a persisted gallery selection | ✅ | `selected` |
| **L2 Static** | a symbol/row exists in UE source | read-only grep of `Source/` + seed scripts | ✅ | `cppSymbolExists`, `seedRowPresent` |
| **L3 Runtime** | it loads/spawns/applies in PIE | headless UE functional test, judged from logs | ❌ serialized | `runtimeDeferred(testName)` |
| **L4 Visual** | it renders correctly | RHI screenshot → multimodal verdict | ❌ serialized | `visualDeferred()` |

Bridge-driven steps (e.g. `player-movement`) use `pythonStepSuccess` / `pythonStepOk`, which read the `{created, skipped, failed}` envelope returned by a Python module dispatched on the editor thread; pre-run they report `deferred` (L3), and on a clean run resolve to `pass` (L2).

**`deferred` is a first-class, expected state** — not a failure. It carries a reason (e.g. "live-UE busy", or the test name awaiting a drain).

---

## 5. Config-complete vs. live-UE — why this scales to parallel authors

There is exactly one shared UE editor on the tree; concurrent PIE runs would clobber each other's logs. So the contract splits cleanly:

- **L0–L2 are the "config-complete" bar.** A single CLI session can take an entity all the way to config-complete on its own — author the spec (L0), make human selections (L1), edit UE source/seed scripts as text and verify them read-only (L2). All parallel-safe. After a clean Produce, every step should reach a terminal **pass** (L0/L1/L2) — never `fail`/`pending`.
- **L3/L4 are deferred behind a lease.** Runtime and visual gates need the live editor, so they're marked `deferred` and drained later, serially, by the gate runner (see [`../harness-llm-unreal/llm-ue-interface.md`](../harness-llm-unreal/llm-ue-interface.md)). A drain flips `deferred → pass/fail`.

Net effect: 5–9 CLI authors make real, mergeable progress in parallel; only runtime/visual verification serializes, and it never blocks an author.

---

## 6. The data contract (where truth lives)

| Data | Stored in | Source of truth |
|------|-----------|-----------------|
| step spec, intent, acceptance verdicts, asset manifest, human selections, test results | SQLite `pipeline_artifacts` (`catalog_id, entity_id, step, data, ue_assets, status, tier, reason, updated_at`) | **SQLite = authoring system** |
| compiled C++, DataTable rows, runtime assets, GAS wiring | UE project (`/Game/...`, `Source/`, `Content/Python` seed scripts) | **UE = realized truth** |

Direction of sync: **schema down, content up.** UE structs/attributes (`UARPGAttributeSet`, `FARPGItemDefinition`, …) are authority for *shape* — the app validates against them and never re-authors them. Authored *content* flows up: app → seed script → DataTable row (e.g. `TS catalog → author_items.py → DT_Items`).

The `/layout` studio (`labPipelineStore` + `labArtifactClient`) is a client cache of the `pipeline_artifacts` table: a Produce write-throughs to `/api/pipeline-artifacts`, status/tier are derived server-side, and opening an entity hydrates the cache from the server.

---

## 7. Quality rules every step obeys

From the project's locked authoring rules (CLAUDE.md + `docs/catalog/`):

1. **Produce contract** — every Produce face is a text-direction area + its own prompt logic, via the shared `CliProduce`. Never hand-rolled.
2. **Generated code** — clean, ≤200 LOC/file; folder structure mirrors the UI hierarchy; filenames encode hierarchy position.
3. **Reuse, don't duplicate** — check the shared component manifest before building UI.
4. **Tested + truthful** — each step produces data to UE *and* updates the UI, fulfils a *derived* acceptance, and reports the reason on failure.
5. **e2e-walked** — every registered pipeline is exercised end-to-end by the data-driven walker (`e2e/catalog-pipeline-walker.spec.ts`), which auto-covers a new pipeline the moment it self-registers.

ARPG content additionally obeys `docs/catalog/ARPG-LAWS.md` (rarity/affix/damage/loot/area-level model) and per-catalog **Project Canon** rules injected into every Produce prompt.

---

*Per-catalog docs live in sibling folders (`items/`, `quests/`, `bestiary/`, …). The LLM↔Unreal harness that drives Produce and drains L3/L4 gates is documented in [`../harness-llm-unreal/`](../harness-llm-unreal/README.md).*
