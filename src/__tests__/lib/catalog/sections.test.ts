import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS, seedAllCatalogs } from '@/lib/catalog/sections';

describe('CATALOG_SECTIONS', () => {
  it('registers spellbook, items, and loot-tables', () => {
    expect(CATALOG_SECTIONS.map((s) => s.catalogId).sort())
      .toEqual(['items', 'loot-tables', 'spellbook']);
  });
});

describe('seedAllCatalogs', () => {
  const seeded = seedAllCatalogs();
  it('produces a non-empty map per registered catalog', () => {
    for (const s of CATALOG_SECTIONS) {
      expect(Object.keys(seeded[s.catalogId]).length).toBeGreaterThan(0);
    }
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
