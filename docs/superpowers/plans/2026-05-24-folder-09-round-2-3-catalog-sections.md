# Folder 09 · Round 2 (substrate) + Round 3 (Items & Loot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Generalize the Round-1 catalog into a multi-section substrate (section registry, multi-section seeding, recipe registry, known-assets, reusable lifecycle cell, entity-generic dispatch), then register **Items** and **Loot Tables** as catalog data and retrofit the **ItemCatalog** UI to show lifecycle + (Re)generate.

**Architecture:** A new `sections.ts` registry feeds the store's `buildInitial`; `recipe.ts` gains items/loot recipes via its internal map (so `getRecipe` is unchanged); seeds convert each section's existing static data; the dispatch path (`GenerateTask`/`TaskFactory.generate`/`useGeneration`) widens from `AbilityEntry` to the base `StoredCatalogEntity` so any section can generate; a reusable `CatalogLifecycleCell` is dropped into `ItemCatalog`'s gear tab.

**Tech Stack:** TypeScript, Zustand v5, zod v4, Vitest, @testing-library/react.

**Spec:** [`../specs/2026-05-24-folder-09-round-2-3-catalog-sections-design.md`](../specs/2026-05-24-folder-09-round-2-3-catalog-sections-design.md).

**D1 refinement (disclosed):** the spec said "`cli-task.ts` untouched". The chosen ItemCatalog **(Re)generate** affordance (D2) requires the dispatch path to accept item entities, so **Task 9 makes a minimal *additive* type-widening** in `cli-task.ts` (`GenerateTask.entity` + `TaskFactory.generate` param: `AbilityEntry → StoredCatalogEntity`). Backward-compatible (`AbilityEntry ⊂ StoredCatalogEntity`); Spellbook generation unaffected. This is Round-2's "generalize the substrate" intent.

**Reuse (do NOT rebuild):** Round-1 `types.ts`/`catalogStore.ts`/`recipe.ts`/`lifecycle.ts`/`LifecycleBadge`/`useGeneration`; the existing `ItemCatalog`/`LootTableVisualizer` static data (read-only); `ue-known-assets.ts` (extend).

**Concurrency:** all new files except additive edits to `catalogStore.ts`, `recipe.ts`, `cli-task.ts` (Task 9), `ue-known-assets.ts`, `useGeneration.ts`, and the re-read-gated `CatalogGearTab.tsx`. Targeted `git add`; commit locally to master; ≤200 LOC on new `.tsx`.

**Grounded data shapes:**
- `ItemData` (`…/ItemCatalog/data.ts`): `{ id, name, type, subtype, rarity, stats[], description, effect?, imagePath?, affixes? }`; exported `DUMMY_ITEMS: ItemData[]`.
- `EnemyLootBinding` (`…/LootTableVisualizer/data-binding.ts`): `{ archetypeId, archetypeName, color, icon, lootTableName, dropChance, rarityWeights[], bonusGold }`; exported `DEFAULT_ENEMY_LOOT_BINDINGS: EnemyLootBinding[]`.

---

## Task 1: Items & Loot entity types (additive)

**Files:** Modify `src/lib/catalog/types.ts`

- [ ] **Step 1: Re-read `src/lib/catalog/types.ts`, then append the two entity types** (after `AbilityEntry`, leaving everything else unchanged):

```ts
import type { ItemData } from '@/components/modules/core-engine/unique-tabs/ItemCatalog/data';
import type { EnemyLootBinding } from '@/components/modules/core-engine/unique-tabs/LootTableVisualizer/data-binding';

/** Items catalog entity — payload reuses the existing ItemCatalog UI shape. */
export interface ItemEntry extends CatalogEntityBase {
  catalogId: 'items';
  data: ItemData;
}

/** Loot-table catalog entity — payload reuses the existing enemy→loot binding shape. */
export interface LootTableEntry extends CatalogEntityBase {
  catalogId: 'loot-tables';
  data: EnemyLootBinding;
}
```
(Put the two `import type` lines at the top with the existing `SpellbookAbility` import.)

- [ ] **Step 2: Verify existing catalog tests still pass (no regression)**

