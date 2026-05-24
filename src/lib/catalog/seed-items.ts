import { DUMMY_ITEMS, type ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
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
