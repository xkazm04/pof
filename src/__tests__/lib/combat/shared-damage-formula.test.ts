import { describe, it, expect } from 'vitest';
import type { AttributeSet, CombatAbility, TuningOverrides } from '@/types/combat-simulator';
import { DEFAULT_TUNING } from '@/lib/combat/definitions';

// Entry points used by the three combat engines. All must resolve to ONE shared
// canonical formula (see docs/harness/zen-perf-scan-2026-06-14/02-combat-damage-tuning.md #1).
import { calculateDamage as damageFromShared } from '@/lib/combat/damage';
import { calculateDamage as damageFromSimEngine } from '@/lib/combat/simulation-engine';

// choreography-sim and predictive-balance both `import { calculateDamage }` —
// choreography from './simulation-engine' (which re-exports ./damage) and
// predictive from '@/lib/combat/damage'. Referential identity proves there is no
// drift possible: every engine runs literally the same function.

function attrs(over: Partial<AttributeSet> = {}): AttributeSet {
  return {
    health: 100, maxHealth: 100, mana: 50, maxMana: 50,
    strength: 10, dexterity: 10, intelligence: 10,
    armor: 0, attackPower: 100, critChance: 0, critDamage: 1.5,
    ...over,
  };
}

function ability(over: Partial<CombatAbility> = {}): CombatAbility {
  return {
    id: 'test', name: 'Test', type: 'melee',
    baseDamage: 50, attackPowerScaling: 0.5, manaCost: 0,
    cooldownSec: 0, castTimeSec: 0, range: 0, aoeRadius: 0,
    ...over,
  };
}

const tuning: TuningOverrides = DEFAULT_TUNING;
const fixedRng = (v: number) => () => v; // deterministic crit roll

describe('shared canonical damage formula', () => {
  it('all engine entry points reference the same function (no copies to drift)', () => {
    expect(damageFromSimEngine).toBe(damageFromShared);
  });

  // Representative inputs covering single-target, AoE, crit, no-crit, the
  // min-damage clamp boundary, and tuning multipliers. For each, the three call
  // sites are guaranteed identical because they share one function — we assert
  // every entry point yields the SAME result and pin the expected number.
  const cases: { name: string; ab: CombatAbility; src: AttributeSet; tgt: AttributeSet; rng: number; isPlayer: boolean; expectDmg: number; expectCrit: boolean }[] = [
    {
      name: 'single-target basic hit (no crit, no armor)',
      // base 50 + 100*0.5 = 100 ; *1 *1 *1 = 100
      ab: ability(), src: attrs({ critChance: 0 }), tgt: attrs({ armor: 0 }),
      rng: 0.99, isPlayer: true, expectDmg: 100, expectCrit: false,
    },
    {
      name: 'AoE ability (aoeRadius>0) hits same formula as single-target',
      ab: ability({ type: 'aoe', aoeRadius: 5 }), src: attrs({ critChance: 0 }), tgt: attrs({ armor: 0 }),
      rng: 0.99, isPlayer: true, expectDmg: 100, expectCrit: false,
    },
    {
      name: 'forced crit (critChance 1, rng below threshold)',
      // 100 * critDamage 1.5 * critMultiplierMul 1 = 150
      ab: ability(), src: attrs({ critChance: 1, critDamage: 1.5 }), tgt: attrs({ armor: 0 }),
      rng: 0.0, isPlayer: true, expectDmg: 150, expectCrit: true,
    },
    {
      name: 'armor mitigation (armor 100 → 50% reduction)',
      // 100 * (1 - 100/200) = 50
      ab: ability(), src: attrs({ critChance: 0 }), tgt: attrs({ armor: 100 }),
      rng: 0.99, isPlayer: true, expectDmg: 50, expectCrit: false,
    },
    {
      name: 'min-damage clamp boundary (tiny base, huge armor → floored to 1)',
      // base 1 + 0 = 1 ; armor 100000 → reduction ~0.999 → ~0.001 → Math.max(1, round) = 1
      ab: ability({ baseDamage: 1, attackPowerScaling: 0 }), src: attrs({ critChance: 0, attackPower: 0 }), tgt: attrs({ armor: 100000 }),
      rng: 0.99, isPlayer: true, expectDmg: 1, expectCrit: false,
    },
    {
      name: 'player damageMul applied per-hit to whole hit incl. baseDamage',
      // playerDamageMul 2 → 100 * 2 = 200 (proves mul scales base+ap, not pre-baked into AP only)
      ab: ability(), src: attrs({ critChance: 0 }), tgt: attrs({ armor: 0 }),
      rng: 0.99, isPlayer: true, expectDmg: 200, expectCrit: false,
    },
    {
      name: 'enemy damageMul applied per-hit (isPlayer=false uses enemyDamageMul)',
      ab: ability(), src: attrs({ critChance: 0 }), tgt: attrs({ armor: 0 }),
      rng: 0.99, isPlayer: false, expectDmg: 50, expectCrit: false, // enemyDamageMul 0.5 → 100*0.5
    },
  ];

  for (const c of cases) {
    it(`${c.name} — identical across all engine entry points`, () => {
      const perCaseTuning: TuningOverrides =
        c.name.includes('player damageMul') ? { ...tuning, playerDamageMul: 2 }
        : c.name.includes('enemy damageMul') ? { ...tuning, enemyDamageMul: 0.5 }
        : tuning;

      const shared = damageFromShared(c.ab, c.src, c.tgt, perCaseTuning, fixedRng(c.rng), c.isPlayer);
      const sim = damageFromSimEngine(c.ab, c.src, c.tgt, perCaseTuning, fixedRng(c.rng), c.isPlayer);

      // The three engines now share one function — assert both observable
      // entry points agree and match the pinned canonical value.
      expect(shared).toEqual(sim);
      expect(shared.damage).toBe(c.expectDmg);
      expect(shared.isCrit).toBe(c.expectCrit);
    });
  }
});