Run: `npx vitest run src/__tests__/lib/catalog src/__tests__/stores/catalogStore.test.ts src/__tests__/stores/catalogStore-lifecycle.test.ts`
Expected: PASS (the additions are unused so far).

- [ ] **Step 3: Commit**

```bash
git add src/lib/catalog/types.ts
git commit -m "feat(catalog): ItemEntry + LootTableEntry types (folder-09 R3)"
```

---

## Task 2: Items seed converter

**Files:** Create `src/lib/catalog/seed-items.ts`; Test `src/__tests__/lib/catalog/seed-items.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/seed-items.test.ts
import { describe, it, expect } from 'vitest';
import { itemToEntry, seedItemEntries } from '@/lib/catalog/seed-items';
import { DUMMY_ITEMS } from '@/components/modules/core-engine/unique-tabs/ItemCatalog/data';

describe('itemToEntry', () => {
  const it0 = DUMMY_ITEMS[0];
  it('prefixes id, keeps name, data === input', () => {
    const e = itemToEntry(it0);
    expect(e.id).toBe(`item-${it0.id}`);
    expect(e.name).toBe(it0.name);
    expect(e.data).toBe(it0);
    expect(e.catalogId).toBe('items');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [type, rarity] and tags = [type, subtype]', () => {
    const e = itemToEntry(it0);
    expect(e.categoryPath).toEqual([it0.type, it0.rarity]);
    expect(e.tags).toEqual([it0.type, it0.subtype]);
  });
});

describe('seedItemEntries', () => {
  it('maps every item with unique ids', () => {
    const entries = seedItemEntries();
    expect(entries.length).toBe(DUMMY_ITEMS.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/seed-items.test.ts`
Expected: FAIL — cannot resolve `@/lib/catalog/seed-items`.

- [ ] **Step 3: Implement**

```ts
// src/lib/catalog/seed-items.ts
import { DUMMY_ITEMS, type ItemData } from '@/components/modules/core-engine/unique-tabs/ItemCatalog/data';
import type { ItemEntry } from './types';

/** Convert one static ItemData into a catalog ItemEntry. */
export function itemToEntry(item: ItemData): ItemEntry {
  return {
    id: `item-${item.id}`,
    catalogId: 'items',
    name: item.name,
    categoryPath: [item.type, item.rarity],
    tags: [item.type, item.subtype],
    lifecycle: 'planned',
    data: item,
  };
}

/** Seed the items catalog from the existing static item list. */
export function seedItemEntries(): ItemEntry[] {
  return DUMMY_ITEMS.map(itemToEntry);
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/seed-items.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/seed-items.ts src/__tests__/lib/catalog/seed-items.test.ts
git commit -m "feat(catalog): items seed converter from DUMMY_ITEMS (folder-09 R3)"
```

---

## Task 3: Loot seed converter

**Files:** Create `src/lib/catalog/seed-loot.ts`; Test `src/__tests__/lib/catalog/seed-loot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/seed-loot.test.ts
import { describe, it, expect } from 'vitest';
import { lootBindingToEntry, seedLootEntries } from '@/lib/catalog/seed-loot';
import { DEFAULT_ENEMY_LOOT_BINDINGS } from '@/components/modules/core-engine/unique-tabs/LootTableVisualizer/data-binding';

describe('lootBindingToEntry', () => {
  it('maps a boss binding to a Boss tier', () => {
    const boss = DEFAULT_ENEMY_LOOT_BINDINGS.find((b) => b.dropChance >= 1)!;
    const e = lootBindingToEntry(boss);
    expect(e.id).toBe(`lt-${boss.archetypeId}`);
    expect(e.name).toBe(boss.lootTableName);
    expect(e.catalogId).toBe('loot-tables');
    expect(e.categoryPath).toEqual(['Loot Tables', 'Boss']);
    expect(e.data).toBe(boss);
  });
  it('maps a minion (low dropChance) to a Minion tier', () => {
    const minion = DEFAULT_ENEMY_LOOT_BINDINGS.find((b) => b.dropChance < 0.32)!;
    expect(lootBindingToEntry(minion).categoryPath).toEqual(['Loot Tables', 'Minion']);
  });
});

describe('seedLootEntries', () => {
  it('maps every binding with unique ids', () => {
    const entries = seedLootEntries();
    expect(entries.length).toBe(DEFAULT_ENEMY_LOOT_BINDINGS.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/seed-loot.test.ts`
