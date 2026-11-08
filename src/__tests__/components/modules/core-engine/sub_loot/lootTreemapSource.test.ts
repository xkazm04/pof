import { describe, it, expect } from 'vitest';
import { RARITY_TIERS, TOTAL_WEIGHT, TREEMAP_DATA } from '@/components/modules/core-engine/sub_loot/_shared/data';

describe('TREEMAP_DATA follows RARITY_TIERS', () => {
  it('has one rect per tier, probability === weight / TOTAL_WEIGHT * 100', () => {
    expect(TREEMAP_DATA.map((d) => d.name)).toEqual(RARITY_TIERS.map((t) => t.name));
    for (const t of RARITY_TIERS) {
      const rect = TREEMAP_DATA.find((d) => d.name === t.name)!;
      expect(rect.probability).toBeCloseTo((t.weight / TOTAL_WEIGHT) * 100, 9);
      expect(rect.affixes.length).toBeGreaterThan(0);
    }
  });
});
