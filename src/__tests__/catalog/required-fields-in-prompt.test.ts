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
import { gradedFieldClosure, gradedFieldsOf, requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';
import { fieldsPopulated } from '@/lib/catalog/acceptance/dataCheckers';
import { priceRatioWithinBand } from '@/lib/catalog/acceptance/invariants';
import { CONTRACT_RULE, stepContractBlock } from '@/lib/catalog/contractPrompt';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import type { StepSpec } from '@/lib/catalog/stepSpec';

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

  it('every LIST a checker counts is named in that step’s prompt (Abilities wrote `abilityLoadout`)', () => {
    const blind: string[] = [];
    let graded = 0;
    for (const p of allCatalogPipelines()) for (const s of p.steps) {
      const m = /field "([\w.]+)" has \d+ item\(s\), needs/.exec(s.accept({}, ctx(p.catalogId)).reason ?? '');
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

// The census above samples what a checker SAYS on empty data, so it is blind to a value law, whose
// pending reason names no "missing:". Measured 2026-10-10: 58 of 259 graded steps read a top-level
// field their prompt never named (19 value-law fields such as `pricePowerRatio`, `integratedLUFS` and
// `marginPct`, and `links` on 44). This closes the list as arithmetic instead: what the checker READS
// (recorded over its own produce stub) = described + named, every term derived.
describe('the graded fields close as arithmetic', () => {
  const steps = allCatalogPipelines().flatMap((p) => p.steps.map((s) => ({ catalogId: p.catalogId, s })));

  it('every field a non-deferred step’s checker reads is named in that step’s prompt', () => {
    const blind: string[] = [];
    let graded = 0;
    for (const { catalogId, s } of steps) {
      if (gradedFieldsOf(s).deferred) continue; // an L3/L4 runner or the selection writes those (rule e)
      const c = gradedFieldClosure(s, requiredFieldsOf(s.accept));
      if (!c.total) continue;
      graded++;
      const prompt = promptFor(catalogId, s);
      const unnamed = [...c.listed, ...c.rest].filter((f) => !prompt.includes(`\`${f}`));
      if (unnamed.length) blind.push(`${catalogId} · ${s.label}: ${unnamed.join(', ')}`);
    }
    expect(graded).toBeGreaterThan(200); // the census is real, not vacuous
    expect(blind).toEqual([]);
  });

  it('the wiring rule reaches only a step that declares or grades a wiring contract', () => {
    const orphan: string[] = [];
    let ruled = 0;
    for (const { catalogId, s } of steps) {
      if (!stepContractBlock(s, entity).includes(CONTRACT_RULE)) continue;
      ruled++;
      if (!s.contract && !requiredFieldsOf(s.accept).some((r) => r.field.endsWith('wiringContract'))) {
        orphan.push(`${catalogId} · ${s.label}`);
      }
    }
    expect(ruled).toBeGreaterThan(100);
    expect(orphan).toEqual([]);
  });

  const base = steps.find((x) => x.catalogId === 'items')!.s;

  it('names a field only a value law reads — the case the reason-text census cannot see', () => {
    const planted: StepSpec = { ...base, contract: undefined, criteria: undefined,
      produce: () => ({ data: { tradeRatio: 1 } }), accept: priceRatioWithinBand('tradeRatio', 'planted ratio') };
    expect(planted.accept({}).reason ?? '').not.toMatch(/missing: |characters, needs|item\(s\), needs/);
    expect(promptFor('items', planted)).toContain('`tradeRatio`: graded on its VALUE');
    expect(promptFor('items', planted)).toContain('Graded: 1 top-level field(s) = 0 described + 1 named.');
    expect(promptFor('items', planted)).not.toContain(CONTRACT_RULE);
  });

  it('never tells a producer to write a field a deferred gate reads (the runner owns it)', () => {
    const planted: StepSpec = { ...base, contract: undefined, criteria: undefined,
      produce: () => ({ data: { measuredLoadMs: 0 } }),
      accept: (d) => ({ label: 'planted runtime gate', tier: 'L3', status: d.measuredLoadMs == null ? 'pending' : 'deferred', detail: 'runner' }) };
    expect(gradedFieldClosure(planted, []).settledLater).toEqual(['measuredLoadMs']);
    expect(promptFor('items', planted)).not.toContain('measuredLoadMs');
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
