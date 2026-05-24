import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS, seedAllCatalogs } from '@/lib/catalog/sections';

describe('CATALOG_SECTIONS', () => {
  it('registers the 9 catalogs (8 Core Engine + materials Phase 8 substrate)', () => {
    expect(CATALOG_SECTIONS.map((s) => s.catalogId).sort()).toEqual([
      'bestiary',
      'combat-map',
      'items',
      'loot-tables',
      'materials',
      'screen-flow',
      'spellbook',
      'state-graph',
      'zone-map',
    ]);
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
    // Materials is empty per Phase 8 substrate proof.
    expect(Object.keys(seeded.materials)).toHaveLength(0);
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
