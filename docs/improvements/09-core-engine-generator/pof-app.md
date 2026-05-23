# 09 · Core Engine Generator — PoF App architecture

App-side design for the catalog/generator. Grounded in the current code:
the module registry (`src/lib/module-registry.ts`), feature graph
(`src/lib/feature-definitions.ts`), CLI task seam (`src/lib/cli-task.ts`),
prompt builder (`src/lib/prompts/prompt-builder.ts` + `src/lib/prompt-context.ts`),
nav (`src/stores/navigationStore.ts`), per-module state (`src/stores/moduleStore.ts`),
the tab system (`src/components/modules/shared/createTabbedModuleView.tsx` +
`ReviewableModuleView.tsx`), `FeatureMatrix.tsx` (closest existing list), the
`src/components/ui/` primitives, `src/lib/chart-colors.ts`, and the suspend/LRU
pattern (`src/hooks/useSuspend.ts`). **Reuse these — don't rebuild them.**

The work is three layers: a **data model**, a **scalable UI framework**, and a
**generation engine**. Plus a navigation redesign that ties them together.

---

## 1. Catalog data model

A new typed core. Every Core Engine module owns a catalog of one entity type;
all entities share a base envelope so the UI framework is generic.

```ts
// src/lib/catalog/types.ts
export type LifecycleState =
  | 'planned' | 'scaffolded' | 'generated' | 'wired' | 'verified' | 'failed';

export interface CatalogEntityBase {
  id: string;                       // stable slug, e.g. 'ga-fireball'
  catalogId: CatalogId;             // 'spellbook' | 'bestiary' | 'items' | ...
  name: string;
  /** Ordered taxonomy path — the L4 hierarchy. e.g. ['Offensive','Fire','AoE'] */
  categoryPath: string[];
  tags: string[];                   // free-form facets: 'aoe','dot','channeled'
  lifecycle: LifecycleState;
  /** UE asset paths this entity owns, from the known-assets registry (Round 2). */
  ueAssets: string[];               // ['/Game/Abilities/BP_GA_Fireball', '/Script/PoF.GA_Fireball']
  /** Cross-catalog references (Bestiary→Ability/Loot). */
  links?: CatalogLink[];            // { catalogId, entityId, role }
  recipeId: string;                 // which GenerationRecipe builds it
  lastVerifiedAt?: string;          // ISO; from the functional-test gate
  lastTestResult?: 'pass' | 'fail';
}

// Per-type payloads extend the base with the design data the recipe consumes.
export interface AbilityEntry extends CatalogEntityBase {
  catalogId: 'spellbook';
  data: {
    baseClass: 'GA_MeleeAttack' | 'GA_Projectile' | 'GA_AoE' | string;
    costAttribute?: 'Mana' | 'Stamina'; costAmount?: number;
    cooldown?: number; damageBase?: number; damageType?: 'Physical' | 'Fire' | ...;
    tags: { activation: string; cooldown?: string; cost?: string };
    montage?: string;               // shell montage path (may be empty — gray-box)
  };
}
// ItemEntry, EnemyEntry, LootTableEntry, ScreenEntry, ZoneEntry, AnimationEntry,
// CombatInteraction follow the same shape — design data the recipe turns into UE.
```

