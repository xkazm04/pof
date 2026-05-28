import { describe, it, expect } from 'vitest';
import {
  runCombatSimulation,
  computeThreatBreakdown,
} from '@/lib/combat/simulation-engine';
import {
  DEFAULT_TUNING,
  DEFAULT_CONFIG,
  ENEMY_ARCHETYPES,
  GEAR_LOADOUTS,
  PLAYER_ABILITIES,
} from '@/lib/combat/definitions';
import type {
  CombatScenario,
  FightResult,
} from '@/types/combat-simulator';

function makeScenario(): CombatScenario {
  const gear = GEAR_LOADOUTS.find((g) => g.id === 'starter')!;
  return {
    name: 'recap-test',
    playerLevel: 5,
    playerGear: gear,
    // Pick a basic ability set that won't trivially win every fight
    playerAbilities: PLAYER_ABILITIES.filter((a) =>
      ['ga-melee-attack', 'ga-fireball', 'ga-dodge'].includes(a.id),
    ),
    // 2 Stone Brutes vs a level-5 player → reliable deaths so the recap has data
    enemies: [{ archetypeId: 'brute', count: 2, level: 8 }],
  };
}

describe('threat breakdown — death recap', () => {
  it('records killer enemy and ability for every player death', () => {
    const scenario = makeScenario();
    const result = runCombatSimulation(scenario, DEFAULT_TUNING, {
      ...DEFAULT_CONFIG,
      iterations: 200,
      seed: 7,
    });

    const deaths = result.fights.filter((f) => !f.won);
    expect(deaths.length).toBeGreaterThan(0);
    for (const death of deaths) {
      expect(death.killedBy).toBeTruthy();
      expect(death.killedByAbility).toBeTruthy();
      expect(death.killedByAbilityId).toBeTruthy();
      // Killer should be an archetype name, not an instanced "#N" name
      expect(death.killedBy).not.toMatch(/#\d+$/);
    }
  });

  it('records per-source damage in every fight', () => {
    const scenario = makeScenario();
    const result = runCombatSimulation(scenario, DEFAULT_TUNING, {
      ...DEFAULT_CONFIG,
      iterations: 100,
      seed: 11,
    });

    for (const fight of result.fights) {
      // Sum of per-source damage equals totalDamageTaken (unless fight ended instantly).
      const sum = fight.damageBySource.reduce((s, d) => s + d.damage, 0);
      expect(sum).toBe(fight.totalDamageTaken);
    }
  });

  it('aggregates kill share and damage share across the run', () => {
    const scenario = makeScenario();
    const result = runCombatSimulation(scenario, DEFAULT_TUNING, {
      ...DEFAULT_CONFIG,
      iterations: 300,
      seed: 42,
    });
    const breakdown = result.summary.threatBreakdown;

    // Total deaths should equal the per-source kill-count sum (each death
    // attributed to exactly one source).
    const totalKills = breakdown.bySource.reduce((s, e) => s + e.killCount, 0);
    expect(totalKills).toBe(breakdown.totalDeaths);

    // Damage shares should sum to ~1 (rounded to 2 decimals → tolerance ±0.05)
    const damageShareSum = breakdown.bySource.reduce((s, e) => s + e.damageShare, 0);
    expect(damageShareSum).toBeGreaterThan(0.9);
    expect(damageShareSum).toBeLessThanOrEqual(1.05);

    // Stone Brute is the only enemy archetype in the scenario — must be #1 by-enemy
    expect(breakdown.byEnemy[0].enemy).toBe('Stone Brute');
    expect(breakdown.byEnemy[0].damageShare).toBeGreaterThan(0.9);

    // Top source should carry a non-empty nerf suggestion
    const top = breakdown.bySource[0];
    expect(top.nerfSuggestion).toBeTruthy();
    expect(top.nerfSuggestion.length).toBeGreaterThan(0);
  });

  it('flags the Charge Attack as a one-shot risk when it lands the killing blow', () => {
    // Construct a synthetic fight set where Charge Attack accounts for every death.
    const fights: FightResult[] = [
      {
        won: false,
        durationSec: 4,
        playerHealthRemaining: 0,
        playerManaRemaining: 0,
        totalDamageDealt: 80,
        totalDamageTaken: 120,
        abilitiesUsed: {},
        critCount: 0,
        totalHits: 6,
        enemiesKilled: 0,
        killedBy: 'Stone Brute',
        killedByAbility: 'Charge Attack',
        killedByAbilityId: 'ga-enemy-charge',
        damageBySource: [
          { enemy: 'Stone Brute', ability: 'Heavy Swing', abilityId: 'ga-enemy-brute-swing', damage: 40 },
          { enemy: 'Stone Brute', ability: 'Charge Attack', abilityId: 'ga-enemy-charge', damage: 80 },
        ],
        oneShot: false,
      },
      {
        won: false,
        durationSec: 3,
        playerHealthRemaining: 0,
        playerManaRemaining: 0,
        totalDamageDealt: 60,
        totalDamageTaken: 110,
        abilitiesUsed: {},
        critCount: 0,
        totalHits: 5,
        enemiesKilled: 0,
        killedBy: 'Stone Brute',
        killedByAbility: 'Charge Attack',
        killedByAbilityId: 'ga-enemy-charge',
        damageBySource: [
          { enemy: 'Stone Brute', ability: 'Heavy Swing', abilityId: 'ga-enemy-brute-swing', damage: 30 },
          { enemy: 'Stone Brute', ability: 'Charge Attack', abilityId: 'ga-enemy-charge', damage: 80 },
        ],
        oneShot: false,
      },
    ];

    const brute = ENEMY_ARCHETYPES.find((a) => a.id === 'brute')!;
    expect(brute).toBeTruthy();
    const scenario: CombatScenario = {
      name: 'synthetic',
      playerLevel: 5,
      playerGear: GEAR_LOADOUTS[0],
      playerAbilities: [],
      enemies: [{ archetypeId: 'brute', count: 1, level: 5 }],
    };

    const breakdown = computeThreatBreakdown(fights, scenario);

    expect(breakdown.totalDeaths).toBe(2);
    expect(breakdown.byEnemy[0].enemy).toBe('Stone Brute');
    expect(breakdown.byEnemy[0].killShare).toBe(1);

    // The Charge Attack source is the headline threat — must include a concrete nerf hint
    const charge = breakdown.bySource.find((s) => s.abilityId === 'ga-enemy-charge');
    expect(charge).toBeTruthy();
    expect(charge!.killShare).toBe(1);
    expect(charge!.nerfSuggestion.toLowerCase()).toContain('killer');
    // Suggestion should reference concrete tuning levers
    expect(charge!.nerfSuggestion.toLowerCase()).toMatch(/cooldown|basedamage|telegraph|hit window/);
  });

  it('returns an empty breakdown when there are no fights with damage', () => {
    const fights: FightResult[] = [
      {
        won: true,
        durationSec: 1,
        playerHealthRemaining: 100,
        playerManaRemaining: 50,
        totalDamageDealt: 100,
        totalDamageTaken: 0,
        abilitiesUsed: {},
        critCount: 0,
        totalHits: 0,
        enemiesKilled: 1,
        damageBySource: [],
        oneShot: false,
      },
    ];
    const scenario: CombatScenario = {
      name: 'no-damage',
      playerLevel: 1,
      playerGear: GEAR_LOADOUTS[0],
      playerAbilities: [],
      enemies: [],
    };
    const breakdown = computeThreatBreakdown(fights, scenario);
    expect(breakdown.totalDeaths).toBe(0);
    expect(breakdown.totalDamageTaken).toBe(0);
    expect(breakdown.bySource).toEqual([]);
    expect(breakdown.byEnemy).toEqual([]);
  });
});
