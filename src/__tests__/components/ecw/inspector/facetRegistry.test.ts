import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetFacetRegistry,
  registerFacet,
  getFacetsForCatalog,
} from '@/components/ecw/inspector/facetRegistry';

const Stub = () => null;

describe('facetRegistry', () => {
  beforeEach(() => __resetFacetRegistry());

  it('returns empty array for unknown catalog', () => {
    expect(getFacetsForCatalog('not-a-catalog')).toEqual([]);
  });

  it('returns facets registered for a catalog', () => {
    registerFacet('bestiary', { id: 'detail', label: 'Detail', Component: Stub });
    expect(getFacetsForCatalog('bestiary')).toHaveLength(1);
    expect(getFacetsForCatalog('bestiary')[0].id).toBe('detail');
  });

  it('registers multiple facets in registration order', () => {
    registerFacet('bestiary', { id: 'a', label: 'A', Component: Stub });
    registerFacet('bestiary', { id: 'b', label: 'B', Component: Stub });
    const facets = getFacetsForCatalog('bestiary');
    expect(facets.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('keeps facets isolated per catalog', () => {
    registerFacet('bestiary', { id: 'a', label: 'A', Component: Stub });
    registerFacet('spellbook', { id: 'b', label: 'B', Component: Stub });
    expect(getFacetsForCatalog('bestiary').map((f) => f.id)).toEqual(['a']);
    expect(getFacetsForCatalog('spellbook').map((f) => f.id)).toEqual(['b']);
  });
});
