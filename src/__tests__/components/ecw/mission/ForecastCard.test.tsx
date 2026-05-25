import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ForecastCard } from '@/components/ecw/mission/ForecastCard';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function mkEntity(id: string, catalogId: string, lifecycle: CatalogEntityBase['lifecycle']): CatalogEntityBase {
  return { id, catalogId, name: id, categoryPath: ['x'], tags: [], lifecycle };
}

describe('ForecastCard', () => {
  beforeEach(() => {
    const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    useCatalogStore.setState({ entitiesByCatalog: seeded });
  });
  afterEach(cleanup);

  it('renders the card title', () => {
    render(<ForecastCard />);
    expect(screen.getByRole('heading', { level: 2, name: /Forecast/ })).toBeTruthy();
  });

  it('shows awaiting-data state when no verified entities', () => {
    render(<ForecastCard />);
    expect(screen.getByText(/Awaiting first verified entity/i)).toBeTruthy();
  });

  it('renders days remaining + velocity when verified entities exist', () => {
    useCatalogStore.setState({
      entitiesByCatalog: {
        spellbook: {
          a: mkEntity('a', 'spellbook', 'verified'),
          b: mkEntity('b', 'spellbook', 'verified'),
          c: mkEntity('c', 'spellbook', 'planned'),
          d: mkEntity('d', 'spellbook', 'planned'),
        },
        items: {}, 'loot-tables': {}, bestiary: {}, 'combat-map': {},
        'screen-flow': {}, 'zone-map': {}, 'state-graph': {},
        materials: {}, audio: {}, 'animation-assets': {},
      },
    });
    render(<ForecastCard />);
    expect(screen.getByText(/days until verified/i)).toBeTruthy();
    expect(screen.getByText(/verified \/ day/i)).toBeTruthy();
    expect(screen.getByText(/confidence/i)).toBeTruthy();
  });
});
