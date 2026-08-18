/**
 * GAS/ability damage model — an ADAPTER over the canon kernel.
 *
 * Until 2026-08-18 this module carried its own second damage model
 * (`armor/(armor+100)` mitigation, no crit-chance cap) while the arena/combat
 * sim had already been reconciled onto `@/lib/combat/canon-kernel`. Two
 * simulators answering the same balance question with two different models is
 * worse than one, so the GAS path now routes through the SAME kernel:
 *
 *   raw        = base · (1 + power/100)                      ← GAS power scaling
 *   crit       = kernel roll, chance hard-capped at 95%      ← CRIT_CHANCE_CAP
 *   mitigation = armour/(armour + 5·rawHit)  (Physical)      ← canon soft-cap
 *              = min(resist, 75%)            (Fire/Cold/…)   ← RESIST_CAP
 *
 * Consequence to be aware of: canon armour is soft-capped AGAINST THE HIT SIZE,
 * so there is no such thing as a mitigation percentage for an armour rating
 * alone — every mitigation/EHP figure needs a reference hit. That is why
 * `armorMitigation` and `effectiveHpVsHit` take one.
 *
 * `legacyArmorMitigation` preserves the retired curve for comparison ONLY. It
 * must never feed a displayed verdict.
 */

import {
  computeHit,
  armourReduction,
  armourEffectiveHpMultiplier,
  CRIT_CHANCE_CAP,
  RESIST_CAP,
  type DamageType,
  type Defense,
} from '@/lib/combat/canon-kernel';

export { CRIT_CHANCE_CAP, RESIST_CAP };

/** How a target mitigates one GAS hit. Physical → armour soft-cap; else → resist. */
export interface MitigationTarget {
  /** Armour rating (mitigates Physical only). */
  armor?: number;
  /** Canon damage type of the incoming hit (default `Physical`). */
  type?: DamageType;
  /** Target resist fraction 0–1 for non-Physical types; applied capped at 75%. */
  resist?: number;
}

/**
 * Map the ability-module damage-type vocabulary onto canon types.
 * The ability forge says `Ice`; the canon kernel says `Cold`. `None`/unknown
 * falls back to Physical (the untyped GAS default).
 */
export function canonDamageType(type: string | undefined): DamageType {
  switch (type) {
    case 'Fire': return 'Fire';
    case 'Ice':
    case 'Cold': return 'Cold';
    case 'Lightning': return 'Lightning';
    case 'Chaos': return 'Chaos';
    default: return 'Physical';
  }
}

/** Raw (pre-mitigation, pre-crit) hit: `base · (1 + power/100)`. */
export function rawScaledHit(base: number, power: number): number {
  return base * (1 + power / 100);
}

/**
 * Canon armour mitigation fraction ∈ [0,1) — `armour / (armour + 5·rawPhysHit)`.
 * Requires the raw hit: canon armour is soft-capped against hit size, so a bigger
 * hit is mitigated LESS by the same armour.
 */
export function armorMitigation(armor: number, rawPhysHit: number): number {
  return armourReduction(armor, rawPhysHit);
}

/**
 * RETIRED pre-canon curve `armor / (armor + 100)`, kept for before/after
 * comparison only. NOT canon — never render it or let it reach a verdict.
 */
export function legacyArmorMitigation(armor: number): number {
  return armor / (armor + 100);
}

function hitOnce(
  base: number,
  power: number,
  target: MitigationTarget,
  crit: { chance: number; multiplier: number } | undefined,
  ctx: { rng?: () => number; forceCrit?: boolean },
): { damage: number; isCrit: boolean } {
  const type: DamageType = target.type ?? 'Physical';
  const buckets: Partial<Record<DamageType, { base: number }>> = {};
  buckets[type] = { base: rawScaledHit(base, power) };

  const defense: Defense = {};
  if (type === 'Physical') {
    defense.armour = target.armor ?? 0;
  } else {
    const resists: Partial<Record<DamageType, number>> = {};
    resists[type] = target.resist ?? 0;
    defense.resists = resists;
  }

  const result = computeHit({ buckets, crit }, defense, ctx);
  return { damage: result.total, isCrit: result.isCrit };
}

/** Pre-crit damage: base scaled by power, then mitigated through the canon kernel. */
export function scaleAndMitigate(base: number, power: number, armor: number, target: MitigationTarget = {}): number {
  return hitOnce(base, power, { ...target, armor }, undefined, {}).damage;
}

/**
 * ROLL one GAS hit through the kernel (the Monte-Carlo path). Crit chance is a
 * fraction 0–1 and is hard-capped at 95% by the kernel. Exactly one `rng()` is
 * drawn (the crit roll) — no avoidance chances are set.
 */
export function rollAbilityHit(
  base: number,
  power: number,
  target: MitigationTarget,
  critChance: number,
  critMultiplier: number,
  rng: () => number,
): { damage: number; isCrit: boolean } {
  return hitOnce(base, power, target, { chance: critChance, multiplier: critMultiplier }, { rng });
}

/**
 * EXPECTED damage (deterministic preview — the Spellbook Logic damage card).
 * Crit is not a flat multiplier under canon: a crit is a BIGGER raw hit, and a
 * bigger physical hit is mitigated less, so the expectation is taken across the
 * two kernel outcomes rather than by scaling the mitigated average.
 * `critChancePct` is a percent (15 → 15%) and is capped at 95%.
 */
export function calculateDamage(
  base: number,
  power: number,
  armor: number,
  critChancePct: number,
  critMult: number,
  target: MitigationTarget = {},
): number {
  const t: MitigationTarget = { ...target, armor };
  const p = Math.min(Math.max(critChancePct / 100, 0), CRIT_CHANCE_CAP);
  const crit = { chance: 1, multiplier: critMult };
  const nonCrit = hitOnce(base, power, t, crit, { forceCrit: false }).damage;
  const onCrit = hitOnce(base, power, t, crit, { forceCrit: true }).damage;
  return nonCrit * (1 - p) + onCrit * p;
}

/**
 * Effective HP against a reference hit — `hp / (1 − armourReduction(armour, refHit))`.
 * EHP is derived, never stored (canon §8), and is meaningless without the hit it
 * is measured against.
 */
export function effectiveHpVsHit(maxHealth: number, armor: number, refHit: number): number {
  return maxHealth * armourEffectiveHpMultiplier(armor, refHit);
}

/** Short human-readable readout of how the base damage is applied. */
export function formulaPreview(ability: { damage: number }): string {
  return `${ability.damage} base · ×(1+power) · canon-mitigated (armour soft-cap) · crit-scaled (≤95%)`;
}
