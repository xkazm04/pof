import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { act } from 'react';
import { EconomySummaryGrid } from '@/components/modules/core-engine/sub_loot/economy/EconomySummaryGrid';
import { DropsPerHour } from '@/components/modules/core-engine/sub_loot/simulation/DropsPerHour';
import { useLootTuningStore, resetLootTuning } from '@/components/modules/core-engine/sub_loot/_shared/lootTuningStore';

const goldText = (container: HTMLElement) =>
  [...container.querySelectorAll('span')].find((s) => s.textContent === 'Gold/Hour')!.nextElementSibling!.textContent;

describe('economy components consume the tuned roster', () => {
  beforeEach(() => resetLootTuning());

  it('EconomySummaryGrid Gold/Hour is derived, not the literal, and follows gold.Legendary', () => {
    const { container, rerender } = render(<EconomySummaryGrid economyProfile="casual" />);
    const before = goldText(container);
    expect(before).not.toBe('2,300');
    act(() => useLootTuningStore.getState().dispatch({ type: 'setGold', rarity: 'Legendary', value: 9000 }));
    rerender(<EconomySummaryGrid economyProfile="casual" />);
    const after = goldText(container);
    expect(after).not.toBe(before);
  });

  it('DropsPerHour gold gauge follows gold.Legendary', () => {
    const { container } = render(<DropsPerHour />);
    const before = container.textContent;
    act(() => useLootTuningStore.getState().dispatch({ type: 'setGold', rarity: 'Legendary', value: 9000 }));
    expect(container.textContent).not.toBe(before);
  });
});
