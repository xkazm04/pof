import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CombatChoreographerFacet } from '@/components/ecw/facets/combat-map/CombatChoreographerFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

const entity: StoredCatalogEntity = {
  id: 'cb-sw-whirl', catalogId: 'combat-map', name: 'Whirlwind Slash',
  categoryPath: ['Combat Map', 'Sword'], tags: ['Sword'], lifecycle: 'planned',
  data: { id: 'cb-sw-whirl', name: 'Whirlwind Slash', weaponCategory: 'Sword', hits: 4, totalTime: '2.2s', dps: 310, chain: ['Sweep', 'Spin', 'Reverse', 'Finisher'] },
};

describe('CombatChoreographerFacet', () => {
  beforeEach(() => execute.mockClear());
  afterEach(cleanup);

  it('renders the instruction textarea', () => {
    render(<CombatChoreographerFacet entity={entity} />);
    expect(screen.getByPlaceholderText(/launcher finisher/i)).toBeTruthy();
  });

  it('dispatches a quick-action carrying the combo, weapon, and instruction', () => {
    render(<CombatChoreographerFacet entity={entity} />);
    fireEvent.change(screen.getByPlaceholderText(/launcher finisher/i), {
      target: { value: 'make the 2nd hit cancellable' },
    });
    fireEvent.click(screen.getByRole('button', { name: /choreograph with claude/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('Whirlwind Slash');
    expect(task.prompt).toContain('Sword');
    expect(task.prompt).toContain('make the 2nd hit cancellable');
  });
});
