import { describe, it, expect } from 'vitest';
import { RARITY_TIERS, RARITY_ORDER, rarityTier } from '@/components/modules/core-engine/sub_inventory/_shared/data-items';
import { DUMMY_ITEMS } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { RARITY_LABELS } from '@/components/modules/core-engine/sub_inventory/economy-simulator/constants';

describe('rarity ladder is stated once', () => {
  it('an unknown rarity is reported, not silently Common-scaled', () => {
    expect(() => rarityTier('Mythic')).toThrow(/Unknown item rarity "Mythic"/);
    expect(rarityTier('Rare')).toMatchObject({ magnitude: 2.2, affixCount: 1 });
  });

  it('every ladder consumer agrees with RARITY_TIERS and every item rarity is a tier', () => {
    const names = RARITY_TIERS.map((t) => t.name);
    expect(Object.keys(RARITY_ORDER)).toEqual(names);
    expect(RARITY_LABELS).toEqual(names.map((n) => n.toLowerCase()));
    for (const item of DUMMY_ITEMS) expect(names, item.name).toContain(item.rarity);
    // Magnitude and affix count rise (never fall) with rank.
    for (let i = 1; i < RARITY_TIERS.length; i++) {
      expect(RARITY_TIERS[i].magnitude).toBeGreaterThanOrEqual(RARITY_TIERS[i - 1].magnitude);
      expect(RARITY_TIERS[i].affixCount).toBeGreaterThanOrEqual(RARITY_TIERS[i - 1].affixCount);
    }
  });
});
