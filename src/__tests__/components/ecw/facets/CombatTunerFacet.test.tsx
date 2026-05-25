import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CombatTunerFacet } from '@/components/ecw/facets/combat-map/CombatTunerFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

const entity: StoredCatalogEntity = {
  id: 'cb-sw', catalogId: 'combat-map', name: 'Slash Combo',
  categoryPath: ['Combat Map', 'Sword'], tags: ['Sword'], lifecycle: 'planned',
  data: { id: 'cb-sw', name: 'Slash Combo', weaponCategory: 'Sword', hits: 3, totalTime: '1.5s', dps: 245, chain: ['a', 'b', 'c'] },
};

describe('CombatTunerFacet', () => {
  beforeEach(() => execute.mockClear());
  afterEach(cleanup);

  it('renders the current DPS and a target input', () => {
    render(<CombatTunerFacet entity={entity} />);
    expect(screen.getByText(/DPS Tuner/i)).toBeTruthy();
    expect(screen.getByText(/Target DPS/i)).toBeTruthy();
  });

  it('shows both retime and damage-scale levers for a positive target', () => {
    render(<CombatTunerFacet entity={entity} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '300' } });
    expect(screen.getByText(/Retime to/i)).toBeTruthy();
    expect(screen.getByText(/Scale per-hit damage/i)).toBeTruthy();
  });

  it('dispatches a quick-action describing the retune when applied', () => {
    render(<CombatTunerFacet entity={entity} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /apply via claude/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('300 DPS');
  });

  it('shows a fallback for non-combo data', () => {
    const bad = { id: 'x', catalogId: 'combat-map', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as StoredCatalogEntity;
    render(<CombatTunerFacet entity={bad} />);
    expect(screen.getByText(/no combo data to tune/i)).toBeTruthy();
  });
});
