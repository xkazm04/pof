// Fleet-wide guard (/diablo W02c): a producer must be SHOWN every field its step's checker grades.
// Measured before the fix: 102 of 114 steps whose checker states required keys had produce prompts
// that never named at least one of them — codex reproduced a zombie's Stat Block exactly and still
// failed, nesting the values under its own keys. The same run then failed Lore/Concept (a text field
// graded by length, never named) and Abilities (a wiring contract whose ARRAY structure was never
// stated), and passed a Stat Block whose moveSpeed was a declared gap. This pins all four.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { buildStepProducePrompt } from '@/lib/catalog/stepPrompt';
import { requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';
import { fieldsPopulated } from '@/lib/catalog/acceptance/dataCheckers';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

const entity = { id: 'x', name: 'X', lifecycle: 'planned' as const, data: {} };
const ctx = (catalog: string) => ({ catalog, siblings: {}, has: () => true });
const promptFor = (catalogId: string, s: Parameters<typeof buildStepProducePrompt>[0]) =>
  buildStepProducePrompt(s, entity, undefined, { catalogId, rules: CANON_SEED });

describe('required fields reach the produce prompt', () => {
  it('every key a step’s checker reports as missing on empty data is named in that step’s prompt', () => {
    const blind: string[] = [];
    let graded = 0;
    for (const p of allCatalogPipelines()) for (const s of p.steps) {
      const m = /missing: ([\w, .]+)/.exec(s.accept({}, ctx(p.catalogId)).reason ?? '');
      if (!m) continue;
      graded++;
      const prompt = promptFor(p.catalogId, s);
      const unnamed = m[1].split(',').map((k) => k.trim()).filter(Boolean).filter((k) => !prompt.includes(k));
      if (unnamed.length) blind.push(`${p.catalogId} · ${s.label}: ${unnamed.join(', ')}`);
    }
    expect(graded).toBeGreaterThan(100); // the census is real, not vacuous
    expect(blind).toEqual([]);
  });

  it('every TEXT field a checker grades by length is named in that step’s prompt', () => {
    const blind: string[] = [];
    let graded = 0;
    for (const p of allCatalogPipelines()) for (const s of p.steps) {
      const m = /field "([\w.]+)" is \d+ characters, needs/.exec(s.accept({}, ctx(p.catalogId)).reason ?? '');
      if (!m) continue;
      graded++;
      if (!promptFor(p.catalogId, s).includes(`\`${m[1]}\``)) blind.push(`${p.catalogId} · ${s.label}: ${m[1]}`);
    }
    expect(graded).toBeGreaterThan(10);
    expect(blind).toEqual([]);
  });

  it('requiredFieldsOf reads through allOf compositions (and the SOURCED registration wrap)', () => {
    const stat = allCatalogPipelines().find((p) => p.catalogId === 'bestiary')!.steps.find((s) => s.label === 'Stat Block')!;
    const req = requiredFieldsOf(stat.accept);
    expect(req.find((r) => r.field === 'stats')?.keys).toEqual(expect.arrayContaining(['damage', 'armor', 'moveSpeed']));
  });

  it('a step with a wiring contract states its STRUCTURE (dependencies is an array)', () => {
    const ab = allCatalogPipelines().find((p) => p.catalogId === 'bestiary')!.steps.find((s) => s.label === 'Abilities')!;
    expect(promptFor('bestiary', ab)).toMatch(/wiringContract.*only if you declare it.*dependencies: string\[\] \(a JSON ARRAY/);
  });
});

describe('a declared gap is graded as missing, never as filled', () => {
  const c = fieldsPopulated('stats', 'stats', ['armor', 'moveSpeed']);

  it('reads "not in the reference" — bare or as { value } — as unpopulated, and says so', () => {
    expect(c({ stats: { armor: 5, moveSpeed: 'Not in the reference' } }).status).toBe('pending');
    const r = c({ stats: { armor: 5, moveSpeed: { value: 'not in the reference', attributeTarget: 'x' } } });
    expect(r.status).toBe('pending');
    expect(r.reason).toMatch(/missing: moveSpeed \(declared gap: moveSpeed/);
  });

  it('a real value still passes', () => {
    expect(c({ stats: { armor: 5, moveSpeed: 600 } }).status).toBe('pass');
  });
});
