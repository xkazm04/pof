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
- `src/lib/catalog/pipelines/player-movement.ts` — **python-driven UE asset build** (each step's Produce calls a Python module on the editor thread via `/pof/python/run`; acceptance reads the `{created, skipped, failed}` envelope via `pythonStepSuccess`/`pythonStepOk`). See `ui-shell.md` §9 + `docs/superpowers/specs/2026-05-27-player-movement-design.md`.
- `src/lib/catalog/pipelines/status-effect.ts` — the original pilot.

## The recipe

**1. Use the EXACT `catalogId`.** Grep `src/lib/catalog/new-catalogs.ts` + `src/lib/catalog/sections.ts` for your row's registered `catalogId` and use it verbatim. It is **not** the folder slug — e.g. the folder `economy-meta/currency/` registers `catalogId: 'currencies'`; `ui/icon-set/` → `'icon-sets'`; `status-effect-buff` → `'status-effects'`. A wrong id = the pipeline registers but never renders (it won't match the catalog's seeded entities).

**2. Create `src/lib/catalog/pipelines/<catalogId>.ts`** — one `registerCatalogPipeline({ catalogId, steps })` call. Each step:
```ts
{ archetype, label, view, produce, accept, /* optional: */ staticChecks }
```
- `archetype` ∈ `brief | schema | rules | balance | gallery | checklist | manifest | graph | custom`. It drives both the generic `ArchetypeStep` View AND which **canon** categories inject (brief→game; schema/rules/balance→project+game; gallery→art+game; checklist/manifest→project; graph→game+project).
- `view` — a `ViewDescriptor` (`prose | table | chart | gallery | checklist | manifest | graph` (node/edge)); see `src/lib/catalog/stepSpec.ts`. `chart` routes numeric fields through the shared `ChartPanel` (`variant: 'bars' | 'histogram'`, naming the `field` + `rows`/`keys` to plot) — use it for `balance` budget/faucet-vs-sink steps instead of a `table`. `table` renders via the shared `DataTable`.
- `produce(entity, direction?)` → `{ data, ueAssets? }` — the produced payload. Asset names use UE prefixes (`T_`/`SM_`/`MI_`/`A_`/`NS_`/`GE_`/`DT_`, see canon `proj-naming`). Use `()` not `(e)` when the entity is unused (eslint).
  - **`direction` is the operator's typed art direction** (from `CliProduce`), forwarded by every dispatch site (`ArchetypeStep`, the Items `useStaticStep`, `POST /api/one-shot/step`). Optional on both sides: a body may ignore it, and callers with no direction (spec linter, headless recipe, demo seeding) still call `produce(entity)`. Read it when the step can honestly be steered — that is the point of the text area.
  - Regardless of whether the body reads it, every dispatch stamps **`data.produceDirection = { direction, prompt }`** via `withProduceDirection` (`src/lib/catalog/produceDirection.ts`) — visible verbatim in the step's `RawArtifactDisclosure` and on the persisted server row (an empty `prompt` honestly marks a deterministic produce that no CLI prompt drove). Don't hand-roll a direction field; don't strip the stamp when rewriting artifact data (see `useGenerativeStep.reselect`).
  - **Live CLI produce (opt-in):** with `localStorage['pof-lab-live-produce'] === '1'`, a `brief`/`graph`/`rules` step's Produce dispatches the real `POST /api/one-shot/step` (`mode: 'cli'`) with the typed direction and adopts the artifact the SERVER persisted; a failure surfaces as the inline reason + "Retry with same prompt" (Rule 4). Default (stub) mode is unchanged and writes synchronously, which is what keeps the Rule 5 walker green. See `src/components/layout-lab/labProduceMode.ts`.
- `accept` — a **derived** `Checker` from `src/lib/catalog/acceptance/`:
  - **L0 (data):** `minLength`, `fieldsPopulated`, `withinPercent` (accepts a dot-path), `minCount`, `entriesHaveFields` (`dataCheckers.ts`). Prefer a CONTENT assertion over a bare count: `allOf(minCount('rows', …, 6), entriesHaveFields('rows', …, ['from','to','guard']))` proves the rows are actually filled in, not just numerous.
  - **L0 (graph):** `graphValid(field, label)` (`graphCheckers.ts`) — L0 reachability + terminal check; use for objective graphs, dialog branches, FSMs, screen flow, step sequences.
  - **L1 (human selection):** `selected` (`dataCheckers.ts`) — the gate for art/gallery steps.
  - **L3 (runtime):** `runtimeDeferred('VS<Name>Test', label)` (`deferred.ts`) — for the Test Gate; stays `deferred` until the live-UE runner exists.
  - **Content invariants (required for `balance`):** `acceptance/invariants.ts` — canon-parsed laws (`powerWithinTierTarget`, `priceRatioWithinBand`, `faucetSinkBalanced`, `requiredLevelBand`, `rarityAffixBudget`, `monsterRarityWithinBands`, `xpGrowthWithinBand`, `statusBalanceEnvelope`), arithmetic reconciles (`componentsSumTo`, `sumReconciles`, `arithmeticReconciles`) and self-consistency laws (`budgetWithinCap`, `valueWithinDeclaredBand`, `descendingSeries`). Compose with `allOf(<shape check>, <invariant>)`. **Linter rule (k):** every `archetype: 'balance'` step MUST compose ≥1 — a shape-only balance step can never fail on a wrong number. If your step has no declared target/cap, WRITE one on the artifact and grade it (see `economySim.marginTargetPct`, `gameTier.sizeCapMB`); never soften an invariant to make a produce pass — fix the produced numbers.
- `staticChecks?: (entity) => UeChecker[]` — **L2** static codebase analysis (`ueStaticCheckers.ts`): `cppSymbolExists('FStruct'|'AClass', label)`, `seedRowPresent('seed_x.py', rowName, label)`. Read-only, parallel-safe. Missing → `deferred`, not fail.
- **Cross-catalog links:** may be declared either inline as `data.links: [{ catalogId, entityId, role }]` OR (preferred, typed) as the top-level `links: CatalogLinkRef[]` on the produce return — the store folds top-level `links` into `data.links`. `ArchetypeStep` reads them via `readLinks` and validates with `linkTargetsExist` (unresolved targets → `deferred`, never a hard fail). See bestiary's `Abilities` step or quests' `Rewards` step (typed path). **A links-writing step MUST also compose `linksResolve()` into its `accept`** (`allOf(<shape check>, linksResolve())`) so a link naming a non-existent entity is caught, not merely counted — the fleet spec linter fails the step otherwise.
- **Wiring contract:** a step whose produce writes a `wiringContract` (`{ grantedBy, activatedBy, verification, dependencies }` — the "no gray-box" L2 rule) MUST compose **`wiringContractSound(<container dot-path>)`** (`acceptance/wiringCheckers.ts`) into its `accept` via `allOf`, e.g. `allOf(fieldsPopulated('triggerProgress', …), wiringContractSound('triggerProgress'))`; omit the argument for a root-level contract. It asserts real prose (no `TBD`/`TODO`), a `verification` line naming a ladder tier (L0–L4), and well-formed `dependencies`. Linter rule (j) hollows the contract out and fails any step that still passes. All 137 existing contracts are composed.

**2b. Field coherence — Produce, View and Accept must name the SAME fields (linted).** A step is three faces of one artifact. The fleet spec linter (`src/__tests__/catalog/pipeline-spec-linter.test.ts`, runs in `npm run validate`) discovers the fields a checker reads by running `accept()` over a recording Proxy of the produce stub, and enforces:
- **every accept-field is written by `produce()`** — except when the verdict on the stub is `deferred` (an L3/L4 gate legitimately reads what a live runner / the `/pof/python/run` bridge writes later);
- **every `view.field` is written by `produce()`** — except python-bridge steps (`data.python`), whose fields arrive in the module's return envelope;
- **the displayed data is the graded data** — `accept` must read `view.field` itself, or grade a datum living INSIDE `data[view.field]` (a mirror of what's on screen). Charting one number while grading another is the drift this rule kills. `withinPercent` accepts a **dot-path** (`withinPercent('gpuBudget.gpuMs', …)`) so a `balance` step can grade the exact bar it charts instead of a duplicated top-level scalar.
- **gallery steps:** `view.field` is the **selection field** — the key a chosen candidate's payload projects onto the artifact — so it must equal the accepted field AND the payload key that `genCandidates.build` writes. It must never be the produced candidate ARRAY: selecting would overwrite that array with a numeric index while acceptance graded a field no selection ever touches (`character-pipeline`'s Concept 2D / 3D Generation / Icon 2D Art carried exactly this bug; regression locked by `src/__tests__/catalog/pipeline-gallery-projection.test.ts`).

**3. The universal Icon step.** Every row includes an **Icon 2D Art** step (`archetype: 'gallery'`, `accept: selected(...)`, L1) — even logic rows. Bind its asset to the shared `icon-sets` presentation library conceptually.

**3b. Generative steps keep a candidate history.** For generative steps (Icon 2D, 3D, Material) a Produce run is a *re-roll*: each batch of candidates is **persisted, not discarded**, so an artist can A/B-compare across re-rolls and re-select an older candidate (Midjourney/Leonardo loop). The model is the pure `steps/shared/genHistory.ts` (`readHistory`/`makeBatch`/`appendBatch`/`selectCandidate`/`historyData`) stored under the artifact's `data.genHistory`; selecting a candidate projects its `payload` to top-level data so the existing `selected`/`tris`/`maps` Acceptance is unchanged. Render it with the shared `CandidateGallery` (each batch stamped with its direction + recoverable full prompt). Reference impl: `ItemArt.tsx` (`ItemIcon2D`/`Item3DGen`/`ItemMaterial`), candidate generators in `steps/shared/itemGenCandidates.ts`. A generic `gallery` step defaults to deterministic swatch candidates, but may set `StepSpec.genCandidates` (`{ needsAssets?, build(direction, seq, assets) }`) to surface **real generated thumbnails** — use `steps/shared/imageGalleryCandidates.ts` with `needsAssets: true` (ArchetypeStep pre-fetches the manifest and falls back to honest swatches when nothing is on disk). Reference: `icon-sets` Icon 2D Art.

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
