import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import { CombatPanel } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/CombatPanel';
import { DEFAULT_COMBAT } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/constants';
import { pickElement } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/simulation';

/**
 * pickElement normalises the four damage weights by their sum, so the "Element Mix"
 * percentages must be each weight's share of that sum - the rate the sandbox spawns
 * at - not the raw slider value.
 */

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function shownPercents(): number[] {
  const { container } = render(createElement(CombatPanel, {
    showCombat: true, setShowCombat: () => {}, combat: DEFAULT_COMBAT, updateCombat: () => {},
  }));
  return Array.from(container.querySelectorAll('input[type="range"]'))
    .slice(-4)
    .map((input) => Number((input.nextElementSibling as HTMLElement).textContent!.replace('%', '')));
}

describe('Element Mix percentages', () => {
  it('show the share each element is actually spawned at', () => {
    const shown = shownPercents();
    // measured spawn rate over a seeded sweep of pickElement's random draw
    const counts = { physical: 0, fire: 0, ice: 0, lightning: 0 } as Record<string, number>;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      // first draw is the heal roll (healPercent 0 -> never), second picks the element
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce((i + 0.5) / N);
      counts[pickElement(DEFAULT_COMBAT.elementWeights, 0).element]++;
    }
    const measured = ['physical', 'fire', 'ice', 'lightning'].map((k) => Math.round((counts[k] / N) * 100));
    expect(shown).toEqual(measured);
  });
});
