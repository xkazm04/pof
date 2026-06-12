import { describe, it, expect } from 'vitest';
import { runCombatSimulation } from '@/lib/combat/simulation-engine';
import { PLAYER_ABILITIES, DEFAULT_TUNING } from '@/lib/combat/definitions';
import type { CombatScenario, CombatSimConfig } from '@/types/combat-simulator';

const fireball = PLAYER_ABILITIES.find((a) => a.id === 'ga-fireball')!;

// A caster-only loadout: no free, short-cooldown basic attack. The old
// fallback (`abilities[0]`) fired the strongest ability every beat regardless
// of mana/cooldown, driving mana negative and inflating DPS forever.
const casterScenario: CombatScenario = {
  name: 'caster-only',
  playerLevel: 5,
  playerGear: { id: 'none', name: 'None', bonuses: {} },
  playerAbilities: [fireball],
  enemies: [{ archetypeId: 'brute', count: 1, level: 10 }], // tanky → fight lasts long enough to exhaust mana
};

const config: CombatSimConfig = { iterations: 50, seed: 7, maxFightDurationSec: 60 };

describe('choosePlayerAbility gate enforcement (caster-only loadout)', () => {
  it('never drives player mana negative', () => {
    const result = runCombatSimulation(casterScenario, DEFAULT_TUNING, config);
    for (const fight of result.fights) {
      expect(fight.playerManaRemaining).toBeGreaterThanOrEqual(0);
    }
  });

  it('caps Fireball casts by the mana/cooldown budget rather than firing every beat', () => {
    const result = runCombatSimulation(casterScenario, DEFAULT_TUNING, config);
    for (const fight of result.fights) {
      const casts = fight.abilitiesUsed['ga-fireball'] ?? 0;
      // A 60s fight at the ~0.9s old cadence would be ~65 casts; gated by a
      // 2s+ cooldown and 15-mana cost against ~2 mana/s regen it must be far
      // fewer. Generous bound that still fails the unbounded old behavior.
      expect(casts).toBeLessThan(40);
    }
  });
});

describe('all-unknown-enemy scenario is not a silent win', () => {
  it('reports a loss (not 100% survival) when every archetype id is unknown', () => {
    const stale: CombatScenario = {
      ...casterScenario,
      playerAbilities: PLAYER_ABILITIES,
      enemies: [{ archetypeId: 'renamed-since', count: 3, level: 5 }],
    };
    const result = runCombatSimulation(stale, DEFAULT_TUNING, { iterations: 5, seed: 1, maxFightDurationSec: 30 });
    // Zero enemies were built; `[].every()` would otherwise report a win.
    expect(result.fights.every((f) => f.won === false)).toBe(true);
  });
});
