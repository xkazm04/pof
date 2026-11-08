import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PowerTab } from '@/components/modules/core-engine/sub_inventory/economy-simulator/PowerRarityTabs';
import { runItemEconomySim, DEFAULT_ITEM_ECON_CONFIG, type ItemEconomyResult } from '@/lib/economy/item-economy-engine';

afterEach(cleanup);

/** An 8-level run whose top two levels no agent reached (the engine writes them as power 0). */
function unreachedTop(): ItemEconomyResult {
  const base = runItemEconomySim({ ...DEFAULT_ITEM_ECON_CONFIG, playerCount: 20, maxHours: 20, maxLevel: 8 });
  const reached = (i: number) => i < 6;
  return {
    ...base,
    brackets: base.brackets.map((b, i) => (reached(i) ? { ...b, agents: Math.max(b.agents, 1) } : { ...b, agents: 0, avgItemPower: 0 })),
    powerCurve: base.powerCurve.map((p, i) => (reached(i) ? { ...p, avgPower: Math.max(p.avgPower, 5) } : { ...p, avgPower: 0, p10: 0, p90: 0 })),
  };
}

describe('Item Power vs. Level chart', () => {
  it('plots only the levels the run sampled, never an unreached level as power 0', () => {
    const result = unreachedTop();
    const { container } = render(<PowerTab result={result} config={result.config} />);
    const avgLine = container.querySelector('path[stroke-width="2"]')!;
    const points = (avgLine.getAttribute('d') ?? '').match(/[ML] /g) ?? [];
    expect(points).toHaveLength(6);
  });
});
