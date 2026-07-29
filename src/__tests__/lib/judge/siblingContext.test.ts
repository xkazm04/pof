import { describe, it, expect } from 'vitest';
import { buildSiblingContext, projectStep } from '@/lib/judge/siblingContext';
import { buildRubricPrompt } from '@/lib/judge/rubrics';

describe('projectStep', () => {
  it('surfaces the priority cross-reference blocks and top-level scalars, drops heavy media keys', () => {
    const out = projectStep(
      {
        statHooks: { damageMin: 8, damageMax: 12 },
        crossReferences: { conceptBrief: 'mirrors it' },
        rarity: 'Common',
        genHistory: { batches: [{ candidates: Array(50).fill({ swatch: 'url(...)' }) }] },
        _provenance: { model: 'x' },
        longObject: { a: { deep: 'nested not included' } },
      },
      600,
    );
    expect(out).toContain('statHooks=');
    expect(out).toContain('"damageMin":8');
    expect(out).toContain('crossReferences=');
    expect(out).toContain('"rarity":"Common"');
    expect(out).not.toContain('genHistory');
    expect(out).not.toContain('_provenance');
    expect(out).not.toContain('nested not included'); // non-priority nested objects are not dumped
  });

  it('truncates to the per-step budget', () => {
    const out = projectStep({ blob: 'x'.repeat(1000), n: 1 }, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('buildSiblingContext', () => {
  const steps = [
    { step: 'Concept Brief', data: { statHooks: { dps: 38 }, rarity: 'Unique' } },
    { step: 'Economy', data: { statHooks: { baseValue: 15 } } },
    { step: 'Tooltip', data: { rarity: 'Unique' } },
  ];

  it("excludes the step under judgment and lists the others sorted", () => {
    const ctx = buildSiblingContext(steps, 'Tooltip');
    expect(ctx).toContain('- Concept Brief:');
    expect(ctx).toContain('- Economy:');
    expect(ctx).not.toContain('- Tooltip:'); // the one being judged is excluded
    expect(ctx.indexOf('Concept Brief')).toBeLessThan(ctx.indexOf('Economy')); // sorted
  });

  it('returns empty string when the entity has no other steps', () => {
    expect(buildSiblingContext([{ step: 'Only', data: { a: 1 } }], 'Only')).toBe('');
  });

  it('caps total length and reports the omission rather than silently truncating', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ step: `S${String(i).padStart(2, '0')}`, data: { blob: 'y'.repeat(500), i } }));
    const ctx = buildSiblingContext(many, 'S99', { totalChars: 1500 });
    expect(ctx.length).toBeLessThan(2000);
    expect(ctx).toContain('more sibling step(s) omitted');
  });
});

describe('projectStep — nested projection (opt-in)', () => {
  const nestedOnly = { rules: { decayPerDay: 10, tiers: ['Revered', 'Exalted'] } };

  it('by default a nested-only step still projects empty (unchanged contract)', () => {
    expect(projectStep(nestedOnly, 600)).toBe('');
  });

  it('with includeNested the step becomes visible to the judge', () => {
    const out = projectStep(nestedOnly, 600, { includeNested: true });
    expect(out).toContain('rules=');
    expect(out).toContain('"decayPerDay":10');
  });

  it('still drops non-content keys even when including nested', () => {
    const out = projectStep(
      { genHistory: { batches: [1] }, produceDirection: { prompt: 'y' }, rules: { a: 1 } },
      600,
      { includeNested: true },
    );
    expect(out).not.toContain('genHistory');
    expect(out).not.toContain('produceDirection');
    expect(out).toContain('"a":1');
  });

  it('stays within the per-step budget with a huge nested object', () => {
    const big = { rules: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`k${i}`, i])) };
    const out = projectStep(big, 200, { includeNested: true });
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('caps each nested key individually so an earlier fat key cannot crowd out a later one', () => {
    // Each `big` alone serializes to ~1980 chars — with no per-key cap, `a=<...>` would already
    // exceed the 600-char overall budget by itself, and the final truncation would cut the string
    // off inside `a`'s blob before `b=` ever appears. The per-key cap (perKey = perStepChars/3)
    // truncates each nested value to ~200 chars first, so all three keys fit and a LATER key
    // (b) still survives truncation — this is what would go undetected if `perKey` were deleted.
    const big = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i]));
    const out = projectStep({ a: big, b: big, c: big }, 600, { includeNested: true });
    expect(out).toContain('b=');
  });

  it('buildSiblingContext threads the option and respects the total budget', () => {
    const steps = [
      { step: 'A', data: { rules: { x: 1 } } },
      { step: 'B', data: { rules: { y: 2 } } },
    ];
    expect(buildSiblingContext(steps, 'A')).toBe('');
    const on = buildSiblingContext(steps, 'A', { includeNested: true });
    expect(on).toContain('- B:');
    expect(on).toContain('"y":2');
    // A tiny totalChars forces the omission line rather than a silent truncation — assert the
    // omission text itself, not a length bound (a fixed-length omission line would pass this
    // length check regardless of whether the budget logic actually ran).
    expect(buildSiblingContext(steps, 'A', { includeNested: true, totalChars: 10 }))
      .toContain('more sibling step(s) omitted');
  });
});

describe('buildRubricPrompt canon + sibling wiring', () => {
  const base = { subject: 'items :: Tooltip', payload: '```json\n{}\n```' };

  it('injects the canon framing (protect canon-correct, still penalize violations) only when canon supplied', () => {
    const withCanon = buildRubricPrompt('text-config', { ...base, canonContext: '# PROJECT CANON (follow these)\n## GAME CANON\n- X: Y' });
    expect(withCanon).toContain('PROJECT CANON');
    expect(withCanon).toContain('binding design constraints a senior reviewer');
    expect(withCanon).toContain('does NOT lower the quality bar');
    expect(withCanon).toContain('VIOLATION of canon');
    // Absent when not supplied — the canon-blind judge prompt carries no canon framing.
    expect(buildRubricPrompt('text-config', base)).not.toContain('PROJECT CANON');
  });

  it('frames sibling context as consistency-is-correct, contradiction-is-a-defect', () => {
    const p = buildRubricPrompt('text-config', { ...base, siblingContext: '- Economy: baseValue=15' });
    expect(p).toContain('SIBLING CONTEXT');
    expect(p).toContain('CORRECT, not an invented reference');
    expect(p).toContain('baseValue=15');
  });
});
