/**
 * GAS damage model, extracted verbatim from the legacy DamageCalcSection:
 *   scaled     = base · (1 + power/100)
 *   afterArmor = scaled · (1 - armor/(armor+100))
 *   expCrit    = 1 + (critChancePct/100)·(critMult-1)
 *   final      = afterArmor · expCrit
 * Pure — the Spellbook Logic damage card uses it to preview what the stored
 * `damage` means under attacker power / target armor / crit.
 */
export function calculateDamage(base: number, power: number, armor: number, critChancePct: number, critMult: number): number {
  const scaled = base * (1 + power / 100);
  const afterArmor = scaled * (1 - armor / (armor + 100));
  const expectedCritMulti = 1 + (critChancePct / 100) * (critMult - 1);
  return afterArmor * expectedCritMulti;
}

/** Short human-readable readout of how the base damage is applied. */
export function formulaPreview(ability: { damage: number }): string {
  return `${ability.damage} base · ×(1+power) · armor-mitigated · crit-scaled`;
}
