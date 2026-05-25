import { describe, it, expect } from 'vitest';
import { presentationLink, isPresentationCatalog, PRESENTATION_CATALOGS } from '@/lib/catalog/presentation-links';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';

describe('presentation-links', () => {
  it('every presentation catalog is a registered section', () => {
    const ids = new Set(CATALOG_SECTIONS.map((s) => s.catalogId));
    for (const c of PRESENTATION_CATALOGS) expect(ids.has(c), c).toBe(true);
  });

  it('presentationLink binds a role to its presentation catalog', () => {
    expect(presentationLink('vfx', 'vfx-fire-impact')).toEqual({ catalogId: 'vfx', entityId: 'vfx-fire-impact', role: 'vfx' });
    expect(presentationLink('icon', 'iconset-abilities').catalogId).toBe('icon-sets');
    expect(presentationLink('sfx', 'sfx-fireball').catalogId).toBe('audio');
  });

  it('isPresentationCatalog distinguishes shared libraries from content catalogs', () => {
    expect(isPresentationCatalog('vfx')).toBe(true);
    expect(isPresentationCatalog('icon-sets')).toBe(true);
    expect(isPresentationCatalog('spellbook')).toBe(false);
  });
});
