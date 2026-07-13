import type { AttributeSet, CombatAbility, TuningOverrides } from '@/types/combat-simulator';
import { computeHit } from '@/lib/combat/canon-kernel';

// ── Shared Damage Formula (adapter over the canon kernel) ───────────────────
// The single canonical entry point consumed by all combat engines (Monte-Carlo
// simulation-engine, predictive-balance sweep, choreography timeline). Every
// engine `import { calculateDamage }` — directly here or re-exported from
// simulation-engine — so there is one function and no drift is possible (see
// docs/harness/zen-perf-scan-2026-06-14/02-combat-damage-tuning.md #1).
//
// The combat simulator carries a SIMPLE, single-untyped-source attribute model
// (baseDamage + attackPower·scaling, one `armor` stat, critChance/critDamage).
// Rather than hand-roll a third divergent formula, this adapter maps that model
// into the typed canon kernel (`@/lib/combat/canon-kernel`) as a single Physical
// bucket and reads the result back:
//   - baseDamage + attackPower·scaling → the bucket's flat base.
//   - DamageMul (player/enemy) → a per-hit "more" multiplier scaling the WHOLE
//     hit (incl. base), matching prior canonical behavior (not pre-baked into AP).
//   - crit → the kernel's crit roll; the sim keeps its own critDamage×mul as the
//     multiplier (the kernel's ×2.5 canon default is used by native typed callers).
//   - armor → canon soft-cap mitigation `armour·weight / (armour·weight + 5·rawPhysHit)`
//     (armorEffectivenessWeight tunes the armour, then the canon curve applies).
// Exactly one rng() is drawn (the crit roll) — avoidance chances are unset — so
// the sim's seeded stream order is unchanged.
//
// Min-damage clamp is Math.max(1, …) so a connecting hit always lands ≥1, and the
// result is rounded to a whole number (designer-facing integers).

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

  const result = computeHit(
    {
      buckets: {
        Physical: { base: baseDmg, morePcts: [(damageMul - 1) * 100] },
      },
      crit: {
        chance: sourceAttrs.critChance,
        multiplier: sourceAttrs.critDamage * tuning.critMultiplierMul,
      },
    },
    {
      armour: targetAttrs.armor,
      armourWeight: tuning.armorEffectivenessWeight,
    },
    { rng },
  );

  return { damage: Math.max(1, Math.round(result.total)), isCrit: result.isCrit };
}
