import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BestiaryBalanceFacet } from '@/components/ecw/facets/bestiary/BestiaryBalanceFacet';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function archEntity(id: string, tier: string, hp: number, dmg: number, abilities: string[] = ['Hit']): CatalogEntityBase {
  return {
    id, catalogId: 'bestiary', name: id, categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned',
    data: { id, tier, stats: [{ label: 'Health', value: hp }, { label: 'Damage', value: dmg }], abilities },
  } as CatalogEntityBase;
}

function seedBestiary(entities: CatalogEntityBase[]) {
  const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
  for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
  for (const e of entities) seeded.bestiary[e.id] = e;
  useCatalogStore.setState({ entitiesByCatalog: seeded });
}

describe('BestiaryBalanceFacet', () => {
  beforeEach(() => seedBestiary([]));
  afterEach(cleanup);

  it('renders an ok finding when the archetype is balanced', () => {
    const target = archEntity('brute', 'major', 200, 25);
    seedBestiary([target, archEntity('a', 'major', 210, 26), archEntity('b', 'major', 190, 24)]);
    render(<BestiaryBalanceFacet entity={target} />);
    expect(screen.getByText(/consistent with 2 same-tier peers/i)).toBeTruthy();
  });

  it('renders a warning when health is an outlier', () => {
    const target = archEntity('giant', 'major', 2000, 25);
    seedBestiary([target, archEntity('a', 'major', 200, 25), archEntity('b', 'major', 220, 25)]);
    render(<BestiaryBalanceFacet entity={target} />);
    expect(screen.getByText(/the same-tier average/i)).toBeTruthy();
  });

  it('renders an error when abilities are missing', () => {
    const target = archEntity('mute', 'major', 200, 25, []);
    seedBestiary([target, archEntity('a', 'major', 200, 25), archEntity('b', 'major', 210, 26)]);
    render(<BestiaryBalanceFacet entity={target} />);
    expect(screen.getByText(/No abilities defined/i)).toBeTruthy();
  });

  it('shows fallback for an entity with no archetype data', () => {
    const bad = { id: 'x', catalogId: 'bestiary', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned' } as CatalogEntityBase;
    seedBestiary([bad]);
    render(<BestiaryBalanceFacet entity={bad} />);
    expect(screen.getByText(/no archetype data/i)).toBeTruthy();
  });
});