Expected: FAIL — cannot resolve `@/lib/catalog/seed-loot`.

- [ ] **Step 3: Implement**

```ts
// src/lib/catalog/seed-loot.ts
import {
  DEFAULT_ENEMY_LOOT_BINDINGS,
  type EnemyLootBinding,
} from '@/components/modules/core-engine/unique-tabs/LootTableVisualizer/data-binding';
import type { LootTableEntry } from './types';

/** Bucket a drop chance into a difficulty tier for the L4 taxonomy. */
function tierOf(dropChance: number): string {
  if (dropChance >= 1) return 'Boss';
  if (dropChance >= 0.5) return 'Elite';
  if (dropChance >= 0.32) return 'Standard';
  return 'Minion';
}

/** Convert one enemy→loot binding into a catalog LootTableEntry. */
export function lootBindingToEntry(binding: EnemyLootBinding): LootTableEntry {
  return {
    id: `lt-${binding.archetypeId}`,
    catalogId: 'loot-tables',
    name: binding.lootTableName,
    categoryPath: ['Loot Tables', tierOf(binding.dropChance)],
    tags: [binding.archetypeName],
    lifecycle: 'planned',
    data: binding,
  };
}

/** Seed the loot-tables catalog from the existing enemy→loot bindings. */
export function seedLootEntries(): LootTableEntry[] {
  return DEFAULT_ENEMY_LOOT_BINDINGS.map(lootBindingToEntry);
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/seed-loot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/seed-loot.ts src/__tests__/lib/catalog/seed-loot.test.ts
git commit -m "feat(catalog): loot-table seed converter from enemy bindings (folder-09 R3)"
```

---

## Task 4: Section registry

**Files:** Create `src/lib/catalog/sections.ts`; Test `src/__tests__/lib/catalog/sections.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/sections.test.ts
import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS, seedAllCatalogs } from '@/lib/catalog/sections';

describe('CATALOG_SECTIONS', () => {
  it('registers spellbook, items, and loot-tables', () => {
    expect(CATALOG_SECTIONS.map((s) => s.catalogId).sort())
      .toEqual(['items', 'loot-tables', 'spellbook']);
  });
});

describe('seedAllCatalogs', () => {
  const seeded = seedAllCatalogs();
  it('produces a non-empty map per registered catalog', () => {
    for (const s of CATALOG_SECTIONS) {
      expect(Object.keys(seeded[s.catalogId]).length).toBeGreaterThan(0);
    }
  });
  it('every entity is planned with a categoryPath', () => {
    for (const byId of Object.values(seeded)) {
      for (const e of Object.values(byId)) {
        expect(e.lifecycle).toBe('planned');
        expect(e.categoryPath.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/sections.test.ts`
Expected: FAIL — cannot resolve `@/lib/catalog/sections`.

- [ ] **Step 3: Implement**

```ts
// src/lib/catalog/sections.ts
import type { CatalogEntityBase } from './types';
import { seedSpellbookEntries } from './seed-spellbook';
import { seedItemEntries } from './seed-items';
import { seedLootEntries } from './seed-loot';

/** A Core Engine catalog section: its id, label, and how to seed it. */
export interface CatalogSection {
  catalogId: string;
  label: string;
  seed: () => CatalogEntityBase[];
}

export const CATALOG_SECTIONS: CatalogSection[] = [
  { catalogId: 'spellbook', label: 'Spellbook', seed: seedSpellbookEntries },
  { catalogId: 'items', label: 'Items', seed: seedItemEntries },
  { catalogId: 'loot-tables', label: 'Loot Tables', seed: seedLootEntries },
];

function indexById(entities: CatalogEntityBase[]): Record<string, CatalogEntityBase> {
  const map: Record<string, CatalogEntityBase> = {};
  for (const e of entities) map[e.id] = e;
  return map;
}

/** Seed every registered catalog: { [catalogId]: { [entityId]: entity } }. */
export function seedAllCatalogs(): Record<string, Record<string, CatalogEntityBase>> {
  const out: Record<string, Record<string, CatalogEntityBase>> = {};
  for (const s of CATALOG_SECTIONS) out[s.catalogId] = indexById(s.seed());
  return out;
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/sections.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/sections.ts src/__tests__/lib/catalog/sections.test.ts
git commit -m "feat(catalog): section registry + seedAllCatalogs (folder-09 R2)"
```

