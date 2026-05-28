import { describe, it, expect } from 'vitest';
import {
  createStashTab,
  getItemFootprint,
  orientedFootprint,
  canPlace,
  findFirstFit,
  placePlacement,
  movePlacement,
  removePlacement,
  computePackingMetrics,
  aggregateMetrics,
  packFirstFit,
  isInBounds,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  type PlacedItem,
} from '@/lib/spatial-inventory';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';

function makeItem(over: Partial<ItemData> = {}): ItemData {
  return {
    id: 'i1',
    name: 'Test',
    type: 'Weapon',
    subtype: 'Sword',
    rarity: 'Common',
    stats: [],
    description: '',
    ...over,
  };
}

function makePlacement(over: Partial<PlacedItem>): PlacedItem {
  return { id: 'p1', itemId: 'i1', x: 0, y: 0, w: 1, h: 3, rotated: false, ...over };
}

describe('getItemFootprint', () => {
  it('uses subtype table when known', () => {
    expect(getItemFootprint(makeItem({ subtype: 'Sword' }))).toEqual({ w: 1, h: 3 });
    expect(getItemFootprint(makeItem({ subtype: 'Helm' }))).toEqual({ w: 2, h: 2 });
    expect(getItemFootprint(makeItem({ subtype: 'Ring' }))).toEqual({ w: 1, h: 1 });
  });

  it('falls back to type when subtype is unknown', () => {
    expect(getItemFootprint(makeItem({ type: 'Armor', subtype: 'Mystery' }))).toEqual({ w: 2, h: 2 });
  });

  it('falls back to 1x1 when both unknown', () => {
    // @ts-expect-error — exercising the fallthrough on a manufactured type
    expect(getItemFootprint({ type: 'Unknown', subtype: 'X' })).toEqual({ w: 1, h: 1 });
  });
});

describe('orientedFootprint', () => {
  it('swaps w/h when rotated', () => {
    expect(orientedFootprint({ w: 1, h: 3 }, false)).toEqual({ w: 1, h: 3 });
    expect(orientedFootprint({ w: 1, h: 3 }, true)).toEqual({ w: 3, h: 1 });
  });
});

describe('isInBounds', () => {
  const tab = createStashTab('t', 'Main', 4, 3);
  it('accepts inside placements', () => {
    expect(isInBounds(tab, 0, 0, 4, 3)).toBe(true);
    expect(isInBounds(tab, 2, 1, 2, 2)).toBe(true);
  });
  it('rejects out-of-bounds placements', () => {
    expect(isInBounds(tab, -1, 0, 1, 1)).toBe(false);
    expect(isInBounds(tab, 3, 0, 2, 1)).toBe(false);
    expect(isInBounds(tab, 0, 2, 1, 2)).toBe(false);
  });
});

describe('canPlace / findFirstFit / placePlacement', () => {
  it('places without overlap and finds row-major first fit', () => {
    const tab = createStashTab('t', 'Main', 4, 3);
    expect(canPlace(tab, 0, 0, 2, 2)).toBe(true);
    const t1 = placePlacement(tab, makePlacement({ x: 0, y: 0, w: 2, h: 2 }));
    // overlap rejected
    expect(canPlace(t1, 1, 1, 1, 1)).toBe(false);
    // adjacent is fine
    expect(canPlace(t1, 2, 0, 2, 2)).toBe(true);
    const spot = findFirstFit(t1, 1, 1);
    expect(spot).toEqual({ x: 2, y: 0 });
  });

  it('ignoreId lets a placement consider its own cells empty', () => {
    const tab = placePlacement(createStashTab('t', 'Main', 4, 3), makePlacement({ x: 0, y: 0, w: 2, h: 2 }));
    expect(canPlace(tab, 0, 0, 2, 2)).toBe(false);
    expect(canPlace(tab, 0, 0, 2, 2, 'p1')).toBe(true);
  });

  it('returns null when nothing fits', () => {
    const tab = createStashTab('t', 'Tiny', 1, 1);
    expect(findFirstFit(tab, 2, 2)).toBe(null);
  });
});

describe('movePlacement', () => {
  it('moves to a valid spot and rejects overlapping moves', () => {
    let tab = createStashTab('t', 'Main', 4, 3);
    tab = placePlacement(tab, makePlacement({ id: 'a', x: 0, y: 0, w: 2, h: 2 }));
    tab = placePlacement(tab, makePlacement({ id: 'b', x: 2, y: 0, w: 2, h: 2 }));
    const moved = movePlacement(tab, 'a', 0, 1);
    // moving down by 1 would overlap with b only on x: 0–1, no overlap → succeeds
    expect(moved.items.find((p) => p.id === 'a')!.y).toBe(1);
    // try to move b onto a — should noop (same ref)
    const noop = movePlacement(tab, 'b', 0, 0);
    expect(noop).toBe(tab);
  });

  it('respects rotation when checking the new footprint', () => {
    let tab = createStashTab('t', 'Main', 3, 3);
    tab = placePlacement(tab, makePlacement({ id: 'a', x: 0, y: 0, w: 1, h: 3 }));
    // rotate in place to 3×1 — fits because the column is empty
    const rotated = movePlacement(tab, 'a', 0, 0, true);
    const a = rotated.items.find((p) => p.id === 'a')!;
    expect(a.rotated).toBe(true);
    expect(a.w).toBe(3);
    expect(a.h).toBe(1);
  });
});

