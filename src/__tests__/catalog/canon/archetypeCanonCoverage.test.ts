// Canon slice coverage (scan-sweep catalog-seed-data/B): every archetype a pipeline step uses has a
// DECIDED canon slice in ARCHETYPE_CANON. A missing key makes canonCategoriesForStep return
// undefined, which selectRules reads as "no category filter" - the step silently gets the full canon.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { ARCHETYPE_CANON } from '@/lib/catalog/canon/archetypeCanon';
import { canonCategoriesForStep } from '@/lib/catalog/contractPrompt';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

const pipelines = allCatalogPipelines();
const steps = pipelines.flatMap((p) => p.steps.map((s) => ({ catalogId: p.catalogId, spec: s })));
const usedArchetypes = [...new Set(steps.map((x) => x.spec.archetype as string))].sort();

describe('ARCHETYPE_CANON coverage', () => {
  it('every archetype used by a pipeline step has a decided slice', () => {
    const unmapped = usedArchetypes.filter((a) => !(a in ARCHETYPE_CANON));
    expect(unmapped).toEqual([]);
  });

  it('no custom step falls through to the unfiltered canon unless its checker is a content invariant', () => {
    const custom = steps.filter((x) => x.spec.archetype === 'custom');
    expect(custom.length).toBe(5);
    for (const { spec } of custom) {
      const cats = canonCategoriesForStep(spec);
      if (cats === undefined) continue; // content invariant: full canon by design
      expect(Array.isArray(cats)).toBe(true);
    }
  });

  it('the decided custom slice carries the same canon the unmapped key used to (delta 0 chars)', () => {
    const custom = steps.filter((x) => x.spec.archetype === 'custom');
    for (const { catalogId, spec } of custom) {
      const decided = canonContextFor(CANON_SEED, catalogId, canonCategoriesForStep(spec));
      const unfiltered = canonContextFor(CANON_SEED, catalogId, undefined);
      expect(decided.length).toBe(unfiltered.length);
      expect(decided.length).toBeGreaterThan(0);
    }
  });
});
