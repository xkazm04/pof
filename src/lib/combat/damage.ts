import type { AttributeSet, CombatAbility, TuningOverrides } from '@/types/combat-simulator';

// ── Shared Damage Formula (UARPGDamageExecution) ────────────────────────────
// FinalDamage = (BaseDamage + AttackPower * Scaling) * DamageMul * CritMul * (1 - ArmorReduction)
// ArmorReduction = (Armor * ArmorEffectivenessWeight) / (Armor * ArmorEffectivenessWeight + 100)
//
// This is the single canonical implementation consumed by all combat engines
// (Monte-Carlo simulation-engine, predictive-balance sweep, choreography
// timeline). Previously each engine carried its own copy and they DRIFTED —
// see docs/harness/zen-perf-scan-2026-06-14/02-combat-damage-tuning.md #1.
//
// Canonical decisions (sim-engine was authoritative):
//  - DamageMul is applied per-hit here (NOT pre-baked into attackPower at
//    attribute-build time). It scales the WHOLE hit including baseDamage.
//  - Min-damage clamp is Math.max(1, …) so a connecting hit always lands ≥1.
//  - Result is rounded to a whole number (designer-facing integers).

export function calculateDamage(
  ability: CombatAbility,
  sourceAttrs: AttributeSet,
  targetAttrs: AttributeSet,
  tuning: TuningOverrides,
  rng: () => number,
  isPlayer: boolean,
): { damage: number; isCrit: boolean } {
  const baseDmg = ability.baseDamage + sourceAttrs.attackPower * ability.attackPowerScaling;
  const damageMul = isPlayer ? tuning.playerDamageMul : tuning.enemyDamageMul;

  // Crit check
  const isCrit = rng() < sourceAttrs.critChance;
  const critMul = isCrit ? sourceAttrs.critDamage * tuning.critMultiplierMul : 1.0;

  // Armor reduction (diminishing returns). targetAttrs.armor already includes the build-time
  // playerArmorMul (see buildPlayerAttributes), so re-applying a multiplier here squared the
  // player's mitigation, and feeding enemyDamageMul (a *damage* knob) into the enemy's armor
  // made raising enemy damage also raise enemy armor. Apply only the effectiveness weight.
  const effectiveArmor = targetAttrs.armor * tuning.armorEffectivenessWeight;
  const armorReduction = effectiveArmor / (effectiveArmor + 100);

  const finalDamage = Math.max(1, Math.round(baseDmg * damageMul * critMul * (1 - armorReduction)));
  return { damage: finalDamage, isCrit };
}
