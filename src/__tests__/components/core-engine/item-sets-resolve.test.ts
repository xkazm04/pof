import { describe, it, expect } from 'vitest';
import { ITEM_SETS, DUMMY_ITEMS } from '@/components/modules/core-engine/sub_inventory/_shared/data';

describe('ITEM_SETS pieces', () => {
  it('every set piece names an item that exists in the catalog', () => {
    const names = new Set(DUMMY_ITEMS.map((i) => i.name));
    const pieces = ITEM_SETS.flatMap((s) => s.pieces.map((p) => p.name));
    const missing = pieces.filter((n) => !names.has(n));
    expect(missing).toEqual([]);
    expect(pieces.length).toBeGreaterThan(0);
  });
});
