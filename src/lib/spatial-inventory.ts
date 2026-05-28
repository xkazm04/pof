/**
 * Spatial (Tetris-style) inventory primitives.
 *
 * Pure, DOM-free helpers that drive both the SpatialStashSection UI and the
 * Inventory Capacity Planner's real packing metric. Items occupy an axis-aligned
 * footprint inside a `cols × rows` grid; a `placed` array stores absolute
 * positions, and `cellMap` is the lazily-computed occupancy index.
 */

import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';

/* ── Types ────────────────────────────────────────────────────────────── */

export interface ItemFootprint {
  w: number;
  h: number;
}

export interface PlacedItem {
  /** Unique placement id (an item may appear multiple times across tabs). */
  id: string;
  /** Catalog item id this placement points at. */
  itemId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** True iff the placement is rotated 90° (w/h swapped). */
  rotated: boolean;
}

export interface StashTab {
  id: string;
  name: string;
  cols: number;
  rows: number;
  items: PlacedItem[];
}

export interface PackingMetrics {
  cols: number;
  rows: number;
  totalCells: number;
  usedCells: number;
  freeCells: number;
  itemCount: number;
  /** 0..1 — used / total */
  packing: number;
  /**
   * 0..1 — `wastedCells / freeCells`, where wasted cells are free cells that
   * are too small to host the smallest base footprint (1×1). Used as a
   * fragmentation proxy: high means "lots of holes too small to be useful".
   */
  fragmentation: number;
  /** Placements by item type. */
  byType: Record<string, number>;
  /** Cells consumed by each item type. */
  byTypeCells: Record<string, number>;
  /** Cells consumed by each item rarity. */
  byRarity: Record<string, number>;
}

/* ── Footprint table (subtype → w×h) ──────────────────────────────────── */

/**
 * Footprints are written portrait (w ≤ h). The UI is free to rotate a
 * placement which simply swaps w/h. Numbers are inspired by Diablo 2 / PoE
 * conventions so designers immediately read them as "feels right".
 */
const SUBTYPE_FOOTPRINTS: Record<string, ItemFootprint> = {
  // Weapons — longer in the y axis
  Sword: { w: 1, h: 3 },
  Bow: { w: 2, h: 3 },
  Staff: { w: 1, h: 4 },
  Dagger: { w: 1, h: 2 },
  Axe: { w: 2, h: 3 },
  Mace: { w: 2, h: 3 },
  Polearm: { w: 1, h: 4 },
  Baton: { w: 1, h: 2 },
  Shield: { w: 2, h: 2 },
  // Armor
  Helm: { w: 2, h: 2 },
  Chestplate: { w: 2, h: 3 },
  Greaves: { w: 2, h: 2 },
  Boots: { w: 2, h: 2 },
  Gauntlets: { w: 2, h: 2 },
  // Accessories
  Ring: { w: 1, h: 1 },
  Amulet: { w: 1, h: 1 },
  Belt: { w: 2, h: 1 },
  // Consumables & misc
  Potion: { w: 1, h: 1 },
  Elixir: { w: 1, h: 1 },
};

const TYPE_FALLBACK: Record<string, ItemFootprint> = {
  Weapon: { w: 1, h: 3 },
  Armor: { w: 2, h: 2 },
  Accessory: { w: 1, h: 1 },
  Consumable: { w: 1, h: 1 },
  Material: { w: 1, h: 1 },
  Quest: { w: 1, h: 1 },
};

/** Compute a footprint from the item's subtype, falling back to type. */
export function getItemFootprint(item: Pick<ItemData, 'type' | 'subtype'>): ItemFootprint {
  return (
    SUBTYPE_FOOTPRINTS[item.subtype] ??
    TYPE_FALLBACK[item.type] ?? { w: 1, h: 1 }
  );
}

/** Footprint w/h with rotation applied. */
export function orientedFootprint(fp: ItemFootprint, rotated: boolean): ItemFootprint {
  return rotated ? { w: fp.h, h: fp.w } : { w: fp.w, h: fp.h };
}

/* ── Grid & placement ─────────────────────────────────────────────────── */

export const DEFAULT_GRID_COLS = 10;
export const DEFAULT_GRID_ROWS = 6;

