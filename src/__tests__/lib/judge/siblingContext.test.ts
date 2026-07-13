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