---

## Task 5: Store seeds all catalogs + `useItemEntries`

**Files:** Modify `src/stores/catalogStore.ts`; Test `src/__tests__/stores/catalogStore-sections.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/stores/catalogStore-sections.test.ts
import { describe, it, expect } from 'vitest';
import { useCatalogStore } from '@/stores/catalogStore';

describe('catalogStore multi-section seeding', () => {
  it('seeds spellbook, items, and loot-tables on init', () => {
    const byCat = useCatalogStore.getState().entitiesByCatalog;
    expect(Object.keys(byCat.spellbook ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(byCat.items ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(byCat['loot-tables'] ?? {}).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/stores/catalogStore-sections.test.ts`
Expected: FAIL — `items`/`loot-tables` are empty (store still seeds only spellbook).

- [ ] **Step 3: Re-read `src/stores/catalogStore.ts`, then make `buildInitial` use the registry + add `useItemEntries`**

Replace the `seedSpellbookEntries` import + `buildInitial` with the registry; keep everything else (selectors, lifecycle actions, merge) unchanged. Change the import line:
```ts
import { seedAllCatalogs } from '@/lib/catalog/sections';
```
(remove the now-unused `import { seedSpellbookEntries } from '@/lib/catalog/seed-spellbook';`). Replace `buildInitial`:
```ts
function buildInitial(): Record<string, Record<string, CatalogEntityBase>> {
  return seedAllCatalogs();
}
```
Add a typed selector next to `useSpellbookEntries` (import `ItemEntry` in the type import):
```ts
/** Typed convenience for the items catalog. */
export function useItemEntries(): ItemEntry[] {
  return useCatalogStore(
    useShallow((s) => Object.values(s.entitiesByCatalog.items ?? {}) as ItemEntry[]),
  );
}
```
Update the type import to add `ItemEntry`:
```ts
import type { CatalogEntityBase, AbilityEntry, ItemEntry, LifecycleState, TestResult, LifecycleRecord } from '@/lib/catalog/types';
```

- [ ] **Step 4: Run new + Round-1 store tests (no regression)**

Run: `npx vitest run src/__tests__/stores/catalogStore-sections.test.ts src/__tests__/stores/catalogStore.test.ts src/__tests__/stores/catalogStore-lifecycle.test.ts`
Expected: PASS — new (1) + Round-1 Spellbook-seed test still green (spellbook still seeded) + lifecycle actions (7).

- [ ] **Step 5: Commit**

```bash
git add src/stores/catalogStore.ts src/__tests__/stores/catalogStore-sections.test.ts
git commit -m "feat(catalog): store seeds all sections via registry + useItemEntries (folder-09 R2)"
```

---

## Task 6: Items & Loot recipes in the registry

**Files:** Modify `src/lib/catalog/recipe.ts`; Test `src/__tests__/lib/catalog/recipe-sections.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/recipe-sections.test.ts
import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { ItemEntry, LootTableEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

describe('getRecipe for data-asset sections', () => {
  it('returns an items recipe whose author prompt names UARPGItemDefinition', () => {
    const r = getRecipe('items');
    expect(r).toBeDefined();
    const item: ItemEntry = {
      id: 'item-1', catalogId: 'items', name: 'Iron Longsword',
      categoryPath: ['Weapon', 'Common'], tags: ['Weapon', 'Sword'], lifecycle: 'planned',
      data: { id: '1', name: 'Iron Longsword', type: 'Weapon', subtype: 'Sword', rarity: 'Common', stats: [], description: '' },
    };
    const p = r!.buildStepPrompt(item, 'author-python', ctx);
    expect(p).toContain('Asset Specification');
    expect(p).toContain('UARPGItemDefinition');
    expect(p).toContain('Iron Longsword');
  });
  it('returns a loot recipe whose author prompt names UARPGLootTable', () => {
    const r = getRecipe('loot-tables');
    expect(r).toBeDefined();
    const lt: LootTableEntry = {
      id: 'lt-MeleeGrunt', catalogId: 'loot-tables', name: 'LT_Grunt',
      categoryPath: ['Loot Tables', 'Minion'], tags: ['Melee Grunt'], lifecycle: 'planned',
      data: { archetypeId: 'MeleeGrunt', archetypeName: 'Melee Grunt', color: '#0f0', icon: 'FG', lootTableName: 'LT_Grunt', dropChance: 0.3, rarityWeights: [60,25,10,4,1], bonusGold: 15 },
    };
    const p = r!.buildStepPrompt(lt, 'author-python', ctx);
    expect(p).toContain('UARPGLootTable');
    expect(p).toContain('LT_Grunt');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-sections.test.ts`
