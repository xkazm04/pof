# Authoring a catalog row pipeline (the chassis recipe)

## Alternative: One-Shot Mode

Instead of opening a new entity row and driving each step manually, click **`+ One-shot`** in the lab header to have an LLM propose an entity that fills the catalog's most under-represented bucket, then run the achievable steps autonomously.

**How it works:** the orchestrator calls `/api/one-shot/analyze` (gap analysis), `/api/one-shot/propose` (LLM proposal via `cli-service`), and — after you approve the proposal — loops over the catalog's registered `StepSpec` pipeline, dispatching each step to `/api/one-shot/step`. You may refine the proposal up to 3 turns before approving; a forceMore checkbox at turn 3 lets you go further if needed.

**Pipeline coverage:** L0 data, L1-selection-only, and L2 deterministic + structured CLI steps run automatically. L1 gallery/3D steps are skipped (need human selection); L3/L4 steps are deferred to the existing test-gate runner.

**Where it lives:** `OneShotPanel` right-rail in `/layout`; state machine in `src/stores/oneShotJobStore.ts`; orchestrator in `src/lib/one-shot/orchestrator.ts`; 5 API routes under `src/app/api/one-shot/`.

**Limits:** single in-flight job (a second `start()` throws while any run is in-flight); max 3 refinement turns by default; failure policy is continue-and-summarize (a failed step does not abort the loop).

**When to use manual authoring instead:** when you need to curate a specific concept-gallery selection (L1 human selection) or run a 3D mesh generation step — neither of which the one-shot mode attempts. Manual authoring also gives you full control over per-step direction text and lets you iterate on individual steps without re-running the whole pipeline.

---

**This is the current execution model for building a catalog row.** A row is a small **`StepSpec[]` spec file** that renders through the shared chassis — not a hand-built pipeline. For the system overview (the chassis, the acceptance ladder, the Canon) see [`index.md`](index.md).

Read alongside (don't duplicate these — they're the source of truth for their topic):
- [`PIPELINE_REVIEW.md`](PIPELINE_REVIEW.md) — the ~22 **step archetypes** + each row's recommended archetype sequence.
- [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md) — the **data contract** + the **4-tier acceptance ladder** (L0 data · L1 selection · L2 static · L3 runtime · L4 visual) + the parallel model.
- `.claude/CLAUDE.md` → *Catalog Pipeline Step Authoring* — the **coding rules** + shared-component manifest.
- The **seeded entity** the row drives (`src/lib/catalog/seed-*.ts` / `new-catalogs.ts`) for *what to build*, plus a gate-approved **exemplar pipeline** (`loot-tables.ts`, or `dialog-trees.ts` for a graph row) for *how*.

## Worked exemplars (copy one)
- `src/lib/catalog/pipelines/currency.ts` — logic/systems (L2 `cppSymbolExists` + L3 `runtimeDeferred`).
- `src/lib/catalog/pipelines/icon-sets.ts` — pure presentation (L0 + L1 + deferred L3, no L2).
- `src/lib/catalog/pipelines/bestiary.ts` — composite (cross-catalog links + mixed tiers).
- `src/lib/catalog/pipelines/status-effect.ts` — the original pilot.

## The recipe

**1. Use the EXACT `catalogId`.** Grep `src/lib/catalog/new-catalogs.ts` + `src/lib/catalog/sections.ts` for your row's registered `catalogId` and use it verbatim. It is **not** the folder slug — e.g. the folder `economy-meta/currency/` registers `catalogId: 'currencies'`; `ui/icon-set/` → `'icon-sets'`; `status-effect-buff` → `'status-effects'`. A wrong id = the pipeline registers but never renders (it won't match the catalog's seeded entities).

**2. Create `src/lib/catalog/pipelines/<catalogId>.ts`** — one `registerCatalogPipeline({ catalogId, steps })` call. Each step:
```ts
{ archetype, label, view, produce, accept, /* optional: */ staticChecks }
```
- `archetype` ∈ `brief | schema | rules | balance | gallery | checklist | manifest | graph | custom`. It drives both the generic `ArchetypeStep` View AND which **canon** categories inject (brief→game; schema/rules/balance→project+game; gallery→art+game; checklist/manifest→project; graph→game+project).
- `view` — a `ViewDescriptor` (`prose | table | gallery | checklist | manifest | graph` (node/edge)); see `src/lib/catalog/stepSpec.ts`.
- `produce(entity)` → `{ data, ueAssets? }` — the produced payload. Asset names use UE prefixes (`T_`/`SM_`/`MI_`/`A_`/`NS_`/`GE_`/`DT_`, see canon `proj-naming`). Use `()` not `(e)` when the entity is unused (eslint).
- `accept` — a **derived** `Checker` from `src/lib/catalog/acceptance/`:
  - **L0 (data):** `minLength`, `fieldsPopulated`, `withinPercent`, `minCount` (`dataCheckers.ts`).
  - **L0 (graph):** `graphValid(field, label)` (`graphCheckers.ts`) — L0 reachability + terminal check; use for objective graphs, dialog branches, FSMs, screen flow, step sequences.
  - **L1 (human selection):** `selected` (`dataCheckers.ts`) — the gate for art/gallery steps.
  - **L3 (runtime):** `runtimeDeferred('VS<Name>Test', label)` (`deferred.ts`) — for the Test Gate; stays `deferred` until the live-UE runner exists.
