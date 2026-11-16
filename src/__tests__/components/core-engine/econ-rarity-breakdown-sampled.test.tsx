import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { RarityTab } from '@/components/modules/core-engine/sub_inventory/economy-simulator/PowerRarityTabs';
import { economyVerdicts } from '@/lib/economy/item-economy-verdicts';
import { runItemEconomySim, DEFAULT_ITEM_ECON_CONFIG, type ItemEconomyResult } from '@/lib/economy/item-economy-engine';

afterEach(cleanup);

const ZERO = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };

/** A run whose last four brackets (the endgame window) are half sampled. */
function halfSampledEndgame(): ItemEconomyResult {
  const base = runItemEconomySim({ ...DEFAULT_ITEM_ECON_CONFIG, playerCount: 20, maxHours: 20, maxLevel: 8 });
  const brackets = base.brackets.map((b, i) => {
    if (i < 4) return b;
    return i < 6
      ? { ...b, agents: 3, rarityDistribution: { ...ZERO, rare: 1 } }
      : { ...b, agents: 0, rarityDistribution: { ...ZERO } };
  });
  return { ...base, brackets };
}

describe('Rarity Inflation Index endgame breakdown', () => {
  it('averages shares over the sampled brackets only, so an unreached level is not a measured 0%', () => {
    const result = halfSampledEndgame();
    const inflation = economyVerdicts(result).find((v) => v.family === 'rarity-inflation')!;
    const { getByText } = render(<RarityTab result={result} config={result.config} inflation={inflation} />);
    const panel = getByText('Endgame').parentElement!;
    // Two of four endgame brackets were sampled, both 100% rare: the share is 100%, not 50%.
    expect(within(panel).queryByText('50%')).toBeNull();
    expect(within(panel).getByText('100%')).toBeTruthy();
  });
});
