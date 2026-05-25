import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { PIPELINE_BY_CATALOG } from '@/lib/pipeline/tracks';
import { CATALOG_MODULE } from '@/lib/catalog/catalog-module';
import { NEW_CATALOGS, newCatalogStarters } from '@/lib/catalog/new-catalogs';

describe('catalog program coverage', () => {
  it('registers the 21 new catalogs as sections (32 total)', () => {
    const ids = new Set(CATALOG_SECTIONS.map((s) => s.catalogId));
    for (const c of NEW_CATALOGS) expect(ids.has(c.catalogId)).toBe(true);
    expect(CATALOG_SECTIONS.length).toBe(11 + NEW_CATALOGS.length);
  });

  it('every section has a category, a pipeline, and a module', () => {
    for (const s of CATALOG_SECTIONS) {
      expect(s.category, `${s.catalogId} category`).toBeTruthy();
      expect(PIPELINE_BY_CATALOG[s.catalogId], `${s.catalogId} pipeline`).toBeTruthy();
      expect(CATALOG_MODULE[s.catalogId], `${s.catalogId} module`).toBeTruthy();
    }
  });

  it('every new catalog seeds ≥1 well-formed starter', () => {
    for (const c of NEW_CATALOGS) {
      const starters = newCatalogStarters(c);
      expect(starters.length).toBeGreaterThan(0);
      for (const e of starters) {
        expect(e.id).toBeTruthy();
        expect(e.catalogId).toBe(c.catalogId);
        expect(e.name).toBeTruthy();
        expect(e.lifecycle).toBe('planned');
      }
    }
  });
});
