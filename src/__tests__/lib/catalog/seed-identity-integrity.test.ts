/**
 * Every code seed's identity, for EVERY catalog — not just the one that happened to get a test.
 *
 * `pipeline_artifacts` is keyed `(catalog_id, entity_id, step)` and `seedAllCatalogs()` indexes
 * each seed by id, so two seeds sharing an id in one catalog silently collapse to ONE entity in
 * the lab while sharing every artifact row on the server. Only `spellbook` pinned uniqueness
 * (catalog-seed.test.ts); this derives the set from `CATALOG_SECTIONS`, the ground truth, so a
 * catalog added later is covered without anyone remembering to add it here.
 */
import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';

/** Ids that occur more than once in `ids` (each reported once). */
function duplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

describe('code seed identity integrity (all CATALOG_SECTIONS)', () => {
  it('the detector itself bites on a seeded duplicate', () => {
    expect(duplicateIds(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b']);
    expect(duplicateIds(['a', 'b'])).toEqual([]);
  });

  it('covers every registered section', () => {
    expect(CATALOG_SECTIONS.length).toBeGreaterThan(30);
  });

  for (const section of CATALOG_SECTIONS) {
    describe(section.catalogId, () => {
      const entities = section.seed();

      it('has unique, non-empty entity ids', () => {
        expect(entities.filter((e) => typeof e.id !== 'string' || e.id.trim() === '').length).toBe(0);
        expect(duplicateIds(entities.map((e) => e.id))).toEqual([]);
      });

      it('stamps every entity with its own section catalogId', () => {
        expect(entities.filter((e) => e.catalogId !== section.catalogId).map((e) => e.id)).toEqual([]);
      });
    });
  }
});
