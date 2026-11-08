import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { pickerItemsFor } from '@/components/modules/core-engine/sub_inventory/catalog/EquipmentLoadoutSection';
import { getInventoryItems } from '@/components/modules/core-engine/sub_inventory/_shared/useInventoryItems';
import { useCatalogStore } from '@/stores/catalogStore';
import { itemToEntry } from '@/lib/catalog/seed-items';

/**
 * The Equipment Loadout picker lists items from the catalog store (the system of
 * record the grid, Add Item, stash and comparison already use), not DUMMY_ITEMS -
 * so a designer-added or generated item can be equipped.
 */
const FROSTBRAND: ItemData = {
  id: 'user-frostbrand-loadout', name: 'Frostbrand', type: 'Weapon', subtype: 'Sword', rarity: 'Rare',
  stats: [{ label: 'Damage', value: '30', numericValue: 30, maxValue: 50 }], description: 'cold',
};

const seed = useCatalogStore.getState().entitiesByCatalog;
afterEach(() => { useCatalogStore.setState({ entitiesByCatalog: seed }); });

describe('loadout picker resolves against the catalog store', () => {
  it('a catalog-only item is offered for its slot', () => {
    useCatalogStore.getState().addEntity('items', itemToEntry(FROSTBRAND));
    const names = pickerItemsFor('MainHand', getInventoryItems()).map((i) => i.name);
    expect(names).toContain('Frostbrand');
  });

  it('items whose subtype does not fit the slot are filtered out', () => {
    expect(pickerItemsFor('Ring', [FROSTBRAND])).toHaveLength(0);
    expect(pickerItemsFor(null, [FROSTBRAND])).toHaveLength(0);
  });

  it('the section no longer reads the static DUMMY_ITEMS list', () => {
    const src = fs.readFileSync(path.join(process.cwd(),
      'src/components/modules/core-engine/sub_inventory/catalog/EquipmentLoadoutSection.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/\bDUMMY_ITEMS\b/);
    expect(src).toContain('useInventoryItems(');
  });
});
