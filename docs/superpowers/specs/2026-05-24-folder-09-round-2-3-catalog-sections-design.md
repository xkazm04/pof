# Folder 09 · Round 2 (substrate) + Round 3 (Items & Loot) — Design

**Date:** 2026-05-24 · **Status:** Approved (design), pending spec review → plan.
**Builds on:** Round 1 (catalog data model + generation engine, all merged) — spec
[`2026-05-24-folder-09-round-1-core-engine-generator-design.md`](2026-05-24-folder-09-round-1-core-engine-generator-design.md),
plans `2026-05-24-folder-09-generation-engine.md` + `…-phase-b-generation-engine.md`.
**Roadmap:** [`docs/improvements/09-core-engine-generator/`](../../improvements/09-core-engine-generator/) Rounds 2–3.

## 1. Scope & decisions

**Round 2 — the shared substrate that makes any section *thin*** (a section becomes
~ a schema + seed + recipe): a section registry that seeds all catalogs, a
generalized recipe registry, the known-assets extension, and a reusable
lifecycle/`ueAssets` catalog column.

**Round 3 — Items & Loot Tables as catalog data** (the roadmap's recommended
first Round-3 slices: Python-clean data assets, lowest collision): per-section
entity type + seed converter (from the section's existing static data) + recipe.
**Plus** one UI retrofit: wire the existing **ItemCatalog** unique-tab to read
items from `catalogStore` and show the lifecycle cell + a "(Re)generate"
affordance (operator decision — a visible proof, mirroring the Spellbook
retrofit).

**Operator decisions locked:**
- D1 — Approach **A (decoupled registries)**: `recipe.ts` keeps `getRecipe` (just
  extend its internal map → **`cli-task.ts` untouched**); a new `sections.ts`
  owns seeding only. No recipe↔sections cycle.
- D2 — Retrofit **ItemCatalog** UI (not LootTableVisualizer) for the visible proof.

**Out of scope (→ parallel per-section CLIs, per the roadmap's "Round 3 = up to 7
parallel CLIs"):** retrofitting `LootTableVisualizer`; live-UE functional-test
gates for items/loot; and the other 5 sections (Bestiary, Combat Map, Screen
Flow, Zone Map, State Graph). Their section UIs already exist as unique-tabs and
are each another session's domain.

**Reuse (do NOT rebuild):** Round-1 `types.ts`/`lifecycle.ts`/`validation.ts`/
`catalog-db.ts`/`catalogStore.ts`/`recipe.ts`/`batch.ts`/`useGeneration`/
`LifecycleBadge`; the existing `ItemCatalog`/`LootTableVisualizer` static data
(`data.ts`/`data-items.ts`/`data-binding.ts`) — read-only sources for seeds;
`ue-known-assets.ts` (extend additively).

## 2. Architecture

### 2.1 Section registry — `src/lib/catalog/sections.ts` (new)
```ts
export interface CatalogSection {
  catalogId: string;            // 'spellbook' | 'items' | 'loot-tables' | ...
  label: string;
  seed: () => CatalogEntityBase[];
}
export const CATALOG_SECTIONS: CatalogSection[] = [
  { catalogId: 'spellbook',    label: 'Spellbook',    seed: seedSpellbookEntries },
  { catalogId: 'items',        label: 'Items',        seed: seedItemEntries },
  { catalogId: 'loot-tables',  label: 'Loot Tables',  seed: seedLootEntries },
];
/** { [catalogId]: { [id]: entity } } — consumed by the store's buildInitial. */
export function seedAllCatalogs(): Record<string, Record<string, CatalogEntityBase>>;
```
Imports seeds (and nothing from the store) → no cycle. Adding a section = one
array entry + its seed file.

### 2.2 Store generalization — `src/stores/catalogStore.ts` (additive)
`buildInitial()` → `seedAllCatalogs()` (was hard-coded `{ spellbook: … }`).
Backward-compatible: spellbook still seeded; items + loot now too. The existing
`merge` (re-seed missing catalogs), selectors, and Round-1 lifecycle actions are
unchanged. Add a typed convenience selector `useItemEntries()` (mirrors
`useSpellbookEntries`).

### 2.3 Recipe registry — `src/lib/catalog/recipe.ts` (additive)
Add `ITEMS_RECIPE` + `LOOT_RECIPE` and extend the internal `RECIPES` map to
`{ spellbook, items, 'loot-tables' }`. `getRecipe(catalogId)` signature unchanged
⇒ `cli-task.ts` and the `'generate'` task path are untouched. Per-section steps:
- **Items:** `['author-python', 'wire', 'verify']` — author a `UARPGItemDefinition`
  data asset (Python, full editor), wire into the item registry, verify.
- **Loot:** `['author-python', 'verify']` — author a `UARPGLootTable` data asset
  (weighted entries) + a roll-distribution verify.
Each `buildStepPrompt` reuses `PromptBuilder.withAssetSpec(entity)` + the section's
known assets + a placeholder `testPath` (the live gate is a per-section CLI).

### 2.4 Known-assets extension — `src/lib/knowledge/ue-known-assets.ts` (additive)
Add `KnownAsset` entries for the item/loot generated-asset base classes/paths
(e.g. `UARPGItemDefinition`, `UARPGLootTable`, the `/Game/Items/`, `/Game/Loot/`
content roots) tagged `domains: ['items']` / `['loot']`; extend
`knownAssetDomainsForModule` with `arpg-inventory → ['items']`,
`arpg-loot → ['loot']`. Existing character/animation entries unchanged.

### 2.5 Reusable lifecycle cell — `src/components/catalog/CatalogLifecycleCell.tsx` (new)
A small presentational cell: `<LifecycleBadge>` + a muted `ueAssets` count (e.g.
"3 assets") + optional `(Re)generate` button wired to `useGeneration`. Any
section UI drops it in; ≤200 LOC (within the scoped lint gate).

### 2.6 Items & Loot data — `src/lib/catalog/types.ts` (additive) + seeds (new)
```ts
import type { ItemData } from '@/…/ItemCatalog/data';
export interface ItemEntry extends CatalogEntityBase { catalogId: 'items'; data: ItemData; }
export interface LootTableEntry extends CatalogEntityBase { catalogId: 'loot-tables'; data: <loot table shape>; }
```
- `seed-items.ts`: `DUMMY_ITEMS → ItemEntry[]` — `categoryPath = [type, rarity]`,
  `tags = [type]`, `lifecycle: 'planned'`, `data: item`.
- `seed-loot.ts`: the loot tables/bindings array → `LootTableEntry[]` — exact
  source array confirmed at plan time from `LootTableVisualizer/data*.ts`.

### 2.7 ItemCatalog UI retrofit (D2) — `…/ItemCatalog/index.tsx` (+ its items list view)
Source items from `useItemEntries()` (fallback to the static array shape, so the
existing visualizations render unchanged), render `CatalogLifecycleCell` per item,
and add a "(Re)generate" affordance on the primary/selected item via
`useGeneration` (hook called once at top level — rules-of-hooks). **Mirrors the
Spellbook retrofit.** Re-read the file immediately before editing; if it has
diverged or another session added a generation affordance, STOP and report.

## 3. Testing (TDD, app-side vitest)
1. **section-registry** — all 3 catalogs seed; spellbook count unchanged; every
   catalog's entries have unique ids + ≥1 categoryPath + planned lifecycle.
2. **seed-items** — `DUMMY_ITEMS.length` entries, unique ids, `data===input`,
   `categoryPath`/`tags` derivation correct.
3. **seed-loot** — maps every source row; unique ids.
4. **recipe-registry** — `getRecipe('items'|'loot-tables')` returns the recipes;
   each verify/author prompt contains the asset spec + section known assets.
5. **store** — `entitiesByCatalog` has spellbook+items+loot after init; Round-1
   `catalogStore.test.ts` (Spellbook seed) still green (no regression).
6. **CatalogLifecycleCell** — renders the lifecycle label + asset count.
- ItemCatalog retrofit: no new test (UI wiring); verified by typecheck + the
  store/seed tests + a no-regression read, mirroring the Spellbook retrofit.

## 4. Concurrency & integration
All new files except small additive edits to `catalogStore.ts` (`buildInitial` +
one selector), `recipe.ts` (RECIPES map + 2 recipe consts), `ue-known-assets.ts`
(additive entries + 2 switch cases), and the `ItemCatalog` retrofit (re-read-gated).
`cli-task.ts` untouched (D1). Commit locally to master; targeted `git add`;
≤200 LOC on new `.tsx` (scoped lint gate). The lifecycle/ueAssets data the cell
shows is already persisted by Round-1's `catalog_lifecycle` table + `loadLifecycle`.

## 5. Open risks
- **Loot data shape** — `LootTableVisualizer` has several arrays
  (`SMART_LOOT_DATA`, `DEFAULT_ENEMY_LOOT_BINDINGS`, …); the canonical "loot
  table" source for `LootTableEntry.data` is picked at plan time after reading
  `data*.ts`. If none is a clean weighted-table list, `LootTableEntry.data`
  takes the closest existing shape (no new game data invented).
- **ItemCatalog ownership** — it had recent "+10 visualization sections" work; the
  retrofit is re-read-gated and stops on conflict (D2 accepted this risk).