Expected: FAIL — `getRecipe('items')` is `undefined`.

- [ ] **Step 3: Re-read `src/lib/catalog/recipe.ts`, then add the two recipes + widen the map**

Add imports at top:
```ts
import type { ItemEntry, LootTableEntry } from '@/lib/catalog/types';
```
Add the two recipes (after `SPELLBOOK_RECIPE`):
```ts
const ITEM_BEST_PRACTICES = [
  'Author a `UARPGItemDefinition` data asset (Python, FULL editor via -ExecutePythonScript), not -run=pythonscript.',
  'Set the item type/rarity/stats from the Asset Specification; do not invent new fields.',
  'Place the asset under `/Game/Items/` and report its content path.',
];

export const ITEMS_RECIPE: GenerationRecipe<ItemEntry> = {
  id: 'items-definition',
  catalogId: 'items',
  steps: ['author-python', 'wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSItems.VSItemsDefinitionsTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author a UARPGItemDefinition data asset for "${entity.name}" from its spec.`
        : step === 'wire'
          ? `Register "${entity.name}" so it is discoverable by the item registry / a loot table.`
          : `Run the item-definitions functional test; assert the asset loads with valid fields.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('UARPGItemDefinition data-asset authoring for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Items · ${step}`, task)
      .withBestPractices(ITEM_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};

const LOOT_BEST_PRACTICES = [
  'Author a `UARPGLootTable` data asset (Python, FULL editor) with weighted entries from the spec.',
  'Preserve the configured drop chance and rarity weights; do not invent items.',
  'Place the asset under `/Game/Loot/` and report its content path.',
];

