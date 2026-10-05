/**
 * The Attribute Sensitivity panel must sweep each attribute relative to the
 * scenario's own baseline, not an arbitrary absolute range (ai-registry
 * game-production/tornado-sensitivity-sweeps) — a fixed range moves different
 * attributes by different fractions of their baseline, so the resulting
 * curves cannot be compared for swing magnitude.
 */
import { describe, it, expect } from 'vitest';
import { sensitivityRangeFor, SENSITIVITY_SWEEP_RANGE } from '@/components/modules/core-engine/sub_ability/gas-balance/ResultsAnalysis';

describe('sensitivityRangeFor', () => {
  it('sweeps strength at ±50% of its own baseline, not a fixed 5-100', () => {
    const { min, max } = sensitivityRangeFor('strength', 30);
    expect(min).toBe(30 * (1 - SENSITIVITY_SWEEP_RANGE));
    expect(max).toBe(30 * (1 + SENSITIVITY_SWEEP_RANGE));
  });

  it('a different baseline strength produces a proportionally different range', () => {
    const low = sensitivityRangeFor('strength', 10);
    const high = sensitivityRangeFor('strength', 80);
    expect(high.max - high.min).toBeGreaterThan(low.max - low.min);
    // Swing is proportional to baseline: span/baseline is the same constant for both.
    expect((low.max - low.min) / 10).toBeCloseTo((high.max - high.min) / 80, 5);
  });

  it('never sweeps below 0 for a non-negative stat', () => {
    const { min } = sensitivityRangeFor('armor', 5);
    expect(min).toBeGreaterThanOrEqual(0);
  });

  it('clamps criticalChance to [0, 1] and uses a sensible span at a 0 baseline', () => {
    const atZero = sensitivityRangeFor('criticalChance', 0);
    expect(atZero.min).toBe(0);
    expect(atZero.max).toBeLessThanOrEqual(1);

    const nearCeiling = sensitivityRangeFor('criticalChance', 0.9);
    expect(nearCeiling.max).toBeLessThanOrEqual(1);
  });

  it('falls back to a fixed absolute span only when the baseline is non-positive', () => {
    const { min, max } = sensitivityRangeFor('attackPower', 0);
    expect(min).toBe(0);
    expect(max).toBe(10);
  });
});
