import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { act } from 'react';
import type { ReactNode } from 'react';

// The enemy picker is a modal list; render its items inline as buttons so a test can pick one.
vi.mock('@/components/shared/ScalableSelector', () => ({
  ScalableSelector: ({ items, renderItem, onSelect }: {
    items: { id: string }[];
    renderItem: (item: never, selected: boolean) => ReactNode;
    onSelect: (items: { id: string }[]) => void;
  }) => (
    <div data-testid="picker">
      {items.map((it) => (
        <button key={it.id} data-pick={it.id} onClick={() => onSelect([it])}>
          {renderItem(it as never, false)}
        </button>
      ))}
    </div>
  ),
}));

import { EXPANDED_ENTRIES } from '@/components/modules/core-engine/sub_loot/_shared/data';
import { ECONOMY_KILLS_PER_HOUR } from '@/components/modules/core-engine/sub_loot/simulation/lootSimEngine';
import { EconomyImpact } from '@/components/modules/core-engine/sub_loot/economy/EconomyImpact';
import { PityCohortChart } from '@/components/modules/core-engine/sub_loot/pity/PityCohortChart';
import { PityTimerSection } from '@/components/modules/core-engine/sub_loot/pity/PityTimerSection';
import { DroughtCalculator } from '@/components/modules/core-engine/sub_loot/pity/DroughtCalculator';
import { DropSimulator } from '@/components/modules/core-engine/sub_loot/simulation/DropSimulator';
import { useLootTuningStore, resetLootTuning } from '@/components/modules/core-engine/sub_loot/_shared/lootTuningStore';

afterEach(cleanup);

const tierChips = (container: HTMLElement) =>
  [...container.querySelectorAll('[aria-live="polite"] > div')].map((d) => d.textContent ?? '');

describe('DropSimulator', () => {
  beforeEach(() => resetLootTuning());

  it('keeps showing the deviation of the roll it ran when the enemy is cleared afterwards', () => {
    const { container, getByText } = render(<DropSimulator />);
    fireEvent.click(container.querySelector('[data-pick="MeleeGrunt"]')!);
    fireEvent.click(getByText('Roll 1000'));
    const before = tierChips(container).join('|');
    const footer = container.querySelector('[aria-live="polite"]')!.nextElementSibling!.textContent;
    // Clear the selection: the counts on screen were rolled with Melee Grunt (30% drop),
    // so they must not be re-judged against the global table (100% drop).
    fireEvent.click(getByText('×'));
    expect(tierChips(container).join('|')).toBe(before);
    expect(container.querySelector('[aria-live="polite"]')!.nextElementSibling!.textContent).toBe(footer);
  });

  it('keeps the rolled binding when the tuned drop chance changes after the roll', () => {
    const { container, getByText } = render(<DropSimulator />);
    fireEvent.click(container.querySelector('[data-pick="MeleeGrunt"]')!);
    fireEvent.click(getByText('Roll 1000'));
    const before = tierChips(container).join('|');
    act(() => useLootTuningStore.getState().dispatch({ type: 'setField', id: 'MeleeGrunt', field: 'dropChance', value: 0.9 }));
    expect(tierChips(container).join('|')).toBe(before);
  });

  it('lists the TUNED roster in the enemy picker, the values the roll will use', () => {
    act(() => useLootTuningStore.getState().dispatch({ type: 'setField', id: 'MeleeGrunt', field: 'dropChance', value: 0.9 }));
    const { container } = render(<DropSimulator />);
    expect(container.querySelector('[data-pick="MeleeGrunt"]')!.textContent).toContain('Drop: 90%');
  });
});

describe('DroughtCalculator headline stats honour the pity toggle', () => {
  const stat = (container: HTMLElement, label: string) =>
    [...container.querySelectorAll('div')].find((d) => d.textContent === label)!.nextElementSibling!.textContent;

  it('Legendary (2%) with pity @ 20: median and expected dry are capped by the pity, not the raw geometric', () => {
    const { container, getByText } = render(<DroughtCalculator pityThreshold={20} />);
    // P(drop within 19 kills) = 1 - 0.98^19 = 0.32 < 0.5, so half the players are only saved by the pity at 20.
    expect(stat(container, 'Median (P50)')).toBe('20 kills');
    // E[kills] with a hard pity at T = (1 - (1-r)^T) / r = 16.6.
    expect(stat(container, 'Expected Dry')).toBe('17 kills');
    fireEvent.click(getByText('Pity @ 20'));
    expect(stat(container, 'Median (P50)')).toBe('35 kills');
    expect(stat(container, 'Expected Dry')).toBe('50 kills');
  });
});

