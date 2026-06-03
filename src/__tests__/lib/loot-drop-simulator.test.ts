import { describe, it, expect } from 'vitest';
import { runDropSimulation, type AffixPoolEntry } from '@/lib/loot-designer/drop-simulator';

function affix(id: string, baseWeight: number): AffixPoolEntry {
  return {
    id,
    name: `Affix ${id}`,
    isPrefix: true,
    axis: 'offensive',
    tags: ['damage'],
    minValue: 1,
    maxValue: 10,
    baseWeight,
    minRarity: 'Common',
  };
}

const pool: AffixPoolEntry[] = [affix('a', 10), affix('b', 5), affix('c', 2), affix('d', 1)];

describe('runDropSimulation', () => {
  it('does not crash on a large rollCount (no Math.min(...spread) RangeError)', () => {
    // 100k rolls produces magnitude/power arrays large enough that Math.min(...arr)
    // would overflow the call stack; the single-pass minMax must handle it.
    const result = runDropSimulation({ affixPool: pool, rarity: 'Rare', itemLevel: 20, rollCount: 100_000, seed: 42 });
    expect(result.items).toHaveLength(100_000);
    expect(result.affixDistributions).toHaveLength(pool.length);
    for (const d of result.affixDistributions) {
      if (d.frequency > 0) {
        expect(Number.isFinite(d.minMagnitude)).toBe(true);
        expect(d.maxMagnitude).toBeGreaterThanOrEqual(d.minMagnitude);
        expect(d.frequency).toBeLessThanOrEqual(1); // without-replacement → never exceeds 100%
      }
    }
    expect(Number.isFinite(result.avgPower)).toBe(true);
  });
});
