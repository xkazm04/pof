'use client';

import { useMemo } from 'react';
import { useCatalogStore } from '@/stores/catalogStore';
import type { CatalogEntityBase, ItemEntry } from '@/lib/catalog/types';
import type { ItemData } from './data';

/**
 * Merge a base item list with catalog entries: a catalog entry wins on an id
 * collision; base order is kept and new catalog items append.
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

/* ── The Item Catalog's one answer to "which items exist" ─────────────────
 * The catalog store (`useCatalogStore`, catalog `items`) is the system of
 * record: it holds every built-in seed (seedAllCatalogs -> DUMMY_ITEMS) plus
 * designer-authored rows, so it is resolved alone. An id it does not hold is
 * UNRESOLVED (undefined) — never answered from the static DUMMY_ITEMS list. */

type ItemsRecord = Record<string, CatalogEntityBase> | undefined;
interface ItemsSnapshot { items: ItemData[]; byId: Map<string, ItemData> }

let lastRecord: ItemsRecord | null = null;
let lastSnapshot: ItemsSnapshot = { items: [], byId: new Map() };

/** Memoized on the items-record identity, so hook and non-hook reads share one build. */
function snapshotOf(record: ItemsRecord): ItemsSnapshot {
  if (record === lastRecord) return lastSnapshot;
  const items = mergeInventoryItems([], Object.values(record ?? {}) as ItemEntry[]);
  lastRecord = record;
  lastSnapshot = { items, byId: new Map(items.map((it) => [it.id, it])) };
  return lastSnapshot;
}

const selectItemsRecord = (s: ReturnType<typeof useCatalogStore.getState>): ItemsRecord =>
  s.entitiesByCatalog.items;

/** Non-hook snapshot for zustand stores and callbacks (e.g. the spatial stash). */
export function getInventoryItems(): ItemData[] {
  return snapshotOf(selectItemsRecord(useCatalogStore.getState())).items;
}

/** Resolve one item id against the catalog store; undefined = unresolved. */
export function resolveInventoryItem(id: string): ItemData | undefined {
  return snapshotOf(selectItemsRecord(useCatalogStore.getState())).byId.get(id);
}

/** Every catalog item, reactive. Shared by the Balance Advisor, loot filter, stash and comparison. */
export function useInventoryItems(): ItemData[] {
  return snapshotOf(useCatalogStore(selectItemsRecord)).items;
}

/** A stable `(id) => ItemData | undefined` that re-renders its caller when the catalog changes. */
export function useInventoryItemLookup(): (id: string) => ItemData | undefined {
  const record = useCatalogStore(selectItemsRecord);
  return useMemo(() => {
    const { byId } = snapshotOf(record);
    return (id: string) => byId.get(id);
  }, [record]);
}
