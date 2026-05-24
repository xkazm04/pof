import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CatalogRollupCard } from '@/components/ecw/mission/CatalogRollupCard';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function mkEntity(id: string, catalogId: string, lifecycle: CatalogEntityBase['lifecycle']): CatalogEntityBase {
  return { id, catalogId, name: id, categoryPath: [], tags: [], lifecycle };
}

describe('CatalogRollupCard', () => {
  beforeEach(() => {
    const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    useCatalogStore.setState({ entitiesByCatalog: seeded });
  });
  afterEach(cleanup);

  it('renders the card title', () => {
    render(<CatalogRollupCard />);
    expect(screen.getByText(/Catalog Lifecycle/i)).toBeTruthy();
  });

  it('shows 0/0 when all catalogs are empty', () => {
    render(<CatalogRollupCard />);
    expect(screen.getByText(/0 of 0 verified/i)).toBeTruthy();
  });

  it('computes overall verified across all 8 catalogs', () => {
    useCatalogStore.setState({
      entitiesByCatalog: {
        spellbook: { a: mkEntity('a', 'spellbook', 'verified'), b: mkEntity('b', 'spellbook', 'planned') },
        items: { c: mkEntity('c', 'items', 'verified') },
        'loot-tables': {}, bestiary: {}, 'combat-map': {}, 'screen-flow': {}, 'zone-map': {}, 'state-graph': {},
      },
    });
    render(<CatalogRollupCard />);
    expect(screen.getByText(/2 of 3 verified/i)).toBeTruthy();
  });

  it('renders one mini bar per catalog (8)', () => {
    render(<CatalogRollupCard />);
    const minis = screen.getAllByTestId('catalog-rollup-mini');
    expect(minis).toHaveLength(CATALOG_SECTIONS.length);
  });
});
