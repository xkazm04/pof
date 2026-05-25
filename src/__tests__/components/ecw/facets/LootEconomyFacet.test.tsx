import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LootEconomyFacet } from '@/components/ecw/facets/loot/LootEconomyFacet';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function lootEntity(id: string, dropChance: number, weights: number[], bonusGold: number): CatalogEntityBase {
  return {
    id, catalogId: 'loot-tables', name: id, categoryPath: ['Loot Tables'], tags: [], lifecycle: 'planned',
    data: { lootTableName: id, dropChance, rarityWeights: weights, bonusGold, archetypeId: id, archetypeName: id, color: '', icon: '' },
  } as CatalogEntityBase;
}

function seed(entities: CatalogEntityBase[]) {
  const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
  for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
  for (const e of entities) seeded['loot-tables'][e.id] = e;
  useCatalogStore.setState({ entitiesByCatalog: seeded });
}

describe('LootEconomyFacet', () => {
  beforeEach(() => seed([]));
  afterEach(cleanup);

  it('renders the expected value per kill', () => {
    const e = lootEntity('LT_Grunt', 0.3, [60, 25, 10, 4, 1], 15);
    seed([e]);
    render(<LootEconomyFacet entity={e} />);
    expect(screen.getByText(/Expected Value/i)).toBeTruthy();
    expect(screen.getByText('24')).toBeTruthy(); // 0.3*29.75 + 15
  });

  it('renders the per-rarity value breakdown', () => {
    const e = lootEntity('LT_Grunt', 0.3, [60, 25, 10, 4, 1], 15);
    seed([e]);
    render(<LootEconomyFacet entity={e} />);
    expect(screen.getByText('Common')).toBeTruthy();
    expect(screen.getByText('Legendary')).toBeTruthy();
  });

  it('surfaces a lint warning for malformed weights', () => {
    const e = lootEntity('LT_Bad', 0.3, [10, 10, 10, 10, 10], 15); // sums to 50
    seed([e]);
    render(<LootEconomyFacet entity={e} />);
    expect(screen.getByText(/sum to 50/i)).toBeTruthy();
  });

  it('shows a fallback for an entity without a loot binding', () => {
    const bad = { id: 'x', catalogId: 'loot-tables', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as CatalogEntityBase;
    seed([bad]);
    render(<LootEconomyFacet entity={bad} />);
    expect(screen.getByText(/no loot binding/i)).toBeTruthy();
  });
});
