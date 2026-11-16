import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useCatalogStore } from '@/stores/catalogStore';
import type { ItemEntry } from '@/lib/catalog/types';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { renderItemMetric } from '@/components/modules/core-engine/sub_inventory/metrics';

/**
 * The Item Catalog's Features-tab metrics describe the catalog the designer sees
 * (catalogStore `items`, the system of record), not the static DUMMY_ITEMS seed list.
 */

const ONLY: ItemData = {
  id: 'only', name: 'Lone Glaive', type: 'Weapon', subtype: 'Polearm', rarity: 'Rare',
  stats: [{ label: 'Damage', value: '37', numericValue: 37, maxValue: 74 }], description: 'catalog-only',
};
const ENTRY: ItemEntry = { id: 'only', catalogId: 'items', name: ONLY.name, categoryPath: [], tags: [], lifecycle: 'planned', data: ONLY };

let seeded: ReturnType<typeof useCatalogStore.getState>['entitiesByCatalog'];
beforeEach(() => {
  seeded = useCatalogStore.getState().entitiesByCatalog;
  useCatalogStore.setState({ entitiesByCatalog: { ...seeded, items: { only: ENTRY } } });
});
afterEach(() => {
  cleanup();
  useCatalogStore.setState({ entitiesByCatalog: seeded });
});

describe('Item Catalog feature metrics read the catalog store', () => {
  it('grid metric counts the catalog items', () => {
    const { container } = render(<>{renderItemMetric('grid')}</>);
    expect(container.textContent).toMatch(/^1 items/);
  });

  it('power metric ranges over the catalog items', () => {
    const { container } = render(<>{renderItemMetric('power')}</>);
    expect(container.textContent).toContain('37–37 power range');
  });

  it('stats metric averages the catalog items', () => {
    const { container } = render(<>{renderItemMetric('inv-stats')}</>);
    expect(container.textContent).toContain('37 avg');
  });
});
