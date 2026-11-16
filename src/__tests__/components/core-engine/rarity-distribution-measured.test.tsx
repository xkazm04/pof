import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { RarityDistributionSection } from '@/components/modules/core-engine/sub_inventory/economy/RarityDistributionSection';
import { useItemEconomySessionStore } from '@/stores/itemEconomySessionStore';
import { runItemEconomySim, DEFAULT_ITEM_ECON_CONFIG } from '@/lib/economy/item-economy-engine';

afterEach(cleanup);
beforeEach(() => useItemEconomySessionStore.getState().reset());

describe('RarityDistributionSection reads measured shares only', () => {
  it('shows UNMEASURED and no invented actual shares without a sim run', () => {
    const { container } = render(<RarityDistributionSection />);
    const text = container.textContent ?? '';
    expect(container.querySelector('[data-testid="rarity-unmeasured"]')).not.toBeNull();
    expect(text).toContain('UNMEASURED');
    expect(text).not.toContain('Actual 55%');
    expect(text).not.toMatch(/Actual \d+%/);
    expect(text).not.toContain('72');
  });

  it('shows the run\'s own shares when the session holds a measured result', () => {
    const sim = runItemEconomySim({ ...DEFAULT_ITEM_ECON_CONFIG, maxLevel: 20, playerCount: 200, maxHours: 2000 });
    useItemEconomySessionStore.setState({ result: sim });
    const { container } = render(<RarityDistributionSection />);
    const text = container.textContent ?? '';
    expect(container.querySelector('[data-testid="rarity-unmeasured"]')).toBeNull();
    const bracket = sim.brackets.find((b) => b.level === 14)!;
    expect(text).toContain(`Actual ${(bracket.rarityDistribution.common * 100).toFixed(0)}%`);
  });
});