**Storage.** A new `src/stores/catalogStore.ts` (Zustand + `persist`, mirroring
`moduleStore`'s conventions): `entitiesByCatalog[catalogId][entityId]`, with
selectors `useCatalogEntities(catalogId, filter)` and
`useCatalogEntity(catalogId, id)`. The **design data** persists locally + to
SQLite (a new `catalog_entities` table via the existing API envelope +
`useCRUD`); the **lifecycle/ueAssets/test results** are owned by the known-assets
registry (Round 2) and merged in — never hand-edited. Exclude any transient
generation-run state from `persist` (the moduleStore lesson: don't persist
`isRunning`-style fields).

**Relationship to existing types.** `CatalogEntityBase` is the richer successor
to a `FeatureDefinition` row. Keep `feature-definitions.ts` as the *coarse*
dependency graph (module-level features); the catalog is the *fine* asset
inventory. A catalog entity may declare which feature it realizes
(`featureName?`) so the feature matrix can roll up catalog lifecycle into its
existing status column.

---

## 2. The `CatalogView` UI framework (the scalable substrate)

One generic framework renders all 8 sections. It plugs into the **existing tab
system** as a new tab kind (`ExtraTab` whose `render(moduleId)` returns a
`<CatalogView catalogId=… schema=… />`), so L1/L2/L3 nav is unchanged. It adds
the new **L4/L5** layers. Components live in `src/components/catalog/`:

- **`CatalogTree`** (L4) — the categorization hierarchy. Renders `categoryPath`
  as a collapsible tree (4+ levels), counts per node, lazy-expand. Selecting a
  node filters the list. Replaces FeatureMatrix's flat one-level group-by.
- **`FacetBar`** — faceted, multi-dimensional search: text (debounced),
  lifecycle chips (reuse `ChipButton`), tag facets, type-specific facets
  (rarity, damageType, slot, archetype…), each a multi-select. Drives the same
  filter that `CatalogTree` narrows. This is the "intelligent" filtering the
  flat FeatureMatrix lacks.
- **`VirtualCatalogList` / `VirtualCatalogGrid`** — **virtualized** (add
  `react-window`/`@tanstack/react-virtual`) so 200–1000 items scroll smoothly.
  Row/card renders name, `categoryPath` crumb, lifecycle badge, test verdict,
  rarity color (reuse `chart-colors` rarity + lifecycle palette). Grid mode for
  icon-bearing catalogs (Items, Bestiary, Spellbook).
- **`EntityDetailDrawer`** (L5) — slide-out that is both **editor** (form over
  the entity's typed `data`, schema-driven) and **generation cockpit**:
  lifecycle stepper (Planned→…→Verified), UE asset links, last functional-test
  output, and the **(Re)generate** action that dispatches the recipe. Replaces
  FeatureMatrix's inline row-expand (which doesn't scale to rich metadata).
- **`BulkActionBar`** — multi-select + batch **Generate / Regenerate / Retag /
  Delete**, feeding the batch dispatcher (§3). Checkbox selection on the list.
- **`CatalogBreadcrumb`** — renders L1▸L2▸L3▸L4▸entity; each segment navigable.

**Schema-driven.** Each section supplies a `CatalogSchema` (facet definitions,
detail-form fields, default `categoryPath` taxonomy, grid-vs-list, icon source).
The framework is generic; a section is ~a schema + a few custom cells. This is
what keeps 7 of the 8 sections cheap once Round 1 lands.

**Reuse, don't rebuild.** Colors from `chart-colors.ts` (it already has
rarity + status + per-tab accents); primitives from `src/components/ui/`
(`ChipButton`, `Badge`, `StatusDot`, `SurfaceCard`, `EmptyState`,
`Tooltip`, `MarkdownProse`); animation presets from `motion.ts`. Honor the
suspend/LRU pattern: the catalog's data fetch + any polling use
`useSuspendableEffect`/`useSuspendableSelector` so a backgrounded section
freezes (the LRU cap is 5 — a heavy catalog must not keep working when hidden).

---

## 3. Navigation redesign (L3→L5 + routing)

Extend `navigationStore` from `{ activeCategory, activeSubModule }` to also hold
`activeSection`, `activeCategoryPath: string[]`, and `activeEntityId`. Add
**URL routing** (Next app-router segments or a query-param sync) so
`/core-engine/arpg-gas/spellbook/offensive/fire/ga-fireball` round-trips: deep
links, back/forward, and — importantly — **dispatchable** state (a generation
batch can target "everything under `offensive/fire`"). Keep the existing
keyboard/global-search affordances; extend `GlobalSearchPanel` to search catalog
entities (name/tag/path), not just modules.

---

## 4. The generation engine

A typed, recipe-based pipeline that turns a catalog entity into verified UE
artifacts, reusing the existing seams rather than inventing new transport.

```ts
// src/lib/catalog/recipe.ts
export interface GenerationRecipe<T extends CatalogEntityBase> {
  id: string;
  catalogId: CatalogId;
  /** The lifecycle steps this recipe performs, in order. */
  steps: GenerationStep[];          // 'scaffold-cpp' | 'author-python' | 'wire' | 'verify'
  /** Build the Claude prompt for a step — extends the existing PromptBuilder. */
  buildPrompt(entity: T, step: GenerationStep, ctx: ProjectContext): string;
  /** The functional test that gates 'verify'. */
  testPath?: string;                // 'Project.Functional Tests.Maps.X.YTest'
}
```

- **Prompt construction** extends `PromptBuilder` with a `.withAssetSpec(entity)`
  section that serializes the entity's typed `data` into the prompt's Task
  Instructions, on top of the existing 6 sections (Project Context / Domain
  Context / Task / Wiring Requirements / Best Practices / Output Schema /
  Success Criteria). Domain context comes from the existing `DOMAIN_CONTEXT` map;
  wiring requirements + the binary-content tripwire come from folder 01.
