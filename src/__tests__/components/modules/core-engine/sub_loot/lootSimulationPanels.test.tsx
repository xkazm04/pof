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
});
