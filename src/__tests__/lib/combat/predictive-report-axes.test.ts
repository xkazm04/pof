import { describe, it, expect } from 'vitest';
import {
  runPredictiveBalance,
  DEFAULT_PREDICTIVE_CONFIG,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';
import { DEFAULT_TUNING } from '@/lib/combat/definitions';

// The report carries its own axes (levels, encounters, a mid-level that IS on
// the level grid), so every surface renders from the report alone and the
// headline never averages zero cells.

describe('BalanceReport axes', () => {
  it('the default sweep reports its levels, encounters and a swept mid-level', () => {
    const report = runPredictiveBalance(DEFAULT_PREDICTIVE_CONFIG);

    expect(report.levels).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28]);
    expect(report.encounters).toEqual([
      { index: 0, label: '3x Forest Grunt', archetypeId: 'melee-grunt' },
      { index: 1, label: '1x Dark Mage', archetypeId: 'ranged-caster' },
      { index: 2, label: '1x Stone Brute', archetypeId: 'brute' },
      { index: 3, label: '1x Hollow Knight', archetypeId: 'elite-knight' },
    ]);
    expect(report.levels).toContain(report.midLevel);

    // Every cell names the encounter it belongs to.
    for (const cell of report.heatmap) {
      const enc = report.encounters[cell.encounterIndex];
      expect(enc.label).toBe(cell.enemyLabel);
    }

    // The headline averages the cells AT the swept mid-level (today: Lv.15, no cells, "0%").
    const midCells = report.heatmap.filter((c) => c.playerLevel === report.midLevel);
    expect(midCells).toHaveLength(4);
    expect(report.summary).not.toMatch(/ 0% avg mid-level survival, 0\.0s/);
    expect(report.summary).toContain(`mid-level Lv.${report.midLevel}`);
  });

  it('two encounters of the same archetype stay two encounters (distinct labels, cells, curves)', () => {
    const config: PredictiveBalanceConfig = {
      ...DEFAULT_PREDICTIVE_CONFIG,
      levelRange: [1, 10],
      iterations: 40,
      enemyConfigs: [
        { archetypeId: 'brute', count: 1, levelOffset: 0 },
        { archetypeId: 'brute', count: 1, levelOffset: 5 },
      ],
      sensitivityAttributes: [],
    };
    const report = runPredictiveBalance(config);

    expect(report.encounters).toHaveLength(2);
    const [a, b] = report.encounters;
    expect(a.label).not.toBe(b.label);
    expect(report.heatmap).toHaveLength(2 * report.levels.length);
    expect(report.heatmap.filter((c) => c.encounterIndex === 0)).toHaveLength(report.levels.length);
    expect(report.heatmap.filter((c) => c.encounterIndex === 1)).toHaveLength(report.levels.length);
    expect(Object.keys(report.survivalCurves)).toHaveLength(2);
  });

  it('[guard] the shipped config keeps DEFAULT_TUNING', () => {
    expect(DEFAULT_PREDICTIVE_CONFIG.tuning).toBe(DEFAULT_TUNING);
  });
});