- `staticChecks?: (entity) => UeChecker[]` — **L2** static codebase analysis (`ueStaticCheckers.ts`): `cppSymbolExists('FStruct'|'AClass', label)`, `seedRowPresent('seed_x.py', rowName, label)`. Read-only, parallel-safe. Missing → `deferred`, not fail.
- **Cross-catalog links:** may be declared either inline as `data.links: [{ catalogId, entityId, role }]` OR (preferred, typed) as the top-level `links: CatalogLinkRef[]` on the produce return — the store folds top-level `links` into `data.links`. `ArchetypeStep` reads them via `readLinks` and validates with `linkTargetsExist` (unresolved targets → `deferred`, never a hard fail). See bestiary's `Abilities` step or quests' `Rewards` step (typed path).

**3. The universal Icon step.** Every row includes an **Icon 2D Art** step (`archetype: 'gallery'`, `accept: selected(...)`, L1) — even logic rows. Bind its asset to the shared `icon-sets` presentation library conceptually.

**4. Grow the canon.** The Project Canon (`src/lib/catalog/canon/canon-seed.ts`) auto-injects into every Produce prompt. If your row reveals a reusable law (an economy rule, a creature-design rule, an art-family rule…), **append a rule** (`scope: '<catalogId>'` or `'global'`). Append-only — don't reorder/edit others'.

**5. Produce REAL content (not stubs) + reach config-complete (L0–L2).** Each producible step's `produce()` returns **real, law-faithful content** per [`ARPG-LAWS.md`](ARPG-LAWS.md) (a genuinely affixed item, a monster with a resistance profile + ability set, real lore — not placeholder data); where a deterministic generator exists (GAS codegen), invoke it with example inputs. A row is config-complete when every step passes at L0/L1/L2 **or** is honestly `deferred` at L3/L4 — don't fake runtime/visual.

**6. Pass the quality gate (blocking).** Tests passing is necessary, not sufficient. A reviewer subagent scores the row on **content fidelity + wiring** ([`QUALITY-GATE.md`](QUALITY-GATE.md)) and returns APPROVE / REVISE; the row is **not done** until it's APPROVE.

**7. Add a test** mirroring an exemplar's `src/__tests__/lib/catalog/pipelines/<id>.test.ts`: assert it registers under the right catalogId, key step labels exist, a couple of `accept(produce(entity).data)` results, and that the Test Gate is `{ tier:'L3', status:'deferred' }`.

## The loop (per row)
```
author src/lib/catalog/pipelines/<catalogId>.ts   (+ its test, + optional canon-seed append)
  ↳ produce REAL, law-faithful content per step (ARPG-LAWS.md) — not placeholder stubs
npm run check:scoped        # per-CLI gate: tsc (AssetInspector-tolerant) + lint/test on YOUR changed files
quality-gate review         # BLOCKING: reviewer subagent scores fidelity + wiring (QUALITY-GATE.md) → REVISE until APPROVE
git add <your pipeline file> <your test> [canon-seed.ts]   # narrow — see "do not touch"
git commit                  # local only; do not push
```
- **Do NOT run full `npm run validate`** — it picks up other CLIs' in-progress breakage on the shared tree. Use `check:scoped`.
- **Do NOT edit or commit `registry.generated.ts`** — it is **gitignored + auto-generated** (by `prepare`/`predev`/`prebuild`/vitest globalSetup/`check:scoped`). Your `pipelines/<id>.ts` is discovered automatically. This is what lets many CLIs run in parallel without colliding.

## Do NOT touch (so parallel CLIs don't collide)
Edit **only**: your `src/lib/catalog/pipelines/<catalogId>.ts`, its test, and (append-only) `canon-seed.ts`. Plus a bespoke component under `src/components/layout-lab/steps/<catalogId>/` *only if* your row needs custom View interaction beyond the generic archetypes.

Leave alone: `registry.generated.ts` (auto-gen), other rows' pipeline files, and the shared chassis — `stepSpec.ts`, `ArchetypeStep.tsx`, `acceptance/*`, `pipeline-artifacts-db.ts`, the API routes, `package.json`. If you think a shared file needs changing, that's a chassis change — flag it, don't fold it into a row.

## Document map (avoid contradictory reading)
| File | Authoritative for | For a row CLI |
|------|-------------------|---------------|
| **AUTHORING.md** (this) | *How* to build a row | the recipe + the loop |
| `PIPELINE_REVIEW.md` | the archetype library + per-row archetype sequence | your row's step list |
| `WIRING-AND-ACCEPTANCE.md` | data contract + acceptance tiers | which tier each step targets |
| `ARPG-LAWS.md` | the **Diablo/PoE-grade systems** (items/affixes, damage/resist, ailments, monsters, loot, classes, crafting, scaling) | the real rules your produced content must obey |
| `QUALITY-GATE.md` | the **blocking** content-fidelity + wiring review rubric | the bar your row must pass beyond green tests |
| `.claude/CLAUDE.md` | coding rules + component manifest | conventions |
| `index.md` | the catalog-pipeline overview (chassis · ladder · canon · quality bar) | the big picture + the doc map |
| `L3-L4-RUNNER.md` | the live-UE runner that drains deferred L3/L4 gates | how a Test Gate eventually flips to pass/fail |
| `LEGACY-SALVAGE.md` | what to migrate from the Legacy shell into the **Canon** before deleting it (UE gotchas, known asset paths, wiring contract) | the canon rules your Produce prompts rely on (gotchas/paths) — read if they're not in `CANON_SEED` yet |

> **Prompt authoring:** the Canon block `ArchetypeStep` injects is the *Project Context + UE Best Practices* of a Produce prompt — the 6-section prompt order (`Project Context → Domain Context → Task → UE Best Practices → Output Schema → Success Criteria`) salvaged in `LEGACY-SALVAGE.md` §B-4 is the principle each step's `buildPrompt` follows.
