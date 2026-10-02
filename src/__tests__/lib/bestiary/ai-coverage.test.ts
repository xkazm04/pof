import { describe, it, expect } from 'vitest';
import { lintAiCoverage } from '@/lib/bestiary/ai-coverage';
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

describe('lintAiCoverage', () => {
  it('reports all core behaviors covered when btSummary has them', () => {
    const findings = lintAiCoverage({
      aggro: 'chase within 800uu',
      attack: 'melee combo',
      patrol: 'waypoint loop',
      retreat: 'flee below 20% hp',
    });
    expect(findings.every((f) => f.covered)).toBe(true);
    expect(findings).toHaveLength(4);
  });

  it('flags missing core behaviors', () => {
    const findings = lintAiCoverage({ aggro: 'chase' });
    const attack = findings.find((f) => f.behavior === 'attack');
    expect(attack?.covered).toBe(false);
  });

  it('treats empty string values as not covered', () => {
    const findings = lintAiCoverage({ aggro: '', attack: 'swing' });
    expect(findings.find((f) => f.behavior === 'aggro')?.covered).toBe(false);
    expect(findings.find((f) => f.behavior === 'attack')?.covered).toBe(true);
  });

  it('matches behaviors by keyword (aggression → aggro)', () => {
    const findings = lintAiCoverage({ aggression: 'charge', 'melee attack': 'swing' });
    expect(findings.find((f) => f.behavior === 'aggro')?.covered).toBe(true);
    expect(findings.find((f) => f.behavior === 'attack')?.covered).toBe(true);
  });

  it('handles an empty btSummary — all not covered', () => {
    const findings = lintAiCoverage({});
    expect(findings.every((f) => !f.covered)).toBe(true);
  });
});

describe('lintAiCoverage counts a declared Sense as detection', () => {
  it('a Sense line covers aggro, with the declared sense as its detail', () => {
    const findings = lintAiCoverage({ Sense: 'Proximity 8m', Attack: 'Swarm target' });
    expect(findings.find((f) => f.behavior === 'aggro')).toMatchObject({ covered: true, detail: 'Proximity 8m' });
    expect(findings.find((f) => f.behavior === 'attack')?.covered).toBe(true);
  });

  it('over ARCHETYPES the false aggro gap is gone, the real patrol / retreat gaps stay reported', () => {
    const missing = (b: string) => ARCHETYPES.filter((a) =>
      !lintAiCoverage(a.btSummary).find((f) => f.behavior === b)!.covered).length;
    expect(missing('aggro')).toBe(0);
    expect(missing('patrol')).toBe(89);
    expect(missing('retreat')).toBe(89);
  });
});
