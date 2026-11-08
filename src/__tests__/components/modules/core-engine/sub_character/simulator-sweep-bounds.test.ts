import { describe, it, expect } from 'vitest';
import {
  boundSweepConfig,
  SWEEP_LEVEL_BOUNDS,
  SWEEP_COUNT_BOUNDS,
  DEFAULT_PREDICTIVE_CONFIG,
  type PredictiveBalanceConfig,
} from '@/components/modules/core-engine/sub_character/simulator/predictive/data';

const withLevels = (lo: number, hi: number): PredictiveBalanceConfig => ({
  ...DEFAULT_PREDICTIVE_CONFIG,
  levelRange: [lo, hi],
});

/** Number of player levels the engine's `for (l = lo; l <= hi; l += step)` would sweep. */
const levelCount = (c: PredictiveBalanceConfig) =>
  Math.max(0, Math.floor((c.levelRange[1] - c.levelRange[0]) / c.levelStep) + 1);

describe('boundSweepConfig — typed inputs cannot launch a sweep outside the declared bounds', () => {
  it('declares the same bounds the inputs advertise', () => {
    expect(SWEEP_LEVEL_BOUNDS).toEqual([1, 50]);
    expect(SWEEP_COUNT_BOUNDS).toEqual([1, 10]);
  });

  it('clamps a typed upper level (1000) to the max, so the sweep stays at most 50 levels', () => {
    const bounded = boundSweepConfig(withLevels(1, 1000));
    expect(bounded.levelRange).toEqual([1, 50]);
    expect(levelCount({ ...bounded, levelStep: 1 })).toBeLessThanOrEqual(50);
  });

  it('clamps a zero / negative lower level to 1 (no level-0 player)', () => {
    expect(boundSweepConfig(withLevels(0, 10)).levelRange).toEqual([1, 10]);
    expect(boundSweepConfig(withLevels(-5, 10)).levelRange).toEqual([1, 10]);
  });

  it('orders an inverted range instead of sweeping zero levels', () => {
    const bounded = boundSweepConfig(withLevels(20, 10));
    expect(bounded.levelRange).toEqual([10, 20]);
    expect(levelCount(bounded)).toBeGreaterThan(0);
  });

  it('clamps enemy counts to 1..10 (no "0x" or "999x" encounter)', () => {
    const bounded = boundSweepConfig({
      ...DEFAULT_PREDICTIVE_CONFIG,
      enemyConfigs: [
        { archetypeId: 'melee-grunt', count: 0, levelOffset: 0 },
        { archetypeId: 'brute', count: 999, levelOffset: 0 },
        { archetypeId: 'elite-knight', count: Number.NaN, levelOffset: 0 },
      ],
    });
    expect(bounded.enemyConfigs.map(e => e.count)).toEqual([1, 10, 1]);
  });

  it('returns the same object when nothing is out of bounds', () => {
    expect(boundSweepConfig(DEFAULT_PREDICTIVE_CONFIG)).toBe(DEFAULT_PREDICTIVE_CONFIG);
  });
});
