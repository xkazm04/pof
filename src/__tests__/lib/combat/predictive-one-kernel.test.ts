import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  runPredictiveBalance,
  sweepCellSeed,
  DEFAULT_PREDICTIVE_CONFIG,
} from '@/lib/combat/predictive-balance';
import { runCombatSimulation } from '@/lib/combat/simulation-engine';
import { DEFAULT_TUNING, GEAR_LOADOUTS, PLAYER_ABILITIES } from '@/lib/combat/definitions';

// One fight kernel: the predictive sweep must resolve every cell through the
// combat engine's `runCombatSimulation`, not a private copy of the fight loop.
// (game-production/encounter-balance-simulation#one-kernel)

const SRC = readFileSync(
  path.resolve(__dirname, '../../../lib/combat/predictive-balance.ts'),
  'utf8',
);

describe('predictive sweep — one fight kernel', () => {
  const report = runPredictiveBalance(DEFAULT_PREDICTIVE_CONFIG);

  it('a sweep cell equals the engine on the same fight (Lv.10 vs 3x Forest Grunt)', () => {
    const cell = report.heatmap.find(
      (c) => c.playerLevel === 10 && c.enemyLabel === '3x Forest Grunt',
    );
    expect(cell).toBeDefined();

    const gear = GEAR_LOADOUTS.find((g) => g.id === 'mid-tier')!;
    const engine = runCombatSimulation(
      {
        name: 'parity',
        playerLevel: 10,
        playerGear: gear,
        playerAbilities: PLAYER_ABILITIES,
        enemies: [{ archetypeId: 'melee-grunt', count: 3, level: 10 }],
      },
      DEFAULT_TUNING,
      { iterations: 200, seed: sweepCellSeed('melee-grunt', 10), maxFightDurationSec: 120 },
    ).summary;

    expect(cell!.survivalRate).toBe(engine.survivalRate);
    expect(cell!.avgTTK).toBe(engine.avgFightDurationSec);
    expect(cell!.avgDPS).toBe(engine.avgDPS);
  });

  it('no zero-length fiction: every cell a player survives has a positive TTK and DPS', () => {
    const survived = report.heatmap.filter((c) => c.survivalRate > 0);
    expect(survived.length).toBeGreaterThan(0);
    for (const c of survived) {
      expect(c.avgTTK, `Lv.${c.playerLevel} vs ${c.enemyLabel} TTK`).toBeGreaterThan(0);
      expect(c.avgDPS, `Lv.${c.playerLevel} vs ${c.enemyLabel} DPS`).toBeGreaterThan(0);
    }
  });

  it('predictive-balance.ts owns no fight loop and no attribute-builder copies', () => {
    expect(SRC).not.toMatch(/while\s*\(\s*time\s*</);
    expect(SRC).not.toMatch(/function\s+simulateFight\b/);
    expect(SRC).not.toMatch(/function\s+buildPlayerAttrs\b/);
    expect(SRC).not.toMatch(/function\s+buildEnemyAttrs\b/);

    const engineImport = SRC.match(
      /import\s*\{([^}]*)\}\s*from\s*'@\/lib\/combat\/simulation-engine'/,
    );
    expect(engineImport).not.toBeNull();
    const names = engineImport![1];
    expect(names).toMatch(/\brunCombatSimulation\b/);
    expect(names).toMatch(/\bbuildPlayerAttributes\b/);
  });
});
