import { describe, it, expect } from 'vitest';
import {
  runPredictiveBalance,
  DEFAULT_PREDICTIVE_CONFIG,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';

// The per-ability DPS list is a static rate off the mid-level player (no
// archetype, no fight), so the report carries it ONCE, keyed by the player level
// it was computed at - never once per encounter under identical arrays.

const config: PredictiveBalanceConfig = {
  ...DEFAULT_PREDICTIVE_CONFIG,
  iterations: 5,
  levelRange: [1, 7],
  enemyConfigs: [
    { archetypeId: 'melee-grunt', count: 3, levelOffset: 0 },
    { archetypeId: 'brute', count: 1, levelOffset: 0 },
  ],
};

describe('BalanceReport.dpsBreakdowns', () => {
  it('holds one breakdown keyed by the mid-level player, not one per encounter', () => {
    const report = runPredictiveBalance(config);
    expect(report.encounters.length).toBe(2);
    const keys = Object.keys(report.dpsBreakdowns);
    expect(keys).toEqual([`Lv.${report.midLevel} player`]);
    expect(report.dpsBreakdowns[keys[0]].length).toBeGreaterThan(0);
  });
});