export function createStashTab(
  id: string,
  name: string,
  cols = DEFAULT_GRID_COLS,
  rows = DEFAULT_GRID_ROWS,
): StashTab {
  return { id, name, cols, rows, items: [] };
}

/** Returns true iff [x, x+w) × [y, y+h) sits inside the grid. */
export function isInBounds(tab: StashTab, x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x + w <= tab.cols && y + h <= tab.rows;
}

/**
 * Build a dense occupancy map. `null` = empty, otherwise the placement id.
 * `ignoreId` lets the drag-preview check "can I move myself here?".
 */
export function buildCellMap(tab: StashTab, ignoreId?: string): (string | null)[] {
  const cells = new Array<string | null>(tab.cols * tab.rows).fill(null);
  for (const p of tab.items) {
    if (p.id === ignoreId) continue;
    for (let dy = 0; dy < p.h; dy++) {
      for (let dx = 0; dx < p.w; dx++) {
        const cx = p.x + dx;
        const cy = p.y + dy;
        if (cx < 0 || cy < 0 || cx >= tab.cols || cy >= tab.rows) continue;
        cells[cy * tab.cols + cx] = p.id;
      }
    }
  }
  return cells;
}

/** Can a w×h footprint be placed with top-left at (x, y)? */
export function canPlace(
  tab: StashTab,
  x: number,
  y: number,
  w: number,
  h: number,
  ignoreId?: string,
): boolean {
  if (!isInBounds(tab, x, y, w, h)) return false;
  const cells = buildCellMap(tab, ignoreId);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (cells[(y + dy) * tab.cols + (x + dx)] != null) return false;
    }
  }
  return true;
}

/** Find the first free top-left (row-major) that can host a w×h footprint. */
export function findFirstFit(
  tab: StashTab,
  w: number,
  h: number,
): { x: number; y: number } | null {
  for (let y = 0; y + h <= tab.rows; y++) {
    for (let x = 0; x + w <= tab.cols; x++) {
      if (canPlace(tab, x, y, w, h)) return { x, y };
    }
  }
  return null;
}

/* ── Pure update helpers (immutable) ──────────────────────────────────── */

export function placePlacement(tab: StashTab, p: PlacedItem): StashTab {
  return { ...tab, items: [...tab.items, p] };
}

export function removePlacement(tab: StashTab, placementId: string): StashTab {
  const next = tab.items.filter((p) => p.id !== placementId);
  return next.length === tab.items.length ? tab : { ...tab, items: next };
}

export function movePlacement(
  tab: StashTab,
  placementId: string,
  x: number,
  y: number,
  rotated?: boolean,
): StashTab {
  const i = tab.items.findIndex((p) => p.id === placementId);
  if (i < 0) return tab;
  const cur = tab.items[i];
  const nextRotated = rotated ?? cur.rotated;
  // recompute w/h in case rotation changed
  const baseW = cur.rotated ? cur.h : cur.w;
  const baseH = cur.rotated ? cur.w : cur.h;
  const fp = orientedFootprint({ w: baseW, h: baseH }, nextRotated);
  if (!canPlace(tab, x, y, fp.w, fp.h, placementId)) return tab;
  const items = tab.items.slice();
  items[i] = { ...cur, x, y, w: fp.w, h: fp.h, rotated: nextRotated };
  return { ...tab, items };
}

/* ── Metrics ──────────────────────────────────────────────────────────── */

/**
 * Compute packing / fragmentation / breakdowns. `lookup` resolves the
 * catalog item by id so type+rarity can roll up. Items missing from the
 * lookup are still counted in `usedCells` / `itemCount` but skipped in
 * the byType/byRarity breakdowns (no fabricated data).
 */
