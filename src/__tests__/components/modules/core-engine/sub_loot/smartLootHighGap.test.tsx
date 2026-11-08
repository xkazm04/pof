// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SmartLoot } from '@/components/modules/core-engine/sub_loot/economy/SmartLoot';
import { SMART_LOOT_DATA } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';
import { smartLootLift } from '@/components/modules/core-engine/sub_loot/simulation/lootSimEngine';

afterEach(() => {
  cleanup();
  const i = SMART_LOOT_DATA.findIndex((s) => s.slot === 'TestGap10');
  if (i >= 0) SMART_LOOT_DATA.splice(i, 1);
});

const badges = (c: HTMLElement) => [...c.querySelectorAll('span')].filter((s) => /^Gap:\d+$/.test(s.textContent ?? '')).length;

describe('SmartLoot high-gap rule', () => {
  it('badges exactly the slots smartLootLift counts, including a slot at gap 10', () => {
    SMART_LOOT_DATA.push({ slot: 'TestGap10', rawPct: 10, smartPct: 12, gearScoreGap: 10 });
    const { container } = render(<SmartLoot />);
    expect(smartLootLift().slots).toBe(4);
    expect(badges(container)).toBe(smartLootLift().slots);
  });

  it('agrees on the shipped data too', () => {
    const { container } = render(<SmartLoot />);
    expect(badges(container)).toBe(smartLootLift().slots);
  });
});
