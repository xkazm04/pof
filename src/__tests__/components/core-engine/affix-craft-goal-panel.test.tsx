/**
 * CraftGoalPanel renders a craft-goal price: an unreachable goal shows its
 * reason and no percentage; a priced goal shows the success % and Forging
 * Potential mean/p90 as the headline cost.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CraftGoalPanel } from '@/components/modules/core-engine/sub_loot/affix-workbench/CraftGoalPanel';
import type { CraftGoalReport } from '@/components/modules/core-engine/sub_loot/affix-workbench/craftGoal';

afterEach(() => cleanup());

const dist = (mean: number, p50: number, p90: number) => ({ mean, p50, p90 });

const UNREACHABLE: CraftGoalReport = {
  status: 'unreachable', rarity: 'Rare', targetTags: ['Affix.AllDmg'],
  reason: 'Celestial (Affix.AllDmg) rolls only on a Legendary or better base; a Rare base never offers it',
};

const PRICED: CraftGoalReport = {
  status: 'priced', rarity: 'Rare', targetTags: ['Affix.FireDmg', 'Affix.Strength'], runs: 400,
  successRate: 0.735,
  spend: {
    chaos: dist(0, 0, 0), exalted: dist(6.2, 5, 11), annulment: dist(3.1, 2, 7),
    divine: dist(0, 0, 0), eternal: dist(0.4, 0, 1), forging: dist(48.6, 45, 87),
  },
  crafts: { p50: 7, p90: 13 },
  failures: { walletExhausted: 106, stepCap: 0, stuck: 0 },
};

describe('CraftGoalPanel', () => {
  it('an unreachable goal shows the reason and no percentage', () => {
    const { container } = render(<CraftGoalPanel report={UNREACHABLE} />);
    expect(screen.getByText(UNREACHABLE.status === 'unreachable' ? UNREACHABLE.reason : '')).toBeTruthy();
    expect(container.textContent).not.toMatch(/%/);
  });

  it('a priced goal shows the success % and Forging Potential mean/p90 as the headline', () => {
    render(<CraftGoalPanel report={PRICED} />);
    expect(screen.getByTestId('craft-goal-success').textContent).toContain('73.5%');
    const headline = screen.getByTestId('craft-goal-forging').textContent ?? '';
    expect(headline).toMatch(/Forging Potential/);
    expect(headline).toContain('48.6');
    expect(headline).toContain('87');
  });
});
