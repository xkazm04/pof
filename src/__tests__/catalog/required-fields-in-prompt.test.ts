// Fleet-wide guard (/diablo W02c): a producer must be SHOWN every key its step's checker grades.
// Measured before the fix: 102 of 114 steps whose checker states required keys had produce prompts
// that never named at least one of them — codex reproduced a zombie's Stat Block exactly and still
// failed, nesting the values under its own keys. This pins the census at zero, for every pipeline.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { buildStepProducePrompt } from '@/lib/catalog/stepPrompt';
import { requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

const entity = { id: 'x', name: 'X', lifecycle: 'planned' as const, data: {} };

describe('required fields reach the produce prompt', () => {
  it('every key a step’s checker reports as missing on empty data is named in that step’s prompt', () => {
    const blind: string[] = [];
    let graded = 0;
    for (const p of allCatalogPipelines()) for (const s of p.steps) {
      const m = /missing: ([\w, .]+)/.exec(s.accept({}, { catalog: p.catalogId, siblings: {}, has: () => true }).reason ?? '');
      if (!m) continue;
      graded++;
      const prompt = buildStepProducePrompt(s, entity, undefined, { catalogId: p.catalogId, rules: CANON_SEED });
      const unnamed = m[1].split(',').map((k) => k.trim()).filter(Boolean).filter((k) => !prompt.includes(k));
      if (unnamed.length) blind.push(`${p.catalogId} · ${s.label}: ${unnamed.join(', ')}`);
    }
    expect(graded).toBeGreaterThan(100); // the census is real, not vacuous
    expect(blind).toEqual([]);
  });

  it('requiredFieldsOf reads through allOf compositions (and the SOURCED registration wrap)', () => {
    const stat = allCatalogPipelines().find((p) => p.catalogId === 'bestiary')!.steps.find((s) => s.label === 'Stat Block')!;
    const req = requiredFieldsOf(stat.accept);
    expect(req.find((r) => r.field === 'stats')?.keys).toEqual(expect.arrayContaining(['damage', 'armor', 'moveSpeed']));
  });
});
