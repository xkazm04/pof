import { describe, expect, it } from 'vitest';
import {
  aiConsistency,
  compareAiRates,
  syntheticDecisionRates,
} from '@/lib/catalog/reference/aiConsistency';
import { timingLaw } from '@/lib/catalog/reference/behaviourScale';

describe('AI cadence consistency', () => {
  it('agrees for a hand-computed synthetic attack routine', () => {
    const rates = syntheticDecisionRates([
      { probability: 0.25, durationTicks: 8, attacks: 1 },
      { probability: 0.75, durationTicks: 1 },
    ], 20);
    // One attack animation plus three expected failed Stand decisions: 8 + 3 = 11 ticks.
    expect(rates.decisionsPerSecond).toBeCloseTo(20 / 2.75, 12);
    expect(rates.attacksPerSecond).toBeCloseTo(20 / 11, 12);
    expect(compareAiRates(20 / 11, rates.attacksPerSecond)).toMatchObject({
      ratio: 1,
      verdict: 'agree',
    });
  });

  it('detects a planted synthetic disagreement', () => {
    const graph = syntheticDecisionRates([
      { probability: 0.25, durationTicks: 8, attacks: 1 },
      { probability: 0.75, durationTicks: 1 },
    ], 20);
    const comparison = compareAiRates(20 / 8, graph.attacksPerSecond);
    expect(comparison.verdict).toBe('disagree');
    expect(comparison.ratio).toBeCloseTo(8 / 11, 12);
  });

  it('follows forced post-delay graph decisions for SkeletonMelee', () => {
    const report = aiConsistency({
      walkFrames: 10,
      walkRate: 1,
      attackFrames: 8,
      attackRate: 1,
      actionFrame: 4,
      ai: 'SkeletonMelee',
      intelligence: 0,
    });
    expect(report.attack.verdict).toBe('agree');
    expect(report.approach.verdict).toBe('agree');
  });

  it('matches the AcidUnique special-shot delay gate', () => {
    const report = aiConsistency({
      walkFrames: 10,
      walkRate: 1,
      attackFrames: 8,
      attackRate: 1,
      specialAttackFrames: 12,
      specialAttackRate: 1,
      actionFrame: 4,
      ai: 'AcidUnique',
      intelligence: 0,
    });
    expect(report.attack.verdict).toBe('agree');
    expect(report.findings).toEqual([]);
  });

  it('matches the retreat-first adjacent cadence for both ranged routine shapes', () => {
    for (const ai of ['SkeletonRanged', 'GoatRanged'] as const) {
      const report = aiConsistency({
        walkFrames: 10,
        walkRate: 1,
        attackFrames: 8,
        attackRate: 1,
        actionFrame: 4,
        ai,
        intelligence: 1,
      });
      expect(report.attack.verdict, ai).toBe('agree');
    }
  });

  it('uses the canonical engine tick law in the hand calculation', () => {
    expect(timingLaw().ticksPerSecond).toBeGreaterThan(0);
  });
});