export function computePackingMetrics(
  tab: StashTab,
  lookup: (itemId: string) => Pick<ItemData, 'type' | 'rarity'> | undefined,
): PackingMetrics {
  const totalCells = tab.cols * tab.rows;
  let usedCells = 0;
  const byType: Record<string, number> = {};
  const byTypeCells: Record<string, number> = {};
  const byRarity: Record<string, number> = {};
  for (const p of tab.items) {
    const cells = p.w * p.h;
    usedCells += cells;
    const meta = lookup(p.itemId);
    if (meta) {
      byType[meta.type] = (byType[meta.type] ?? 0) + 1;
      byTypeCells[meta.type] = (byTypeCells[meta.type] ?? 0) + cells;
      byRarity[meta.rarity] = (byRarity[meta.rarity] ?? 0) + cells;
    }
  }
  const freeCells = Math.max(0, totalCells - usedCells);
  // Fragmentation: free cells that have no 1×1 hole are by definition zero,
  // but free cells that are inside isolated runs smaller than 1×1 footprint
  // contribute to "wasted". With the smallest footprint = 1×1, every free
  // cell IS placeable so the meaningful fragmentation signal is the share
  // of free cells that cannot host a 2×2 (the next-tightest common armor
  // footprint). That's a better designer signal than always-0.
  const map = buildCellMap(tab);
  const coveredBy2x2 = new Set<number>();
  for (let y = 0; y + 2 <= tab.rows; y++) {
    for (let x = 0; x + 2 <= tab.cols; x++) {
      const ok =
        map[y * tab.cols + x] == null &&
        map[y * tab.cols + (x + 1)] == null &&
        map[(y + 1) * tab.cols + x] == null &&
        map[(y + 1) * tab.cols + (x + 1)] == null;
      if (!ok) continue;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++)
          coveredBy2x2.add((y + dy) * tab.cols + (x + dx));
    }
  }
  let wastedFree = 0;
  for (let i = 0; i < totalCells; i++) {
    if (map[i] == null && !coveredBy2x2.has(i)) wastedFree += 1;
  }
  // Avoid divide-by-zero — when the grid is full, fragmentation is 0.
  const fragmentation = freeCells === 0 ? 0 : wastedFree / freeCells;
  return {
    cols: tab.cols,
    rows: tab.rows,
    totalCells,
    usedCells,
    freeCells,
    itemCount: tab.items.length,
    packing: totalCells === 0 ? 0 : usedCells / totalCells,
    fragmentation,
    byType,
    byTypeCells,
    byRarity,
  };
}

/** Sum metrics across an array of tabs (totals + byType + byRarity). */
export function aggregateMetrics(
  tabs: StashTab[],
  lookup: (itemId: string) => Pick<ItemData, 'type' | 'rarity'> | undefined,
): PackingMetrics {
  let totalCells = 0;
  let usedCells = 0;
  let itemCount = 0;
  let wastedFree = 0;
  let freeCells = 0;
  const byType: Record<string, number> = {};
  const byTypeCells: Record<string, number> = {};
  const byRarity: Record<string, number> = {};
  let cols = 0;
  let rows = 0;
  for (const tab of tabs) {
    const m = computePackingMetrics(tab, lookup);
    totalCells += m.totalCells;
    usedCells += m.usedCells;
    freeCells += m.freeCells;
    itemCount += m.itemCount;
    wastedFree += Math.round(m.fragmentation * m.freeCells);
    cols = Math.max(cols, m.cols);
    rows = Math.max(rows, m.rows);
    for (const [k, v] of Object.entries(m.byType)) byType[k] = (byType[k] ?? 0) + v;
    for (const [k, v] of Object.entries(m.byTypeCells)) byTypeCells[k] = (byTypeCells[k] ?? 0) + v;
    for (const [k, v] of Object.entries(m.byRarity)) byRarity[k] = (byRarity[k] ?? 0) + v;
  }
  return {
    cols,
    rows,
    totalCells,
    usedCells,
    freeCells,
    itemCount,
    packing: totalCells === 0 ? 0 : usedCells / totalCells,
    fragmentation: freeCells === 0 ? 0 : wastedFree / freeCells,
    byType,
    byTypeCells,
    byRarity,
  };
}

/* ── Seeding ──────────────────────────────────────────────────────────── */

/** First-fit pack a list of items into a fresh tab; skip what doesn't fit. */
export function packFirstFit(
  tab: StashTab,
  items: ItemData[],
  uid: () => string,
): StashTab {
  let next = tab;
  for (const item of items) {
    const fp = getItemFootprint(item);
    const spot = findFirstFit(next, fp.w, fp.h);
    if (!spot) continue;
    next = placePlacement(next, {
      id: uid(),
      itemId: item.id,
      x: spot.x,
      y: spot.y,
      w: fp.w,
      h: fp.h,
      rotated: false,
    });
  }
  return next;
}
