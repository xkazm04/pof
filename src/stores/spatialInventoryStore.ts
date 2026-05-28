'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import {
  createStashTab,
  packFirstFit,
  placePlacement,
  removePlacement,
  movePlacement,
  getItemFootprint,
  findFirstFit,
  type StashTab,
  type PlacedItem,
} from '@/lib/spatial-inventory';
import { DUMMY_ITEMS, type ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';

interface SpatialInventoryState {
  tabsById: Record<string, StashTab>;
  order: string[];
  activeTabId: string;

  addTab: (name?: string, cols?: number, rows?: number) => string;
  renameTab: (id: string, name: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;

  /** Place an item from the catalog into a tab. Returns the placement id or null if it didn't fit. */
  placeItem: (tabId: string, itemId: string, at?: { x: number; y: number; rotated?: boolean }) => string | null;
  removePlacement: (tabId: string, placementId: string) => void;
  movePlacement: (
    tabId: string,
    placementId: string,
    x: number,
    y: number,
    rotated?: boolean,
  ) => boolean;
  /** Re-pack the active tab from scratch using DUMMY_ITEMS — handy for resets. */
  reseedActiveTab: () => void;
}

let _seq = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;

function lookupItem(itemId: string): ItemData | undefined {
  return DUMMY_ITEMS.find((i) => i.id === itemId);
}

function createInitial(): Pick<SpatialInventoryState, 'tabsById' | 'order' | 'activeTabId'> {
  const main = packFirstFit(
    createStashTab(uid('tab'), 'Main'),
    // Seed the demo tab with a representative slice of the catalog so the
    // Capacity Planner has live data on first paint.
    DUMMY_ITEMS.slice(0, 18),
    () => uid('p'),
  );
  const stash = createStashTab(uid('tab'), 'Stash', 12, 6);
  return {
    tabsById: { [main.id]: main, [stash.id]: stash },
    order: [main.id, stash.id],
    activeTabId: main.id,
  };
}

export const useSpatialInventoryStore = create<SpatialInventoryState>()(
  persist(
    (set) => ({
      ...createInitial(),

      addTab: (name, cols, rows) => {
        const id = uid('tab');
        const tab = createStashTab(id, name?.trim() || 'New Tab', cols, rows);
        set((s) => ({
          tabsById: { ...s.tabsById, [id]: tab },
          order: [...s.order, id],
          activeTabId: id,
        }));
        return id;
      },

      renameTab: (id, name) =>
        set((s) => {
          const tab = s.tabsById[id];
          if (!tab) return s;
          const trimmed = name.trim() || tab.name;
          if (trimmed === tab.name) return s;
          return { tabsById: { ...s.tabsById, [id]: { ...tab, name: trimmed } } };
        }),

      removeTab: (id) =>
        set((s) => {
          if (!s.tabsById[id] || s.order.length <= 1) return s;
          const rest = { ...s.tabsById };
          delete rest[id];
          const order = s.order.filter((x) => x !== id);
          const active = s.activeTabId === id ? order[0] : s.activeTabId;
          return { tabsById: rest, order, activeTabId: active };
        }),

      setActiveTab: (id) =>
        set((s) => (s.tabsById[id] && s.activeTabId !== id ? { activeTabId: id } : s)),

      placeItem: (tabId, itemId, at) => {
        const item = lookupItem(itemId);
        if (!item) return null;
        const fp = getItemFootprint(item);
        const rotated = at?.rotated ?? false;
        const w = rotated ? fp.h : fp.w;
        const h = rotated ? fp.w : fp.h;
        let placementId: string | null = null;
        set((s) => {
          const tab = s.tabsById[tabId];
          if (!tab) return s;
          const spot = at ?? findFirstFit(tab, w, h);
          if (!spot) return s;
          const placement: PlacedItem = {
            id: uid('p'),
            itemId,
            x: spot.x,
            y: spot.y,
            w,
            h,
            rotated,
          };
          const next = placePlacement(tab, placement);
          if (next === tab) return s;
          placementId = placement.id;
          return { tabsById: { ...s.tabsById, [tabId]: next } };
        });
        return placementId;
      },

      removePlacement: (tabId, placementId) =>
        set((s) => {
          const tab = s.tabsById[tabId];
          if (!tab) return s;
          const next = removePlacement(tab, placementId);
          return next === tab ? s : { tabsById: { ...s.tabsById, [tabId]: next } };
        }),

      movePlacement: (tabId, placementId, x, y, rotated) => {
        let moved = false;
        set((s) => {
          const tab = s.tabsById[tabId];
          if (!tab) return s;
          const next = movePlacement(tab, placementId, x, y, rotated);
          if (next === tab) return s;
          moved = true;
          return { tabsById: { ...s.tabsById, [tabId]: next } };
        });
        return moved;
      },

      reseedActiveTab: () =>
        set((s) => {
          const tab = s.tabsById[s.activeTabId];
          if (!tab) return s;
          const fresh = createStashTab(tab.id, tab.name, tab.cols, tab.rows);
          const packed = packFirstFit(fresh, DUMMY_ITEMS.slice(0, 18), () => uid('p'));
          return { tabsById: { ...s.tabsById, [tab.id]: packed } };
        }),
    }),
    {
      name: 'pof-spatial-inventory',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        tabsById: s.tabsById,
        order: s.order,
        activeTabId: s.activeTabId,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<SpatialInventoryState> | undefined;
        const byId = p?.tabsById;
        if (!byId || Object.keys(byId).length === 0) return current;
        const order = p?.order?.length ? p.order : Object.keys(byId);
        const active = p?.activeTabId && byId[p.activeTabId] ? p.activeTabId : order[0];
        return { ...current, tabsById: byId, order, activeTabId: active };
      },
    },
  ),
);

/* ── Selectors ────────────────────────────────────────────────────────── */

export function useActiveStashTab(): StashTab {
  return useSpatialInventoryStore((s) => s.tabsById[s.activeTabId] ?? s.tabsById[s.order[0]]);
}

export function useStashTabList(): StashTab[] {
  return useSpatialInventoryStore(
    useShallow((s) => s.order.map((id) => s.tabsById[id]).filter(Boolean)),
  );
}

export function useAllStashTabs(): StashTab[] {
  return useSpatialInventoryStore(useShallow((s) => Object.values(s.tabsById)));
}

/** Resolve item metadata for the metrics computation. */
export function spatialItemLookup(itemId: string): ItemData | undefined {
  return lookupItem(itemId);
}
