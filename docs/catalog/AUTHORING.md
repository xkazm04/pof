# Authoring a catalog row pipeline (the chassis recipe)

**This is the current execution model for building a catalog row.** It supersedes the older "one CLI drives one asset idea→UE→test + Session Findings" contract described in the body of [`index.md`](index.md) (those living-log findings are still useful *reference*, but the *how* is here). A row is now a small **`StepSpec[]` spec file** that renders through the shared chassis — not a hand-built pipeline.

Read alongside (don't duplicate these — they're the source of truth for their topic):
- [`PIPELINE_REVIEW.md`](PIPELINE_REVIEW.md) — the ~22 **step archetypes** + each row's recommended archetype sequence.
- [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md) — the **data contract** + the **4-tier acceptance ladder** (L0 data · L1 selection · L2 static · L3 runtime · L4 visual) + the parallel model.
- `.claude/CLAUDE.md` → *Catalog Pipeline Step Authoring* — the **coding rules** + shared-component manifest.
- The row's own `docs/catalog/<cat>/<row>/plan.md` — **design intent**: the entity's role, cross-catalog deps, and prior **Session Findings**. Read it for *what to build*; ignore its step-by-step "agent roles / idea→UE→test" framing — that's the superseded model.

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
- `archetype` ∈ `brief | schema | rules | balance | gallery | checklist | manifest | custom`. It drives both the generic `ArchetypeStep` View AND which **canon** categories inject (brief→game; schema/rules/balance→project+game; gallery→art+game; checklist/manifest→project).
- `view` — a `ViewDescriptor` (`prose | table | gallery | checklist | manifest`); see `src/lib/catalog/stepSpec.ts`.
- `produce(entity)` → `{ data, ueAssets? }` — the produced payload. Asset names use UE prefixes (`T_`/`SM_`/`MI_`/`A_`/`NS_`/`GE_`/`DT_`, see canon `proj-naming`). Use `()` not `(e)` when the entity is unused (eslint).
- `accept` — a **derived** `Checker` from `src/lib/catalog/acceptance/`:
  - **L0 (data):** `minLength`, `fieldsPopulated`, `withinPercent`, `minCount` (`dataCheckers.ts`).
  - **L1 (human selection):** `selected` (`dataCheckers.ts`) — the gate for art/gallery steps.
  - **L3 (runtime):** `runtimeDeferred('VS<Name>Test', label)` (`deferred.ts`) — for the Test Gate; stays `deferred` until the live-UE runner exists.
- `staticChecks?: (entity) => UeChecker[]` — **L2** static codebase analysis (`ueStaticCheckers.ts`): `cppSymbolExists('FStruct'|'AClass', label)`, `seedRowPresent('seed_x.py', rowName, label)`. Read-only, parallel-safe. Missing → `deferred`, not fail.
- **Cross-catalog links:** put them in `produce`'s `data.links: [{ catalogId, entityId, role }]`. `ArchetypeStep` auto-validates them via `linkTargetsExist` and surfaces a banner (unresolved targets → `deferred`, never a hard fail). See bestiary's `Abilities` step.

**3. The universal Icon step.** Every row includes an **Icon 2D Art** step (`archetype: 'gallery'`, `accept: selected(...)`, L1) — even logic rows. Bind its asset to the shared `icon-sets` presentation library conceptually.

**4. Grow the canon.** The Project Canon (`src/lib/catalog/canon/canon-seed.ts`) auto-injects into every Produce prompt. If your row reveals a reusable law (an economy rule, a creature-design rule, an art-family rule…), **append a rule** (`scope: '<catalogId>'` or `'global'`). Append-only — don't reorder/edit others'.

**5. Done = config-complete (L0–L2).** A row is done for parallel dev when every step passes at L0/L1/L2 **or** is honestly `deferred` at L3/L4. Don't fake runtime/visual — defer it.

**6. Add a test** mirroring an exemplar's `src/__tests__/lib/catalog/pipelines/<id>.test.ts`: assert it registers under the right catalogId, key step labels exist, a couple of `accept(produce(entity).data)` results, and that the Test Gate is `{ tier:'L3', status:'deferred' }`.

## The loop (per row)
```
author src/lib/catalog/pipelines/<catalogId>.ts   (+ its test, + optional canon-seed append)
npm run check:scoped        # per-CLI gate: tsc (AssetInspector-tolerant) + lint/test on YOUR changed files
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
| `.claude/CLAUDE.md` | coding rules + component manifest | conventions |
| `<cat>/<row>/plan.md` | the row's **design intent** + cross-catalog deps + findings | *what* to build (ignore its old execution framing) |
| `index.md` | catalog list + the living **findings/opportunities logs** | reuse insights (its execution-contract section is superseded by this doc) |
| `LEGACY-SALVAGE.md` | what to migrate from the Legacy shell into the **Canon** before deleting it (UE gotchas, known asset paths, wiring contract) | the canon rules your Produce prompts rely on (gotchas/paths) — read if they're not in `CANON_SEED` yet |

> **Prompt authoring:** the Canon block `ArchetypeStep` injects is the *Project Context + UE Best Practices* of a Produce prompt — the 6-section prompt order (`Project Context → Domain Context → Task → UE Best Practices → Output Schema → Success Criteria`) salvaged in `LEGACY-SALVAGE.md` §A-4 is the principle each step's `buildPrompt` follows.
