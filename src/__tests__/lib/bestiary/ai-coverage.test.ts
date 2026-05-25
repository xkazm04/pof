import { describe, it, expect } from 'vitest';
import { lintAiCoverage } from '@/lib/bestiary/ai-coverage';

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
