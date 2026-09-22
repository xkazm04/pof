// /diablo W02c-1 + W03 (D11). A produce prompt used to cite an entity by NAME only. An INGESTED entity
// carries a REFERENCE VALUES section (reproduce); an AUTHORED one an ENTITY VALUES section (stay consistent).
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { buildStepProducePrompt } from '@/lib/catalog/stepPrompt';
import { entityValuesBlock, referenceValuesBlock } from '@/lib/catalog/referenceValues';
import { labIdentityOf } from '@/lib/catalog/canon/profiles';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

const spec = getCatalogPipeline('bestiary')!.steps.find((s) => s.label === 'Stat Block')!;
const data = { stats: [{ label: 'HP Min', value: '4' }, { label: 'HP Max', value: '7' }, { label: 'Armor Class', value: '5' }], category: 'Undead', sourced: { x: 1 } };
const provenance = { canonProfile: 'diablo1', sourceGame: 'Diablo I (1996)', sourceFile: 'monsters/monstdat.tsv', sourceRow: '_monster_id=MT_NZOMBIE' };
const ingested = { id: 'd1-MT_NZOMBIE', name: 'Zombie', lifecycle: 'planned' as const, data, ...labIdentityOf({ provenance }) };
const authored = { id: 'bestiary-brute', name: 'Brute', lifecycle: 'planned' as const, data, ...labIdentityOf({}) };

describe('referenceValuesBlock', () => {
  it('renders the source row and the reference values, and tells the producer to reproduce them', () => {
    const b = referenceValuesBlock(ingested);
    expect(b).toContain('# REFERENCE VALUES — Diablo I (1996) · monsters/monstdat.tsv (_monster_id=MT_NZOMBIE)');
    expect(b).toContain('HP Min: 4 · HP Max: 7 · Armor Class: 5');
    expect(b).toMatch(/REPRODUCE the value exactly/);
    expect(b).not.toContain('sourced');
  });

  it('is empty for an entity with no reference', () => {
    expect(referenceValuesBlock(authored)).toBe('');
  });

  it('is bounded', () => {
    const big = { ...ingested, data: { blob: 'x'.repeat(5000) } };
    expect(referenceValuesBlock(big).length).toBeLessThan(2600);
  });
});

describe('reach at the chokepoint', () => {
  it('an ingested entity’s Stat Block prompt carries its real stats', () => {
    const p = buildStepProducePrompt(spec, ingested, undefined, { catalogId: 'bestiary', rules: CANON_SEED });
    expect(p).toContain('HP Max: 7');
  });

  it('an authored entity’s prompt carries its values as ENTITY VALUES — consistent, not reproduced (W03, D11)', () => {
    const p = buildStepProducePrompt(spec, authored, undefined, { catalogId: 'bestiary', rules: CANON_SEED });
    expect(p).not.toContain('REFERENCE VALUES');
    expect(p).toContain('# ENTITY VALUES — Brute');
    expect(p).toContain('HP Max: 7');
    expect(p).toMatch(/keep it CONSISTENT/);
    expect(p).not.toMatch(/REPRODUCE the value exactly/);
  });

  it('an entity that records nothing gets no values section', () => {
    const bare = { id: 'b', name: 'Bare', lifecycle: 'planned' as const, data: {} };
    expect(entityValuesBlock(bare)).toBe('');
    expect(buildStepProducePrompt(spec, bare, undefined, { catalogId: 'bestiary', rules: CANON_SEED })).not.toMatch(/ENTITY VALUES|REFERENCE VALUES/);
  });
});
