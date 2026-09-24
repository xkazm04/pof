// /diablo W13 (D33) — a spell's damage/to-hit/cast timing is ENGINE CODE, written once as an engine-derived canon law and
// parsed at run time; the caster's numbers come from the class tables. Synthetic caster tables — no reference values.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { fireboltAt, fireboltLaw, referenceCaster } from '@/lib/catalog/reference/spellLaw';
import { seedSpellSteps } from '@/lib/catalog/reference/stepSeeds';
import { wrapTable } from '@/lib/catalog/reference/wrapper';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { allOfMembers } from '@/lib/catalog/acceptance/combinators';

const caster = referenceCaster({
  className: 'Test Caster',
  attributes: { baseMag: '20', baseMagicToHit: '50', adjMana: '0', lvlMana: '1', chrMana: '1' },
  animations: { castingFrames: '10', castingActionFrame: '6' },
});

describe('fireboltLaw', () => {
  it('reads every number from the rule text', () => {
    expect(fireboltLaw()).toEqual({
      magicDivisor: 8, constant: 1, spread: 9, resistedFraction: 0.25,
      toHit: { monsterLevelCoef: 2, min: 5, max: 95 }, ticksPerFrame: 1, regenerates: false,
    });
  });
});

describe('referenceCaster', () => {
  it('derives to-hit and the mana pool from the class tables', () => {
    expect(caster).toMatchObject({ magic: 20, magicToHit: 70, castingFrames: 10, castingActionFrame: 6, maxMana: 21 });
  });
  it('refuses a missing number rather than defaulting it', () => {
    expect(() => referenceCaster({ className: 'X', attributes: { baseMag: '20' }, animations: {} })).toThrow(/no numeric/);
  });
});

describe('fireboltAt', () => {
  const n = fireboltAt(caster, 1, 5);
  it('computes damage, cast timing (20 ticks/s), and casts per pool', () => {
    expect(n.damage).toEqual({ minimum: 4, maximum: 13, mean: 8.5 }); // 20/8 → 2, + 1 + 1
    expect(n.castTime).toBeCloseTo(0.5);
    expect(n.releaseTime).toBeCloseTo(0.3);
    expect(n.manaRegenPerSec).toBe(0);
    expect(n.castsPerPool).toBe(4); // 21 / 5
  });
  it('clamps to-hit', () => {
    expect(n.toHit(1, 0)).toBeCloseTo(0.68);
    expect(n.toHit(60, 0)).toBeCloseTo(0.05);
  });
  it('refuses a spell level the law does not state a cost for', () => {
    expect(() => fireboltAt(caster, 2, 5)).toThrow(/spell level 1/);
  });
});

describe('seedSpellSteps — Balance', () => {
  const spec = DIABLO1.tables.find((t) => t.catalogId === 'spellbook')!;
  const COLS = Object.keys(spec.map);
  const row = (r: Record<string, string>) =>
    wrapTable(DIABLO1, spec, [COLS.join('\t'), COLS.map((c) => r[c] ?? '').join('\t')].join('\n'), 't0').wrappers[0];
  const bolt = row({ id: 'Firebolt', name: 'Test Firebolt', manaCost: '5', flags: 'Fire,Targeted' });
  const other = row({ id: 'TestNova', name: 'Test Nova', manaCost: '5', flags: 'Lightning' });

  it('seeds Balance only for a spell with a law, and only with a named caster', () => {
    expect(seedSpellSteps(bolt).map((s) => s.step)).toEqual(['Effect Logic']);
    expect(seedSpellSteps(other, caster).map((s) => s.step)).toEqual(['Effect Logic']);
    expect(seedSpellSteps(bolt, caster).map((s) => s.step)).toEqual(['Effect Logic', 'Balance']);
  });

  it('fills Effect Logic\'s baseDamage from the law only when it can', () => {
    expect((seedSpellSteps(bolt, caster)[0].data.effect as Record<string, unknown>).baseDamage).toBe(8.5);
    expect(seedSpellSteps(bolt)[0].gaps.join(' ')).toMatch(/ENGINE CODE/);
  });

  it('writes a cast-limited hit rate the real Balance step reconciles', () => {
    const seed = seedSpellSteps(bolt, caster)[1];
    expect(seed.data.balance).toMatchObject({ baseDamage: 8.5, castTime: 0.5, limiter: 'castTime', hitDPS: 17, manaRegenPerSec: 0 });
    const step = getCatalogPipeline('spellbook')!.steps.find((s) => s.label === 'Balance')!;
    const results = allOfMembers(step.accept!)!.map((c) => c(seed.data));
    expect(results.find((r) => r.label.startsWith('hitDPS'))?.status).toBe('pass');
    expect(results.find((r) => r.label.startsWith('sustainedDPS'))?.status).toBe('pass');
  });
});
