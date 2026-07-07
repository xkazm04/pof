import { describe, it, expect } from 'vitest';
import { getItemLevelScaling } from '@/lib/loot-designer/drop-simulator';

describe('getItemLevelScaling', () => {
  it('item level 0 scales by exactly 1.0 (no floor at level 1)', () => {
    // The sibling UE5 reproductions (item-economy-engine, item-dna/rolling-engine)
    // use `1 + 0.1 * ItemLevel` with no Math.max — ilvl 0 must be ×1.0, not ×1.1.
    expect(getItemLevelScaling(0)).toBe(1.0);
  });

  it('levels 0 and 1 are distinct (1.0 vs 1.1)', () => {
    expect(getItemLevelScaling(0)).not.toBe(getItemLevelScaling(1));
    expect(getItemLevelScaling(1)).toBeCloseTo(1.1, 10);
  });

  it('agrees with the 1 + 0.1*level formula for higher levels', () => {
    for (const lvl of [2, 5, 10, 60]) {
      expect(getItemLevelScaling(lvl)).toBeCloseTo(1 + 0.1 * lvl, 10);
    }
  });

  it('never scales below 1.0 for negative levels', () => {
    expect(getItemLevelScaling(-3)).toBe(1.0);
  });
});
