import { describe, it, expect } from 'vitest';
import { lintArchetypeBalance, type ArchetypeLintInput } from '@/lib/balance/bestiary-guardrails';

function arch(id: string, tier: string, hp: number, dmg: number, abilities: string[] = ['Hit']): ArchetypeLintInput {
  return {
    id, tier,
    stats: [{ label: 'Health', value: hp }, { label: 'Damage', value: dmg }],
    abilities,
  };
}

describe('lintArchetypeBalance', () => {
  it('errors when the archetype has no abilities', () => {
    const e = arch('brute', 'major', 200, 25, []);
    const findings = lintArchetypeBalance(e, [e]);
    expect(findings.some((f) => f.severity === 'error' && f.rule === 'has-abilities')).toBe(true);
  });

  it('errors when the archetype has no stats', () => {
    const e: ArchetypeLintInput = { id: 'brute', tier: 'major', stats: [], abilities: ['Hit'] };
    const findings = lintArchetypeBalance(e, [e]);
    expect(findings.some((f) => f.severity === 'error' && f.rule === 'has-core-stats')).toBe(true);
  });

  it('warns when health is far above same-tier peers', () => {
    const target = arch('giant', 'major', 2000, 25);
    const roster = [target, arch('a', 'major', 200, 25), arch('b', 'major', 220, 25)];
    const findings = lintArchetypeBalance(target, roster);
    expect(findings.some((f) => f.severity === 'warn' && f.rule === 'tier-health-band')).toBe(true);
  });

  it('warns when damage is far below same-tier peers', () => {
    const target = arch('wimp', 'major', 200, 2);
    const roster = [target, arch('a', 'major', 200, 40), arch('b', 'major', 210, 44)];
    const findings = lintArchetypeBalance(target, roster);
    expect(findings.some((f) => f.severity === 'warn' && f.rule === 'tier-damage-band')).toBe(true);
  });

  it('returns a single ok finding when balanced against enough peers', () => {
    const target = arch('brute', 'major', 200, 25);
    const roster = [target, arch('a', 'major', 210, 26), arch('b', 'major', 190, 24)];
    const findings = lintArchetypeBalance(target, roster);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('ok');
  });

  it('skips tier-band checks when there are too few same-tier peers', () => {
    const target = arch('solo', 'legendary', 5000, 200);
    const roster = [target]; // only itself in its tier
    const findings = lintArchetypeBalance(target, roster);
    // No band warnings; presence checks pass → single ok finding.
    expect(findings.some((f) => f.rule.startsWith('tier-'))).toBe(false);
    expect(findings[0].severity).toBe('ok');
  });
});