describe('removePlacement', () => {
  it('removes the matching id and is a noop for unknown ids', () => {
    let tab = createStashTab('t', 'Main', 4, 3);
    tab = placePlacement(tab, makePlacement({ id: 'a' }));
    const after = removePlacement(tab, 'a');
    expect(after.items).toHaveLength(0);
    expect(removePlacement(tab, 'missing')).toBe(tab);
  });
});

describe('computePackingMetrics', () => {
  it('reports zeroes on an empty tab', () => {
    const tab = createStashTab('t', 'Main', 4, 3);
    const m = computePackingMetrics(tab, () => undefined);
    expect(m.totalCells).toBe(12);
    expect(m.usedCells).toBe(0);
    expect(m.packing).toBe(0);
    // empty grid has no holes → 0 fragmentation
    expect(m.fragmentation).toBe(0);
  });

  it('reports cell usage and byType/byTypeCells/byRarity buckets', () => {
    let tab = createStashTab('t', 'Main', 4, 3);
    tab = placePlacement(tab, makePlacement({ id: 'a', x: 0, y: 0, w: 1, h: 3 }));
    tab = placePlacement(tab, makePlacement({ id: 'b', itemId: 'i2', x: 1, y: 0, w: 2, h: 2 }));
    const lookup = (id: string): Pick<ItemData, 'type' | 'rarity'> =>
      id === 'i1'
        ? { type: 'Weapon', rarity: 'Common' }
        : { type: 'Armor', rarity: 'Rare' };
    const m = computePackingMetrics(tab, lookup);
    expect(m.usedCells).toBe(3 + 4);
    expect(m.itemCount).toBe(2);
    expect(m.byType).toEqual({ Weapon: 1, Armor: 1 });
    expect(m.byTypeCells).toEqual({ Weapon: 3, Armor: 4 });
    expect(m.byRarity).toEqual({ Common: 3, Rare: 4 });
    expect(m.packing).toBeCloseTo(7 / 12, 6);
  });

  it('flags fragmentation when free holes are too small for a 2x2', () => {
    let tab = createStashTab('t', 'Main', 3, 3);
    // Fill the left column with a 1×3 — leaves a 2×3 region (still fits a 2×2).
    tab = placePlacement(tab, makePlacement({ id: 'a', x: 0, y: 0, w: 1, h: 3 }));
    let m = computePackingMetrics(tab, () => undefined);
    expect(m.fragmentation).toBe(0);
    // Now drop a single 1×1 into the middle to split the 2×3 region into
    // two pieces that no longer fit a 2×2 — everything else becomes "wasted".
    tab = placePlacement(tab, makePlacement({ id: 'b', x: 2, y: 1, w: 1, h: 1 }));
    m = computePackingMetrics(tab, () => undefined);
    expect(m.fragmentation).toBeGreaterThan(0);
  });
});

describe('aggregateMetrics', () => {
  it('sums totals across tabs and merges buckets', () => {
    let a = createStashTab('a', 'A', 2, 2);
    a = placePlacement(a, makePlacement({ id: 'p1', x: 0, y: 0, w: 1, h: 1 }));
    let b = createStashTab('b', 'B', 2, 2);
    b = placePlacement(b, makePlacement({ id: 'p2', itemId: 'i2', x: 0, y: 0, w: 2, h: 2 }));
    const lookup = (id: string): Pick<ItemData, 'type' | 'rarity'> =>
      id === 'i1'
        ? { type: 'Weapon', rarity: 'Common' }
        : { type: 'Armor', rarity: 'Rare' };
    const m = aggregateMetrics([a, b], lookup);
    expect(m.totalCells).toBe(8);
    expect(m.usedCells).toBe(5);
    expect(m.byType).toEqual({ Weapon: 1, Armor: 1 });
    expect(m.byTypeCells).toEqual({ Weapon: 1, Armor: 4 });
  });
});

describe('packFirstFit', () => {
  it('packs items in order and skips overflow', () => {
    const tab = createStashTab('t', 'Main', DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS);
    const items: ItemData[] = [
      makeItem({ id: 'a', subtype: 'Sword' }), // 1×3
      makeItem({ id: 'b', subtype: 'Chestplate', type: 'Armor' }), // 2×3
      makeItem({ id: 'c', subtype: 'Ring', type: 'Accessory' }), // 1×1
    ];
    let i = 0;
    const packed = packFirstFit(tab, items, () => `p${i++}`);
    expect(packed.items).toHaveLength(3);
    // first item lands at origin
    expect(packed.items[0].x).toBe(0);
    expect(packed.items[0].y).toBe(0);
  });
});
