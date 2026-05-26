# Catalog pipeline

The catalog pipeline turns a **catalog "row"** — an item, monster, quest, material, ability, cutscene, … — into **tested, UE-wired game content**. Each row is a small declarative spec that renders into a per-step authoring UI, persists what it produces to SQLite, and derives an honest acceptance verdict on a 4-tier ladder. All **30 catalogs** are wired this way.

This is the catalog section's index; for where it sits in the whole app see [`../architecture/overview.md`](../architecture/overview.md).

## The StepSpec chassis

A row is one file: `src/lib/catalog/pipelines/<catalogId>.ts`, a single `registerCatalogPipeline({ catalogId, steps: StepSpec[] })` call. Each `StepSpec` declares:

```ts
{ archetype, label, view, produce(entity), accept, /* optional */ staticChecks, links }
```

- **`archetype`** ∈ `brief | schema | rules | balance | gallery | checklist | manifest | graph | custom`. It drives both the generic View and which **Project Canon** categories inject into the Produce prompt. The archetype library + each row's recommended sequence are in [`PIPELINE_REVIEW.md`](PIPELINE_REVIEW.md).
- **`view`** — a `ViewDescriptor` (`prose | table | gallery | checklist | manifest | graph`).
- **`produce(entity)`** → `{ data, ueAssets?, links? }` — the produced payload (a CLI/generator output or authored data). UE asset names use the `proj-naming` prefixes.
- **`accept`** — a *derived* `Checker` from `src/lib/catalog/acceptance/` (never a manual toggle). See the tiers below.
- **`staticChecks?`** / **`links?`** — L2 codebase checks (`cppSymbolExists`/`seedRowPresent`) and typed cross-catalog links (resolved / deferred, never silently dangling).

**Rendering is Hybrid** (`Baseline.tsx` precedence): a bespoke per-step component (via `getStepComponent`, used by the data-backed Items reference) → the generic [`ArchetypeStep`](../architecture/ui-shell.md) for any registered `StepSpec` → a placeholder. `ArchetypeStep` auto-injects the scoped Canon into every Produce prompt.

**Self-registration.** Pipelines are discovered through an auto-generated barrel (`pipelines/registry.generated.ts`, gitignored, rebuilt by `npm run gen:pipelines` / predev / prebuild / the vitest global-setup). Authors never edit it — that's what lets many sessions add rows in parallel without collisions.

## The acceptance ladder

Every step's `accept` derives a verdict — `pass | pending | fail | deferred` — at one tier. **Config-complete** (the parallel-dev "done" bar) = every step passes at L0–L2 or is honestly deferred at L3/L4.

| Tier | Means | Checkers |
|------|-------|----------|
| **L0 Data** | the data is well-formed | `minLength` / `fieldsPopulated` / `withinPercent` / `minCount`; `graphValid` (reachability + terminal) |
| **L1 Selection** | a human picked an asset | `selected` (gallery / art steps — human-gated) |
| **L2 Static** | the UE symbol/row exists + is wired | `cppSymbolExists` / `seedRowPresent` (read-only, parallel-safe; missing → `deferred`) |
| **L3 Runtime** | it loads / spawns / applies in PIE | `runtimeDeferred('VS<Name>Test', …)` → drained by the test-gate runner |
| **L4 Visual** | it renders correctly | `visualDeferred(…)` → RHI screenshot + Gemini |

Full data contract + the parallel-CLI model: [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md). The L3/L4 runner that flips deferred → pass/fail: [`L3-L4-RUNNER.md`](L3-L4-RUNNER.md).

## Project Canon

`src/lib/catalog/canon/` holds the **project laws** — art styles, the game's setting/tone, ARPG systems, naming/wiring conventions — as scoped `ProjectRule`s (`canon-seed.ts`, global or per-catalogId). `ArchetypeStep` injects the rules relevant to a step's archetype into its Produce prompt, so CLI output stays consistent with the project bible. Author canon *before* a pipeline; grow it when a row reveals a reusable rule.

## The quality bar

Green tests are necessary, not sufficient. Two layers raise the bar:

- [`ARPG-LAWS.md`](ARPG-LAWS.md) — the Diablo/PoE-grade systems (rarity/affixes, damage `added→increased→more`, resists, ailments, monsters, loot, defenses, classes, crafting, area level, wiring) that produced content must obey with in-envelope numbers.
- [`QUALITY-GATE.md`](QUALITY-GATE.md) — a **blocking** reviewer pass scoring content fidelity + wiring + acceptance integrity (APPROVE / REVISE) before a row is done. It repeatedly catches the schema-down defect class (invent-vs-validate against the real seeded entity / UE symbols / link ids) that tests miss.

## How a row gets built

Author the spec + its test, reach config-complete, pass the blocking gate, commit narrowly. The full recipe + the per-CLI loop + the do-not-touch list are in [`AUTHORING.md`](AUTHORING.md). The exemplars to copy: `currency.ts` (logic), `icon-sets.ts` (presentation), `bestiary.ts` (composite, cross-catalog links), `loot-tables.ts` / `dialog-trees.ts` (gate-approved; graph).

## Document map

| File | Authoritative for |
|------|-------------------|
| **index.md** (this) | what the catalog pipeline is + how the pieces fit |
| [`AUTHORING.md`](AUTHORING.md) | *how* to build a row — the recipe + the loop + do-not-touch |
| [`PIPELINE_REVIEW.md`](PIPELINE_REVIEW.md) | the step-archetype library + per-row archetype sequence |
| [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md) | the UE↔SQLite data contract + the L0–L4 tiers + the parallel model |
| [`ARPG-LAWS.md`](ARPG-LAWS.md) | the Diablo/PoE systems content must obey |
| [`QUALITY-GATE.md`](QUALITY-GATE.md) | the blocking content-fidelity + wiring review |
| [`L3-L4-RUNNER.md`](L3-L4-RUNNER.md) | the live-UE runner that drains deferred runtime/visual gates |
| [`LEGACY-SALVAGE.md`](LEGACY-SALVAGE.md) | UE gotchas / known asset paths migrated into the Canon |

## Code map

```
src/lib/catalog/
  pipelines/<catalogId>.ts   one StepSpec[] per row (+ registry.generated.ts, gitignored)
  stepSpec.ts                StepSpec / ViewDescriptor / CatalogPipeline types
  acceptance/                the tier checkers (dataCheckers, ueStaticCheckers, deferred, graphCheckers, linkCheckers)
  canon/                     ProjectRule + canon-seed + canonContext (the project laws)
  new-catalogs.ts            the catalog registry (catalogId / label / category / starters)
  pipeline-registry.ts       getCatalogPipeline / registerCatalogPipeline
src/components/layout-lab/   the /layout shell that renders + persists steps (see ../architecture/ui-shell.md)
src/lib/test-gate-runner/    the L3/L4 drain runner
```