export const LOOT_RECIPE: GenerationRecipe<LootTableEntry> = {
  id: 'loot-table',
  catalogId: 'loot-tables',
  steps: ['author-python', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSLoot.VSLootDistributionTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author a UARPGLootTable data asset "${entity.name}" with the spec's weighted entries.`
        : `Run the loot-distribution functional test; assert empirical drops match the configured weights within tolerance.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('UARPGLootTable data-asset authoring for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Loot · ${step}`, task)
      .withBestPractices(LOOT_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};
```
Widen the `RECIPES` map type to base `GenerationRecipe` and add the entries. Change:
```ts
const RECIPES: Record<string, GenerationRecipe<AbilityEntry>> = {
  spellbook: SPELLBOOK_RECIPE,
};
```
to:
```ts
const RECIPES: Record<string, GenerationRecipe> = {
  spellbook: SPELLBOOK_RECIPE,
  items: ITEMS_RECIPE,
  'loot-tables': LOOT_RECIPE,
};
```
(`getRecipe` signature is unchanged.)

- [ ] **Step 4: Run new + Round-1 recipe tests**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-sections.test.ts src/__tests__/lib/catalog/recipe.test.ts`
Expected: PASS (new 2 + Round-1 6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/recipe.ts src/__tests__/lib/catalog/recipe-sections.test.ts
git commit -m "feat(catalog): items + loot recipes in the registry (folder-09 R3)"
```

---

## Task 7: Known-assets extension for items/loot

**Files:** Modify `src/lib/knowledge/ue-known-assets.ts`; Test `src/__tests__/lib/known-assets-sections.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/known-assets-sections.test.ts
import { describe, it, expect } from 'vitest';
import { knownAssetDomainsForModule, formatKnownAssets } from '@/lib/knowledge/ue-known-assets';

describe('known assets — items/loot', () => {
  it('maps inventory + loot modules to their domains', () => {
    expect(knownAssetDomainsForModule('arpg-inventory')).toEqual(['items']);
    expect(knownAssetDomainsForModule('arpg-loot')).toEqual(['loot']);
  });
  it('formats item/loot base-class known assets', () => {
    expect(formatKnownAssets(['items'])).toContain('UARPGItemDefinition');
    expect(formatKnownAssets(['loot'])).toContain('UARPGLootTable');
  });
  it('leaves unrelated modules empty', () => {
    expect(knownAssetDomainsForModule('arpg-polish')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/known-assets-sections.test.ts`
Expected: FAIL — domains are `[]` and the format lacks the item/loot classes.

- [ ] **Step 3: Re-read `src/lib/knowledge/ue-known-assets.ts`, then add entries + switch cases (additive)**

Append to `UE_KNOWN_ASSETS` (before the closing `]`):
```ts
  {
    id: 'arpg-item-definition',
    path: '/Script/PoF.ARPGItemDefinition',
    type: 'C++ Class (UARPGItemDefinition)',
    description: 'Base data-asset class for items — author instances under /Game/Items/.',
    source: 'project',
    domains: ['items'],
  },
  {
    id: 'arpg-loot-table',
    path: '/Script/PoF.ARPGLootTable',
    type: 'C++ Class (UARPGLootTable)',
    description: 'Base data-asset class for weighted loot tables — author instances under /Game/Loot/.',
    source: 'project',
    domains: ['loot'],
  },
```
Add cases to `knownAssetDomainsForModule` (before `default:`):
```ts
    case 'arpg-inventory':
      return ['items'];
    case 'arpg-loot':
      return ['loot'];
```

- [ ] **Step 4: Run new + any existing known-assets test**

Run: `npx vitest run src/__tests__/lib/known-assets-sections.test.ts`
Expected: PASS. Then `npx vitest run src/__tests__ -t "known asset"` to confirm no existing known-assets test regressed (if none exist, this run reports 0 failures).

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/ue-known-assets.ts src/__tests__/lib/known-assets-sections.test.ts
git commit -m "feat(knowledge): item/loot known assets + module domains (folder-09 R2)"
```

---

## Task 8: Reusable `CatalogLifecycleCell`

**Files:** Create `src/components/catalog/CatalogLifecycleCell.tsx`; Test `src/__tests__/components/catalog-lifecycle-cell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/catalog-lifecycle-cell.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';

describe('CatalogLifecycleCell', () => {
  it('renders the lifecycle label and asset count', () => {
    const { getByText } = render(<CatalogLifecycleCell lifecycle="generated" ueAssetCount={3} />);
    expect(getByText(/generated/i)).toBeTruthy();
    expect(getByText(/3 assets/i)).toBeTruthy();
  });
  it('shows no regenerate button when onRegenerate is omitted', () => {
    const { queryByText } = render(<CatalogLifecycleCell lifecycle="planned" ueAssetCount={0} />);
    expect(queryByText(/generate/i)).toBeNull();
  });
  it('fires onRegenerate when the button is clicked', () => {
    const onRegen = vi.fn();
    const { getByText } = render(
      <CatalogLifecycleCell lifecycle="planned" ueAssetCount={0} onRegenerate={onRegen} />,
    );
    fireEvent.click(getByText(/generate/i));
    expect(onRegen).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/components/catalog-lifecycle-cell.test.tsx`
Expected: FAIL — cannot resolve `@/components/catalog/CatalogLifecycleCell`.

- [ ] **Step 3: Implement** (≤200 LOC; reuse `LifecycleBadge` + `chart-colors`)

```tsx
// src/components/catalog/CatalogLifecycleCell.tsx
'use client';

import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import type { LifecycleState } from '@/lib/catalog/types';

export interface CatalogLifecycleCellProps {
  lifecycle: LifecycleState;
  ueAssetCount: number;
  busy?: boolean;
  /** When provided, renders a "(Re)generate" button. */
  onRegenerate?: () => void;
}

export function CatalogLifecycleCell({
  lifecycle, ueAssetCount, busy, onRegenerate,
}: CatalogLifecycleCellProps) {
  return (
    <div className="flex items-center gap-2">
      <LifecycleBadge state={lifecycle} />
      <span className="text-2xs font-mono text-text-muted">{ueAssetCount} assets</span>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={busy}
          className="text-2xs font-mono font-bold px-1.5 py-0.5 rounded border border-border/50 text-text-muted hover:text-text disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy ? 'Generating…' : '(Re)generate'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/components/catalog-lifecycle-cell.test.tsx`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/components/catalog/CatalogLifecycleCell.tsx src/__tests__/components/catalog-lifecycle-cell.test.tsx
git commit -m "feat(catalog): reusable CatalogLifecycleCell (folder-09 R2)"
```

---

## Task 9: Widen the dispatch path to any catalog entity (D1 refinement)

**Files:** Modify `src/lib/cli-task.ts`, `src/hooks/useGeneration.ts`

Make generation accept any catalog entity (not just `AbilityEntry`). Backward-compatible.

- [ ] **Step 1: Re-read `src/lib/cli-task.ts`** (hot shared file — confirm the `GenerateTask` interface + `TaskFactory.generate` match before editing).

- [ ] **Step 2: Widen the entity type (additive)**

Change the import `import type { AbilityEntry } from '@/lib/catalog/types';` to:
```ts
import type { StoredCatalogEntity } from '@/lib/catalog/types';
```
In `GenerateTask`, change `entity: AbilityEntry;` to `entity: StoredCatalogEntity;`.
In `TaskFactory.generate`, change the param `entity: AbilityEntry` to `entity: StoredCatalogEntity` (signature otherwise unchanged).

- [ ] **Step 3: Widen `useGeneration`**

Re-read `src/hooks/useGeneration.ts`; change its import + signature from `AbilityEntry` to `StoredCatalogEntity`:
```ts
import type { LifecycleRecord, StoredCatalogEntity } from '@/lib/catalog/types';
// ...
export function useGeneration(entity: StoredCatalogEntity): UseGenerationResult {
```
(Everything else — `TaskFactory.generate('arpg-gas', entity, …)`, the refetch — is unchanged. `AbilityEntry` is a `StoredCatalogEntity`, so the Spellbook call site still type-checks.)

- [ ] **Step 4: Run the affected existing tests (no regression)**

Run: `npx vitest run src/__tests__/lib/catalog/generate-task.test.ts src/__tests__/hooks/useGeneration.test.tsx`
Expected: PASS — the fireball `AbilityEntry` is still accepted (it's a `StoredCatalogEntity`).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (expect 0 errors project-wide).
```bash
git add src/lib/cli-task.ts src/hooks/useGeneration.ts
git commit -m "feat(catalog): entity-generic generation dispatch (StoredCatalogEntity) (folder-09 R2)"
```

---

## Task 10: ItemCatalog UI retrofit (lifecycle cell + Re-generate)

**Files:** Modify `src/components/modules/core-engine/unique-tabs/ItemCatalog/catalog/CatalogGearTab.tsx` (the item-card renderer)

No new test (UI wiring); verify by typecheck + the store/seed tests staying green + a no-regression read. **Re-read the file immediately before editing; if it has diverged or already has a generation affordance, STOP and report.**

- [ ] **Step 1: Re-read `CatalogGearTab.tsx`** to find the item list/card render and how it receives items (`DUMMY_ITEMS`/`ITEM_METADATA` import or props).

- [ ] **Step 2: Source items from the catalog store (additive)**

Add imports:
```ts
import { useItemEntries } from '@/stores/catalogStore';
import { useGeneration } from '@/hooks/useGeneration';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { GenerationStep } from '@/lib/catalog/recipe';
```
Inside the component, build a lifecycle lookup keyed by the item's source id (entry id = `item-${item.id}`):
```ts
  const entries = useItemEntries();
  const entryByItemId = useMemo(
    () => new Map(entries.map((e) => [e.data.id, e])),
    [entries],
  );
```
(If the gear tab maps over `DUMMY_ITEMS` directly, keep that array as the source for the existing visualization — the entries only supply lifecycle/ueAssets, so the rich UI is unchanged.)

- [ ] **Step 3: Render the lifecycle cell per item card, with a Re-generate button for the selected/primary item**

For the currently-selected (or first) item card, call `useGeneration` ONCE at the top level (rules-of-hooks) on its entry, and drop `CatalogLifecycleCell` into the card. Concretely, near the top:
```ts
  const primaryItem = /* the existing selected item, or items[0] */;
  const primaryEntry = (primaryItem && entryByItemId.get(primaryItem.id)) ?? entries[0];
  const gen = useGeneration(primaryEntry);
  const nextStep: GenerationStep =
    primaryEntry?.lifecycle === 'generated' ? 'wire'
      : primaryEntry?.lifecycle === 'wired' ? 'verify'
        : 'author-python';
```
In each item card's metadata row, render:
```tsx
{(() => {
  const entry = entryByItemId.get(item.id);
  const isPrimary = entry?.id === primaryEntry?.id;
  return (
    <CatalogLifecycleCell
      lifecycle={entry?.lifecycle ?? 'planned'}
      ueAssetCount={entry?.ueAssets?.length ?? 0}
      busy={isPrimary && gen.isRunning}
      onRegenerate={isPrimary ? () => gen.generate(nextStep) : undefined}
    />
  );
})()}
```
(The exact JSX anchor is the item card's footer/metadata area — confirm against the re-read structure. Only the primary item gets the button, because `useGeneration` is one hook call.)

- [ ] **Step 4: Typecheck + lint + targeted tests**

Run: `npx tsc --noEmit` (0 errors).
Run: `npx eslint src/components/modules/core-engine/unique-tabs/ItemCatalog/catalog/CatalogGearTab.tsx`
Run: `npx vitest run src/__tests__/stores/catalogStore-sections.test.ts src/__tests__/components/catalog-lifecycle-cell.test.tsx`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/core-engine/unique-tabs/ItemCatalog/catalog/CatalogGearTab.tsx
git commit -m "feat(catalog): ItemCatalog shows lifecycle + (Re)generate per item (folder-09 R3)"
```

---

## Final verification

- [ ] **Full validate (own work isolated from foreign failures)**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npx vitest run src/__tests__/lib/catalog src/__tests__/stores src/__tests__/components/catalog-lifecycle-cell.test.tsx src/__tests__/components/lifecycle-badge.test.tsx src/__tests__/lib/known-assets-sections.test.ts` → all green.
Run `npm run validate`; if a failure references a file you did NOT touch (foreign worktree / `.claude/worktrees/**`), note it and rely on the targeted runs (the Round-1 memory gotcha).

---

## Self-review notes

- **Spec coverage:** §2.1 sections.ts ✔ (T4) · §2.2 store ✔ (T5) · §2.3 recipe registry ✔ (T6) · §2.4 known-assets ✔ (T7) · §2.5 lifecycle cell ✔ (T8) · §2.6 Items/Loot types+seeds ✔ (T1–T3) · §2.7 ItemCatalog retrofit ✔ (T10). The dispatch widening (T9) is the disclosed D1 refinement enabling §2.7's (Re)generate.
- **Type consistency:** `ItemEntry`/`LootTableEntry`/`CatalogSection`/`seedAllCatalogs`/`seedItemEntries`/`seedLootEntries`/`itemToEntry`/`lootBindingToEntry`/`ITEMS_RECIPE`/`LOOT_RECIPE`/`useItemEntries`/`CatalogLifecycleCell`/`StoredCatalogEntity` consistent across tasks. `getRecipe` signature unchanged. `ItemData`/`EnemyLootBinding`/`DUMMY_ITEMS`/`DEFAULT_ENEMY_LOOT_BINDINGS` match the verified source shapes.
- **Ordering:** T1 (types) → T2/T3 (seeds) → T4 (registry) → T5 (store) → T6 (recipes) → T7 (known-assets) → T8 (cell) → T9 (widen) → T10 (retrofit). Every commit green.
- **No placeholders:** every code step complete; the one re-read-gated insertion (T10 Step 3) gives the imports + hook usage + cell, with the JSX anchor confirmed at execution against the live file (it's an actively-owned component).
