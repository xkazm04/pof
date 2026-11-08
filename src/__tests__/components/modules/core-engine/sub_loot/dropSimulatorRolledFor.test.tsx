// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { act } from 'react';
import type { ReactNode } from 'react';
import { DropSimulator } from '@/components/modules/core-engine/sub_loot/simulation/DropSimulator';

// The enemy picker is a modal list; render its items inline as buttons so a test can pick one.
vi.mock('@/components/shared/ScalableSelector', () => ({
  ScalableSelector: ({ items, onSelect }: {
    items: { id: string }[];
    renderItem: (item: never, selected: boolean) => ReactNode;
    onSelect: (items: { id: string }[]) => void;
  }) => (
    <div>
      {items.map((it) => <button key={it.id} data-pick={it.id} onClick={() => onSelect([it])}>pick {it.id}</button>)}
    </div>
  ),
}));

afterEach(cleanup);

const click = (el: Element | null | undefined) => act(() => { fireEvent.click(el!); });

describe('Drop Simulator result caption', () => {
  it('keeps naming the rolled enemy after the picker moves to another one', () => {
    const { container } = render(<DropSimulator />);
    const pick = (id: string) => click(container.querySelector(`[data-pick="${id}"]`));
    pick('MeleeGrunt');
    click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Roll 1000'));
    expect(container.textContent).toContain('Rolled for Melee Grunt');
    pick('SithAssassin');
    expect(container.textContent).toContain('Rolled for Melee Grunt');
    expect(container.textContent).not.toContain('Rolled for Sith Assassin');
  });

  it('captions a global roll as all enemies', () => {
    const { container } = render(<DropSimulator />);
    click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Roll 10'));
    expect(container.textContent).toContain('Rolled for all enemies');
  });
});
