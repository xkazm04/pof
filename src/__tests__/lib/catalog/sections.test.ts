import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS, seedAllCatalogs } from '@/lib/catalog/sections';
import { NEW_CATALOGS } from '@/lib/catalog/new-catalogs';

const BASE_CATALOGS = [
  'animation-assets', 'audio', 'bestiary', 'combat-map', 'items', 'loot-tables',
  'materials', 'screen-flow', 'spellbook', 'state-graph', 'zone-map',
];

describe('CATALOG_SECTIONS', () => {
  it('keeps the 11 base catalogs (8 Core Engine + 3 Phase 8/8b substrates)', () => {
    const ids = new Set(CATALOG_SECTIONS.map((s) => s.catalogId));
    for (const id of BASE_CATALOGS) expect(ids.has(id)).toBe(true);
  });

  it('adds the Catalog Pipeline Expansion catalogs (11 base + the new driver)', () => {
    const ids = new Set(CATALOG_SECTIONS.map((s) => s.catalogId));
    for (const c of NEW_CATALOGS) expect(ids.has(c.catalogId), c.catalogId).toBe(true);
    expect(CATALOG_SECTIONS.length).toBe(BASE_CATALOGS.length + NEW_CATALOGS.length);
  });
});

describe('seedAllCatalogs', () => {
  const seeded = seedAllCatalogs();
  it('produces a map per registered catalog (empty allowed for substrate-only catalogs)', () => {
    for (const s of CATALOG_SECTIONS) {
      expect(seeded[s.catalogId]).toBeDefined();
    }
    // The 8 Core Engine catalogs have non-empty seeds.
    for (const cid of ['spellbook', 'items', 'loot-tables', 'bestiary', 'combat-map', 'screen-flow', 'zone-map', 'state-graph']) {
      expect(Object.keys(seeded[cid]).length).toBeGreaterThan(0);
    }
    // materials lifted in its first catalog-pipeline entity (Weathered Stone);
    // audio + animation-assets remain substrate-only (Phase 8b).
    expect(Object.keys(seeded.materials)).toHaveLength(1);
    expect(seeded.materials['mat-weathered-stone']).toBeDefined();
    expect(Object.keys(seeded.audio)).toHaveLength(0);
    expect(Object.keys(seeded['animation-assets'])).toHaveLength(0);
  });
  it('every entity is planned with a categoryPath', () => {
    for (const byId of Object.values(seeded)) {
      for (const e of Object.values(byId)) {
        expect(e.lifecycle).toBe('planned');
        expect(e.categoryPath.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
