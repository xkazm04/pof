import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { seedMaterialEntries } from '@/lib/catalog/seed-materials';

describe('materials catalog substrate (Phase 8)', () => {
  it('CATALOG_SECTIONS now has 9 entries', () => {
    expect(CATALOG_SECTIONS).toHaveLength(9);
  });

  it('includes materials in CATALOG_SECTIONS', () => {
    const ids = CATALOG_SECTIONS.map((s) => s.catalogId);
    expect(ids).toContain('materials');
  });

  it('materials section is labeled and seeds empty', () => {
    const materials = CATALOG_SECTIONS.find((s) => s.catalogId === 'materials');
    expect(materials?.label).toBe('Materials');
    expect(seedMaterialEntries()).toEqual([]);
  });
});
