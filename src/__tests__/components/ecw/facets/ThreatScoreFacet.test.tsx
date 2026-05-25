import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThreatScoreFacet } from '@/components/ecw/facets/bestiary/ThreatScoreFacet';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function archEntity(id: string, hp: number, dmg: number): CatalogEntityBase {
  return {
    id, catalogId: 'bestiary', name: id, categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned',
    data: { id, tier: 'major', stats: [{ label: 'Health', value: hp }, { label: 'Damage', value: dmg }], abilities: ['Hit'] },
  } as CatalogEntityBase;
}

function seed(entities: CatalogEntityBase[]) {
  const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
  for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
  for (const e of entities) seeded.bestiary[e.id] = e;
  useCatalogStore.setState({ entitiesByCatalog: seeded });
}

describe('ThreatScoreFacet', () => {
  beforeEach(() => seed([]));
  afterEach(cleanup);

  it('renders the threat score number', () => {
    const target = archEntity('brute', 200, 50);
    seed([target, archEntity('a', 100, 20), archEntity('b', 150, 30)]);
    render(<ThreatScoreFacet entity={target} />);
    expect(screen.getByText(/Threat Score/i)).toBeTruthy();
    // score = 200*0.3 + 50*0.5 = 85
    expect(screen.getByText('85')).toBeTruthy();
  });

  it('shows the roster percentile', () => {
    const target = archEntity('boss', 500, 100); // highest
    seed([target, archEntity('a', 100, 20), archEntity('b', 150, 30)]);
    render(<ThreatScoreFacet entity={target} />);
    expect(screen.getByText(/100th percentile/i)).toBeTruthy();
  });

  it('renders the per-stat contribution breakdown', () => {
    const target = archEntity('brute', 200, 50);
    seed([target]);
    render(<ThreatScoreFacet entity={target} />);
    expect(screen.getByText('Damage')).toBeTruthy();
    expect(screen.getByText('Health')).toBeTruthy();
  });

  it('shows fallback for entity without stats', () => {
    const bad = { id: 'x', catalogId: 'bestiary', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as CatalogEntityBase;
    seed([bad]);
    render(<ThreatScoreFacet entity={bad} />);
    expect(screen.getByText(/no stat data/i)).toBeTruthy();
  });
});
