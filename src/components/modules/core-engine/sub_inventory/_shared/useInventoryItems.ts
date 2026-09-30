'use client';

import { useMemo } from 'react';
import { useItemEntries } from '@/stores/catalogStore';
import type { ItemEntry } from '@/lib/catalog/types';
import { DUMMY_ITEMS, type ItemData } from './data';

/**
 * The Item Catalog's one answer to "which items exist": the built-in items
 * merged with designer-authored catalogStore items. A catalog entry wins on an
 * id collision; built-in order is kept and new catalog items append.
 */
export function mergeInventoryItems(
  base: readonly ItemData[], entries: readonly Pick<ItemEntry, 'data'>[],
): ItemData[] {
  if (entries.length === 0) return [...base];
  const byId = new Map<string, ItemData>();
  for (const it of base) byId.set(it.id, it);
  for (const e of entries) byId.set(e.data.id, e.data);
  return [...byId.values()];
}

/** Built-in + catalogStore items, shared by the Balance Advisor and the loot filter. */
export function useInventoryItems(): ItemData[] {
  const entries = useItemEntries();
  return useMemo(() => mergeInventoryItems(DUMMY_ITEMS, entries), [entries]);
}
