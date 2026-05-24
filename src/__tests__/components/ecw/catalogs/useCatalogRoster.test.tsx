import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCatalogRoster } from '@/components/ecw/catalogs/useCatalogRoster';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function makeEntity(id: string, catalogId: string, lifecycle: CatalogEntityBase['lifecycle'], lastTestResult?: 'pass' | 'fail'): CatalogEntityBase {
  return { id, catalogId, name: id, categoryPath: ['root'], tags: [], lifecycle, lastTestResult };
}

describe('useCatalogRoster', () => {
  beforeEach(() => {
    // Reset to a known minimal state across all 8 sections.
    const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    useCatalogStore.setState({ entitiesByCatalog: seeded });
  });

  it('returns one entry per registered catalog (8)', () => {
    const { result } = renderHook(() => useCatalogRoster());
    expect(result.current).toHaveLength(CATALOG_SECTIONS.length);
    expect(result.current.map((r) => r.catalogId).sort()).toEqual(CATALOG_SECTIONS.map((s) => s.catalogId).sort());
  });

  it('computes total + verified counts from the store', () => {
    useCatalogStore.setState({
      entitiesByCatalog: {
        spellbook: {
          a: makeEntity('a', 'spellbook', 'verified'),
          b: makeEntity('b', 'spellbook', 'planned'),
          c: makeEntity('c', 'spellbook', 'verified'),
        },
        items: {},
        'loot-tables': {},
        bestiary: {},
        'combat-map': {},
        'screen-flow': {},
        'zone-map': {},
        'state-graph': {},
      },
    });
    const { result } = renderHook(() => useCatalogRoster());
    const spellbook = result.current.find((r) => r.catalogId === 'spellbook')!;
    expect(spellbook.total).toBe(3);
    expect(spellbook.verified).toBe(2);
  });

  it('computes failingCount from lastTestResult', () => {
    useCatalogStore.setState({
      entitiesByCatalog: {
        spellbook: {},
        items: {
          x: makeEntity('x', 'items', 'wired', 'fail'),
          y: makeEntity('y', 'items', 'verified', 'pass'),
          z: makeEntity('z', 'items', 'failed', 'fail'),
        },
        'loot-tables': {},
        bestiary: {},
        'combat-map': {},
        'screen-flow': {},
        'zone-map': {},
        'state-graph': {},
      },
    });
    const { result } = renderHook(() => useCatalogRoster());
    const items = result.current.find((r) => r.catalogId === 'items')!;
    expect(items.failingCount).toBe(2);
  });

  it('label matches CATALOG_SECTIONS', () => {
    const { result } = renderHook(() => useCatalogRoster());
    const spellbook = result.current.find((r) => r.catalogId === 'spellbook')!;
    expect(spellbook.label).toBe('Spellbook');
  });
});
