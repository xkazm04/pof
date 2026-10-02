import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { useCatalogStore } from '@/stores/catalogStore';
import { itemToEntry } from '@/lib/catalog/seed-items';
import { spatialItemLookup, useSpatialInventoryStore } from '@/stores/spatialInventoryStore';
import { computePackingMetrics, createStashTab, getItemFootprint, type StashTab } from '@/lib/spatial-inventory';
import { SpatialStashPalette } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/SpatialStashPalette';
import { SpatialStashGrid } from '@/components/modules/core-engine/sub_inventory/catalog/spatial-stash/SpatialStashGrid';
import { ItemComparisonPanel } from '@/components/modules/core-engine/sub_inventory/catalog/ItemComparisonPanel';

/**
 * Acceptance for scan-sweep --challenge card inventory-catalog/A: the Catalog & Gear
 * tab's stash and comparison resolve item ids against the catalog store (the system of
 * record the grid and Add Item already use), never against the static DUMMY_ITEMS list.
 */

const item = (id: string, name: string, over: Partial<ItemData> = {}): ItemData => ({
  id, name, type: 'Weapon', subtype: 'Sword', rarity: 'Rare',
  stats: [{ label: 'Damage', value: '30', numericValue: 30, maxValue: 50 }],
  description: `${name} desc`, ...over,
});
const FROSTBRAND = item('user-frostbrand-x', 'Frostbrand');
const ACCENT = 'currentColor';

let catalogSeed: ReturnType<typeof useCatalogStore.getState>['entitiesByCatalog'];
let stashSeed: Pick<ReturnType<typeof useSpatialInventoryStore.getState>, 'tabsById' | 'order' | 'activeTabId'>;
beforeEach(() => {
  catalogSeed = useCatalogStore.getState().entitiesByCatalog;
  const s = useSpatialInventoryStore.getState();
  stashSeed = { tabsById: s.tabsById, order: s.order, activeTabId: s.activeTabId };
});
afterEach(() => {
  cleanup();
  useCatalogStore.setState({ entitiesByCatalog: catalogSeed });
  useSpatialInventoryStore.setState(stashSeed);
});

const addItem = (it: ItemData) => useCatalogStore.getState().addEntity('items', itemToEntry(it));
const emptyStashTabId = () => {
  const s = useSpatialInventoryStore.getState();
  return s.order.find((id) => s.tabsById[id].items.length === 0)!;
};

describe('stash store resolves ids against the catalog store', () => {
  it('case 1: a catalog-only item resolves through spatialItemLookup', () => {
    addItem(FROSTBRAND);
    expect(spatialItemLookup('user-frostbrand-x')?.name).toBe('Frostbrand');
  });

  it('case 2: placeItem accepts a catalog-only id and sizes it by its footprint', () => {
    addItem(FROSTBRAND);
    const tabId = emptyStashTabId();
    const pid = useSpatialInventoryStore.getState().placeItem(tabId, 'user-frostbrand-x');
    expect(pid).not.toBeNull();
    const placed = useSpatialInventoryStore.getState().tabsById[tabId].items;
    const fp = getItemFootprint(FROSTBRAND);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ itemId: 'user-frostbrand-x', w: fp.w, h: fp.h });
  });

  it('case 3: a catalog entry re-using a seed id wins (mergeInventoryItems rule)', () => {
    addItem(item('8', 'Void Daggers (tuned)', { subtype: 'Dagger', rarity: 'Legendary' }));
    expect(spatialItemLookup('8')?.name).toBe('Void Daggers (tuned)');
  });

  it('honest floor: an id the catalog store does not hold is unresolved, never a DUMMY_ITEMS fallback', () => {
    const items = { ...(catalogSeed.items ?? {}) };
    delete items['item-8'];
    useCatalogStore.setState({ entitiesByCatalog: { ...catalogSeed, items } });
    expect(spatialItemLookup('8')).toBeUndefined();
    expect(useSpatialInventoryStore.getState().placeItem(emptyStashTabId(), '8')).toBeNull();
  });

  it('[guard] case 7: packing metrics count an unresolved placement but invent no type/rarity', () => {
    const tab: StashTab = {
      ...createStashTab('t', 'T', 4, 4),
      items: [{ id: 'p', itemId: 'nowhere-id', x: 0, y: 0, w: 2, h: 2, rotated: false }],
    };
    const m = computePackingMetrics(tab, spatialItemLookup);
    expect(m.usedCells).toBe(4);
    expect(m.itemCount).toBe(1);
    expect(m.byType).toEqual({});
    expect(m.byRarity).toEqual({});
  });
});

describe('stash and comparison UI read the catalog store', () => {
  it('case 4: the stash palette lists a catalog-only item with its footprint', () => {
    addItem(FROSTBRAND);
    render(<SpatialStashPalette accent={ACCENT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weapon' }));
    fireEvent.change(screen.getByPlaceholderText('Search items…'), { target: { value: 'frost' } });
    expect(screen.queryByText('No items match.')).toBeNull();
    const row = screen.getByText('Frostbrand').closest('[draggable]') as HTMLElement;
    expect(row).toBeTruthy();
    const fp = getItemFootprint(FROSTBRAND);
    expect(within(row).getByText(`${fp.w}×${fp.h}`)).toBeTruthy();
  });

  it('case 5: ItemComparisonPanel with no items prop offers a catalog-only item', () => {
    addItem(FROSTBRAND);
    render(<ItemComparisonPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Weapon' }));
    const slotA = screen.getAllByRole('combobox')[0];
    expect(within(slotA).getByRole('option', { name: 'Frostbrand (Rare)' })).toBeTruthy();
  });

  it('case 6: a placed tile re-resolves when the catalog gains the item (no remount)', () => {
    const tab: StashTab = {
      ...createStashTab('late-tab', 'Late', 6, 6),
      items: [{ id: 'p-late', itemId: 'user-late', x: 0, y: 0, w: 1, h: 3, rotated: false }],
    };
    render(<SpatialStashGrid tab={tab} accent={ACCENT} />);
    const label = screen.getByText('?');
    const tile = label.closest('[draggable]') as HTMLElement;
    expect(tile.getAttribute('title')).toMatch(/unresolved/i);
    act(() => { addItem(item('user-late', 'Late Blade')); });
    expect(label.isConnected).toBe(true);
    expect(label.textContent).toBe('Late Blade');
    expect(screen.queryByText('?')).toBeNull();
  });

  it('[guard] case 8: an explicit items prop still wins over the catalog store', () => {
    addItem(FROSTBRAND);
    const only = [item('a', 'Alpha Blade'), item('b', 'Beta Blade')];
    render(<ItemComparisonPanel items={only} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weapon' }));
    const slotA = screen.getAllByRole('combobox')[0];
    expect(within(slotA).queryByRole('option', { name: 'Frostbrand (Rare)' })).toBeNull();
    expect(within(slotA).getByRole('option', { name: 'Alpha Blade (Rare)' })).toBeTruthy();
  });
});
