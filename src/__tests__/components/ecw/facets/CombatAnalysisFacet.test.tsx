import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CombatAnalysisFacet } from '@/components/ecw/facets/combat-map/CombatAnalysisFacet';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function comboEntity(id: string, weapon: string, hits: number, totalTime: string, dps: number, chain: string[]): CatalogEntityBase {
  return {
    id, catalogId: 'combat-map', name: id, categoryPath: ['Combat Map', weapon], tags: [weapon], lifecycle: 'planned',
    data: { id, name: id, weaponCategory: weapon, hits, totalTime, dps, chain },
  } as CatalogEntityBase;
}

function seed(entities: CatalogEntityBase[]) {
  const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
  for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
  for (const e of entities) seeded['combat-map'][e.id] = e;
  useCatalogStore.setState({ entitiesByCatalog: seeded });
}

describe('CombatAnalysisFacet', () => {
  beforeEach(() => seed([]));
  afterEach(cleanup);

  it('renders derived combat metrics', () => {
    const e = comboEntity('cb-sw', 'Sword', 3, '1.5s', 245, ['Slash', 'Cross', 'Thrust']);
    seed([e]);
    render(<CombatAnalysisFacet entity={e} />);
    expect(screen.getByText(/Combat Analysis/i)).toBeTruthy();
    expect(screen.getByText('245')).toBeTruthy();
    expect(screen.getByText(/2\.0 hits\/s/)).toBeTruthy();
  });

  it('surfaces a chain/hit mismatch warning', () => {
    const e = comboEntity('cb-bad', 'Sword', 3, '1.5s', 245, ['Slash', 'Thrust']); // 2 steps, 3 hits
    seed([e]);
    render(<CombatAnalysisFacet entity={e} />);
    expect(screen.getByText(/chain has 2 steps/i)).toBeTruthy();
  });

  it('shows a fallback for non-combo data', () => {
    const bad = { id: 'x', catalogId: 'combat-map', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as CatalogEntityBase;
    seed([bad]);
    render(<CombatAnalysisFacet entity={bad} />);
    expect(screen.getByText(/no combo data to analyse/i)).toBeTruthy();
  });
});
