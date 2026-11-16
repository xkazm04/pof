import { describe, it, expect } from 'vitest';
import { runCombatSimulation } from '@/lib/combat/simulation-engine';
import { COMBAT_TUNING_LEVERS } from '@/lib/combat/sweep-tuning';
import {
  DEFAULT_TUNING, DEFAULT_CONFIG, PLAYER_ABILITIES, GEAR_LOADOUTS,
} from '@/lib/combat/definitions';
import type { CombatScenario } from '@/types/combat-simulator';

// Every lever the sweep / goal-seek offers must move the simulation: a lever
// the engine never reads reports a flat sensitivity line and lets goal-seek
// "move" it to no effect (healingMul was exactly that).

const SCENARIO: CombatScenario = {
  name: 'lever sensitivity',
  playerLevel: 10,
  playerGear: GEAR_LOADOUTS[0],
  playerAbilities: PLAYER_ABILITIES,
  enemies: [{ archetypeId: 'melee-grunt', count: 3, level: 10 }],
};
const CONFIG = { ...DEFAULT_CONFIG, iterations: 200 };

function figures(lever: string, value: number): string {
  const r = runCombatSimulation(SCENARIO, { ...DEFAULT_TUNING, [lever]: value }, CONFIG);
  const s = r.summary;
  return JSON.stringify([s.avgPlayerHealthRemaining, s.avgEnemyDPS, s.avgDPS, s.survivalRate]);
}

describe('combat tuning levers are live', () => {
  it('offers at least the seven engine-read levers', () => {
    expect(COMBAT_TUNING_LEVERS.length).toBeGreaterThanOrEqual(7);
  });

  for (const l of COMBAT_TUNING_LEVERS) {
    it(`${l.lever}: low end and high end of its range change the summary`, () => {
      expect(figures(l.lever, l.range[0])).not.toBe(figures(l.lever, l.range[1]));
    });
  }
});
