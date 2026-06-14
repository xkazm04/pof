/**
 * GAS damage model, extracted verbatim from the legacy DamageCalcSection:
 *   scaled     = base · (1 + power/100)
 *   afterArmor = scaled · (1 - armor/(armor+100))
 *   expCrit    = 1 + (critChancePct/100)·(critMult-1)
 *   final      = afterArmor · expCrit
 * Pure — the Spellbook Logic damage card uses it to preview what the stored
 * `damage` means under attacker power / target armor / crit.
 *
 * The pre-crit core (`scaleAndMitigate`) and the armor term (`armorMitigation`)
 * are the canonical GAS-preview model, shared verbatim with the GAS balance
 * Monte-Carlo simulator (gas-balance/simulation.ts) so a balance change to the
 * power-scaling or armor curve lands in one place. Crit handling intentionally
 * stays per-caller: this module uses EXPECTED crit (deterministic preview)
 * while the simulator ROLLS crit per hit — same core, different crit semantics.
 */

/** Diminishing-returns armor mitigation fraction: `armor / (armor + 100)` ∈ [0,1). */
export function armorMitigation(armor: number): number {
  return armor / (armor + 100);
}

/** Pre-crit damage: base scaled by power, then reduced by target armor. */
export function scaleAndMitigate(base: number, power: number, armor: number): number {
  const scaled = base * (1 + power / 100);
  return scaled * (1 - armorMitigation(armor));
}

export function calculateDamage(base: number, power: number, armor: number, critChancePct: number, critMult: number): number {
  const afterArmor = scaleAndMitigate(base, power, armor);
  const expectedCritMulti = 1 + (critChancePct / 100) * (critMult - 1);
  return afterArmor * expectedCritMulti;
}

/** Short human-readable readout of how the base damage is applied. */
export function formulaPreview(ability: { damage: number }): string {
  return `${ability.damage} base · ×(1+power) · armor-mitigated · crit-scaled`;
}
