import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BestiaryEncounterFacet } from '@/components/ecw/facets/bestiary/BestiaryEncounterFacet';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

function unit(id: string, role: string, tier: string): CatalogEntityBase {
  return {
    id, catalogId: 'bestiary', name: id, categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned',
    data: { id, role, tier, stats: [], abilities: [] },
  } as CatalogEntityBase;
}

function seed(entities: CatalogEntityBase[]) {
  const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
  for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
  for (const e of entities) seeded.bestiary[e.id] = e;
  useCatalogStore.setState({ entitiesByCatalog: seeded });
}

const roster = [
  unit('brute', 'tank', 'elite'),
  unit('archer', 'ranged', 'standard'),
  unit('grunt', 'melee', 'minion'),
];

describe('BestiaryEncounterFacet', () => {
  beforeEach(() => {
    execute.mockClear();
    seed(roster);
  });
  afterEach(cleanup);

  it('renders the focus archetype as the lead of the suggested composition', () => {
    render(<BestiaryEncounterFacet entity={roster[0]} />);
    expect(screen.getByText(/Encounter Director/i)).toBeTruthy();
    expect(screen.getByText(/Suggested composition/i)).toBeTruthy();
    // focus + at least one support is listed
    expect(screen.getByText('archer')).toBeTruthy();
  });

  it('dispatches a quick-action carrying the focus + composition + intent', () => {
    render(<BestiaryEncounterFacet entity={roster[0]} />);
    fireEvent.change(screen.getByPlaceholderText(/optional intent/i), {
      target: { value: 'rooftop ambush' },
    });
    fireEvent.click(screen.getByRole('button', { name: /author encounter/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('brute');
    expect(task.prompt).toContain('rooftop ambush');
  });

  it('shows a fallback when the entity has no role/tier', () => {
    const bad = { id: 'x', catalogId: 'bestiary', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as CatalogEntityBase;
    seed([bad]);
    render(<BestiaryEncounterFacet entity={bad} />);
    expect(screen.getByText(/no archetype role\/tier/i)).toBeTruthy();
  });
});