describe('PityTimerSection', () => {
  it('announces the guarantee on the drop that will be forced, which is reachable', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // every unforced roll is Common
    try {
      const { getByText, container } = render(<PityTimerSection pityThreshold={10} setPityThreshold={() => {}} />);
      for (let i = 0; i < 9; i++) fireEvent.click(getByText('Drop!'));
      // 9 dry drops: drop 10 is forced (pityCount + 1 >= threshold), so the next one IS guaranteed.
      expect(container.textContent).toContain('GUARANTEED RARE NEXT!');
      fireEvent.click(getByText('Drop!'));
      expect(container.textContent).toContain('0 since last Rare+');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('PityCohortChart', () => {
  it('while a re-simulation is pending, overlay and pity text describe the cohort on screen', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<PityCohortChart rate={0.02} threshold={20} color="red" />);
      act(() => { vi.advanceTimersByTime(200); });
      const analytic = () => container.querySelector('polyline')!.getAttribute('points');
      const before = analytic();
      expect(container.textContent).toContain('Pity @ 20');
      // New inputs, debounce not elapsed: the histogram is still the 2% / pity-20 cohort.
      rerender(<PityCohortChart rate={0.05} threshold={30} color="red" />);
      expect(analytic()).toBe(before);
      expect(container.textContent).toContain('Pity @ 20');
      expect(container.textContent).not.toContain('Pity @ 30');
      act(() => { vi.advanceTimersByTime(200); });
      expect(container.textContent).toContain('Pity @ 30');
      expect(analytic()).not.toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('EconomyImpact table controls are named', () => {
  it('the pagination chevrons carry an accessible name', () => {
    const { container } = render(<EconomyImpact />);
    const chevrons = [...container.querySelectorAll('button')].filter((b) => b.querySelector('svg') && !b.textContent?.trim());
    expect(chevrons.length).toBe(2);
    expect(chevrons.map((b) => b.getAttribute('aria-label'))).toEqual(['Previous page', 'Next page']);
  });
});

describe('EconomyFilters expose the active toggle', () => {
  it('tier and source buttons carry aria-pressed for the selected filter', () => {
    const { getByText } = render(<EconomyImpact />);
    expect(getByText('All Sources').getAttribute('aria-pressed')).toBe('true');
    expect(getByText('chest').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(getByText('Epic', { selector: 'button' }));
    expect(getByText('Epic', { selector: 'button' }).getAttribute('aria-pressed')).toBe('true');
    expect(getByText('All', { selector: 'button' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('EconomyImpact Drop% is a share of the whole table', () => {
  it('filtering to one tier does not renormalise each item to a share of the filter', () => {
    const { container, getByText } = render(<EconomyImpact />);
    const all = EXPANDED_ENTRIES.reduce((s, e) => s + e.weight, 0);
    fireEvent.click(getByText('Legendary', { selector: 'button' }));
    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const cells = [...r.querySelectorAll('td')].map((c) => c.textContent);
      const item = EXPANDED_ENTRIES.find((e) => e.name === cells[0])!;
      expect(cells[4]).toBe(`${((item.weight / all) * 100).toFixed(1)}%`);
    }
  });
});

describe('Economy profile scale has one authority', () => {
  it('the hardcore impact table and surplus scale by the engine kills/hour ratio the summary grid uses', () => {
    const ratio = ECONOMY_KILLS_PER_HOUR.hardcore / ECONOMY_KILLS_PER_HOUR.casual;
    const { container, getByText } = render(<EconomyImpact />);
    const gold = () => [...container.querySelectorAll('tbody tr')].map((r) => Number(r.querySelectorAll('td')[5].textContent!.replace('g', '')));
    const casual = gold();
    fireEvent.click(getByText('Hardcore'));
    expect(gold()).toEqual(casual.map((g) => Math.round(g * ratio)));
    // Weapons surplus +5 per casual hour.
    expect(container.textContent).toContain(`+${Math.round(5 * ratio * 10) / 10}`);
  });
});