- **Dispatch** reuses `CLITask` + `TaskFactory` (add a `.generate(entity, step)`
  factory) and the `@@CALLBACK:<id>` mechanism — the callback POSTs the produced
  UE asset paths + lifecycle transition back to the catalog API, with
  `staticFields` carrying `{ catalogId, entityId, step }` tamper-proof.
- **Batch dispatcher** (`src/lib/catalog/batch.ts`) — generate N entities as a
  **queue, one isolated dispatch at a time** (the SP-B single-dispatch lesson;
  chained autonomy was the expensive failure mode). Each entity advances its
  lifecycle only when its step's callback validates *and*, for `verify`, the
  functional test returns green. Surface queue progress in the `BulkActionBar`.
- **Verification** reuses the harness `verifier.ts` gates (UE headless build +
  `Automation RunTests` parse) — the **functional-test gate is the lifecycle's
  `verified` transition.** No file-existence shortcut (it's gameable). Visual
  catalogs (Items icons, Bestiary, Screen Flow) additionally use the standard
  screenshot+Gemini gate (folder 08) before `verified`.

**Lifecycle transitions are the contract.** `planned`→`scaffolded` on C++ build
green; `scaffolded`→`generated` on the Python author callback; `generated`→
`wired` on the wire callback (CDO **+ placed-instance** writes — the
character-CLI CDO-vs-instance lesson, encoded in the recipe so it's not
re-discovered); `wired`→`verified` only on a green functional test;
`*`→`failed` with the captured error surfaced in the detail drawer.

---

## 5. Per-section app work (on the shared substrate)

Each section = a `CatalogSchema` + a recipe + a few custom cells/visualizations.
Round-1 builds the framework through **Spellbook**; the rest are Round-3 slices.

- **Spellbook** (`arpg-gas`) — grid codex; facets: school/element/cost-tier/
  lifecycle; detail form drives the GA/GE/tags recipe (the path the character
  CLI already shipped). *Round 1 reference implementation.*
- **Bestiary** (`arpg-enemy-ai`) — monster-manual cards; composes Ability +
  Loot links; recipe = `BP_*Enemy` CDO + archetype tuning + grants + the
  `ARPGSimpleAIController` shipped by the character CLI.
- **Items** (`arpg-inventory`) — inventory-grid; facets: slot/rarity/type;
  recipe = `UARPGItemDefinition` data assets (Python) + Leonardo icons.
- **Loot Tables** (`arpg-loot`) — weighted-table editor with drop-rate viz;
  recipe = `UARPGLootTable` data assets; links to Item entries.
- **Combat Map** (`arpg-combat`) — a **relationship graph** view (attacker →
  ability → hit-react → damage), mostly composing Spellbook entries + damage
  tables; few new assets, lots of wiring + tuning.
- **Screen Flow** (`arpg-ui`) — a **screen-transition graph**; recipe = pure-C++
  `UUserWidget` subclasses (folder 04's `UARPGCodeWidgetBase`) + a screen-flow
  state machine. No WBP wall.
- **Zone Map** (`arpg-world`) — a **zone hierarchy map**; recipe = `.umap` build
  (Python, folder 05) + spawn placement + nav; links Bestiary entries to spawns.
- **State Graph** (`arpg-animation`) — a state/transition node view; recipe =
  Mixamo import + montage shells + locomotion data; **AnimBP graph stays manual**
  (the widest binary wall) — the detail drawer shows the manual-step checklist.

---

## What this explicitly reuses vs. adds

| Reuse (already exists) | Add (this roadmap) |
|---|---|
| `CLITask` + `@@CALLBACK` + `TaskFactory` | `.generate(entity, step)` factory + batch queue |
| `PromptBuilder` 6 sections + `DOMAIN_CONTEXT` | `.withAssetSpec(entity)` section |
| `useModuleCLI` dispatch/session reuse | recipe-driven dispatch wrapper |
| Tab system (`ExtraTab`/`ReviewableModuleView`) | `CatalogView` as a tab kind |
| `chart-colors`, `src/components/ui/` primitives | `CatalogTree`, `FacetBar`, `VirtualCatalog*`, `EntityDetailDrawer`, `BulkActionBar` |
| `navigationStore` (L1/L2) | L3 section + L4 path + L5 entity + URL routing |
| `moduleStore` persist conventions, suspend/LRU | `catalogStore` + `catalog_entities` table |
| harness `verifier.ts`, Gemini gate | lifecycle `verified` transition = functional-test green |
| folder 01 wiring-reqs/gotchas, folder 02 known-assets | catalog lifecycle columns + per-asset registry merge |

The leverage: **one generic, virtualized, faceted, schema-driven catalog +
one recipe engine**, then 7 thin section schemas. That is what scales to
hundreds of assets across the next multi-CLI rounds.
