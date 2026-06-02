import type { CharacterGenome } from '@/types/character-genome';
import type { PowerCurveStat, PowerCurveCrossover } from './types';
import { ARMOR_REDUCTION_FACTOR, STANDARD_ENEMY_HP, ASSUMED_ENEMY_DPS } from './field-data';

/* ── Level-scaled stat helper ──────────────────────────────────────────── */

export function getScaledStat(g: CharacterGenome, stat: PowerCurveStat, level: number): number {
  const l = level - 1;
  switch (stat) {
    case 'hp': return g.attributes.baseHP + g.attributes.hpPerLevel * l;
    case 'armor': return g.attributes.baseArmor + g.attributes.armorPerLevel * l;
    case 'stamina': return g.attributes.baseStamina + g.attributes.staminaPerLevel * l;
    case 'mana': return g.attributes.baseMana + g.attributes.manaPerLevel * l;
    case 'power': {
      const hp = g.attributes.baseHP + g.attributes.hpPerLevel * l;
      const armor = (g.attributes.baseArmor + g.attributes.armorPerLevel * l) * ARMOR_REDUCTION_FACTOR;
      const stamina = g.attributes.baseStamina + g.attributes.staminaPerLevel * l;
      const mana = g.attributes.baseMana + g.attributes.manaPerLevel * l;
      return hp + armor + stamina + mana;
    }
  }
}

/**
 * Cached per-genome stat curve (one value per level, 1..100). Keyed on the
 * genome OBJECT identity: the genome store replaces only the edited genome's
 * object on each keystroke (the rest keep their reference), so unchanged
 * genomes hit this cache and are never recomputed — the 100-point curve is
 * rebuilt only for the genome actually being edited.
 */
const statCurveCache = new WeakMap<CharacterGenome, Partial<Record<PowerCurveStat, number[]>>>();

export function getStatCurve(g: CharacterGenome, stat: PowerCurveStat): number[] {
  let byStat = statCurveCache.get(g);
  if (!byStat) {
    byStat = {};
    statCurveCache.set(g, byStat);
  }
  const cached = byStat[stat];
  if (cached) return cached;
  const values = new Array<number>(100);
  for (let l = 1; l <= 100; l++) values[l - 1] = getScaledStat(g, stat, l);
  byStat[stat] = values;
  return values;
}

/* ── Power curve crossover detection ───────────────────────────────────── */

export function findPowerCurveCrossovers(
  genomes: CharacterGenome[],
  stat: PowerCurveStat,
): PowerCurveCrossover[] {
  const results: PowerCurveCrossover[] = [];
  for (let i = 0; i < genomes.length; i++) {
    for (let j = i + 1; j < genomes.length; j++) {
      const a = genomes[i], b = genomes[j];
      const v1a = getScaledStat(a, stat, 1), v100a = getScaledStat(a, stat, 100);
      const v1b = getScaledStat(b, stat, 1), v100b = getScaledStat(b, stat, 100);
      const rateA = (v100a - v1a) / 99, rateB = (v100b - v1b) / 99;
      if (rateA === rateB) continue;
      const crossL = (v1a - v1b) / (rateB - rateA) + 1;
      if (crossL >= 1 && crossL <= 100) {
        results.push({
          level: crossL,
          value: getScaledStat(a, stat, crossL),
          nameA: a.name, nameB: b.name,
          colorA: a.color, colorB: b.color,
        });
      }
    }
  }
  return results;
}

/* ── Full simulation metrics ───────────────────────────────────────────── */

export function computeSimMetrics(g: CharacterGenome, level: number) {
  const hp = g.attributes.baseHP + g.attributes.hpPerLevel * (level - 1);
  const stamina = g.attributes.baseStamina + g.attributes.staminaPerLevel * (level - 1);
  const mana = g.attributes.baseMana + g.attributes.manaPerLevel * (level - 1);
  const armor = g.attributes.baseArmor + g.attributes.armorPerLevel * (level - 1);
  const armorMitigation = armor * ARMOR_REDUCTION_FACTOR;
  const ehp = hp + armorMitigation;

  const rawDps = g.combat.baseDamage * g.combat.attackSpeed;
  const critFactor = 1 + g.combat.critChance * (g.combat.critMultiplier - 1);
  const effectiveDps = rawDps * critFactor;
  const critContribution = rawDps * (critFactor - 1);
  const ttk = effectiveDps > 0 ? STANDARD_ENEMY_HP / effectiveDps : Infinity;
  const burst3s = effectiveDps * 3;
  const cleaveArea = Math.PI * g.combat.attackRange ** 2 * (g.combat.cleaveAngle / 360);

  const dodgeCycle = g.dodge.cooldown + g.dodge.duration;
  const iframeUptime = dodgeCycle > 0 ? (g.dodge.iFrameDuration / dodgeCycle) * 100 : 0;
  const dodgesPerMin = dodgeCycle > 0 ? 60 / dodgeCycle : 0;

  const staminaBudget = g.dodge.staminaCost > 0 ? Math.floor(stamina / g.dodge.staminaCost) : 99;
  const dodgeCostPerSec = dodgeCycle > 0 && g.dodge.staminaCost > 0 ? g.dodge.staminaCost / dodgeCycle : 0;
  const staminaNetPerSec = g.attributes.staminaRegenPerSec - dodgeCostPerSec;
  const sustainedDodgesPerMin = g.dodge.staminaCost > 0 && dodgeCycle > 0
    ? (staminaNetPerSec >= 0 ? dodgesPerMin : Math.max(0, (g.attributes.staminaRegenPerSec / g.dodge.staminaCost) * 60))
    : dodgesPerMin;
  const fullRecovery = g.attributes.staminaRegenPerSec > 0 ? stamina / g.attributes.staminaRegenPerSec : Infinity;

  const survivalTime = ASSUMED_ENEMY_DPS > 0 ? ehp / ASSUMED_ENEMY_DPS : Infinity;
  const dodgeVelocity = g.dodge.duration > 0 ? g.dodge.distance / g.dodge.duration : 0;
  const sprintRatio = g.movement.maxWalkSpeed > 0 ? g.movement.maxSprintSpeed / g.movement.maxWalkSpeed : 0;
  const gravity = 980 * g.movement.gravityScale;
  const jumpHeight = gravity > 0 ? (g.movement.jumpZVelocity ** 2) / (2 * gravity) : 0;
  const manaPool = g.attributes.manaRegenPerSec > 0 && mana > 0 ? mana / g.attributes.manaRegenPerSec : Infinity;

  return {
    level, hp, stamina, mana, armor, armorMitigation, ehp,
    rawDps, effectiveDps, critContribution, critFactor, ttk, burst3s, cleaveArea,
    iframeUptime, dodgeCycle, dodgesPerMin,
    staminaBudget, sustainedDodgesPerMin, staminaNetPerSec, fullRecovery, dodgeCostPerSec,
    survivalTime, dodgeVelocity, sprintRatio, jumpHeight, manaPool,
  };
}
