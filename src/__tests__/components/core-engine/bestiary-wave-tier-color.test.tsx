/**
 * The Wave Choreographer painted tiers with its own switch (boss = amber, raid-boss = red)
 * while the archetype cards use TIER_GLOW_COLORS (boss = orange, raid-boss = amber): the
 * same amber meant "boss" on one tab and "raid-boss" on the next. One tier vocabulary,
 * and the tier filter's options come from ALL_TIERS rather than a fifth hand-kept list.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { EncountersTab } from '@/components/modules/core-engine/sub_bestiary/encounters/EncountersTab';
import { TIER_GLOW_COLORS, ALL_TIERS, EXPANDED_WAVES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { STATUS_ERROR } from '@/lib/chart-colors';

afterEach(cleanup);

/** jsdom normalises inline hex colours to rgb(). */
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

describe('Wave Choreographer tier colours', () => {
  it('paints each tier with TIER_GLOW_COLORS', () => {
    const { container } = render(<EncountersTab accent={STATUS_ERROR} />);
    const select = Array.from(container.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.value === 'raid-boss'))!;
    expect(select).toBeTruthy();
    const tiers = [...new Set(EXPANDED_WAVES.map(w => w.tier))];
    for (const tier of tiers) {
      fireEvent.change(select, { target: { value: tier } });
      const badges = Array.from(container.querySelectorAll('span')).filter(s => s.textContent === tier);
      expect(badges.length, tier).toBeGreaterThan(0);
      for (const b of badges) expect(b.style.color, tier).toBe(rgbOf(TIER_GLOW_COLORS[tier]));
    }
  });

  it('offers exactly the ALL_TIERS options after "all"', () => {
    const { container } = render(<EncountersTab accent={STATUS_ERROR} />);
    const select = Array.from(container.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.value === 'raid-boss'))!;
    expect(Array.from(select.options).map(o => o.value)).toEqual(['all', ...ALL_TIERS]);
  });
});
