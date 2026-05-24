import type { CharacterGenome } from '@/types/character-genome';
import type { FieldWarning } from './types';

/* ── Balance Constraint Validation ─────────────────────────────────────── */

export function validateGenome(g: CharacterGenome): FieldWarning[] {
  const warnings: FieldWarning[] = [];

  // Dodge constraints
  if (g.dodge.iFrameDuration > g.dodge.duration) {
    warnings.push({ fieldKey: 'dodge.iFrameDuration', severity: 'error', message: 'I-frame longer than dodge duration \u2014 permanently invulnerable during dodge' });
  }
  if (g.dodge.iFrameStart + g.dodge.iFrameDuration > g.dodge.duration) {
    warnings.push({ fieldKey: 'dodge.iFrameStart', severity: 'warning', message: 'I-frame window extends past dodge end' });
  }
  if (g.dodge.cancelWindowStart > g.dodge.duration) {
    warnings.push({ fieldKey: 'dodge.cancelWindowStart', severity: 'error', message: 'Cancel window starts after dodge ends \u2014 unreachable' });
  }
  if (g.dodge.cancelWindowEnd > g.dodge.duration) {
    warnings.push({ fieldKey: 'dodge.cancelWindowEnd', severity: 'warning', message: 'Cancel window extends past dodge end' });
  }
  if (g.dodge.cancelWindowStart > g.dodge.cancelWindowEnd) {
    warnings.push({ fieldKey: 'dodge.cancelWindowStart', severity: 'error', message: 'Cancel start > cancel end \u2014 empty window' });
  }
  if (g.dodge.staminaCost > g.attributes.baseStamina) {
    warnings.push({ fieldKey: 'dodge.staminaCost', severity: 'error', message: `Cannot dodge even once (cost ${g.dodge.staminaCost} > base stamina ${g.attributes.baseStamina})` });
  }
  if (g.dodge.cooldown === 0) {
    warnings.push({ fieldKey: 'dodge.cooldown', severity: 'warning', message: 'Zero cooldown \u2014 unlimited dodge spam' });
  }

  // Combat constraints
  if (g.combat.critChance > 0.8) {
    warnings.push({ fieldKey: 'combat.critChance', severity: 'warning', message: `Crit ${(g.combat.critChance * 100).toFixed(0)}% \u2014 diminishing design returns, crits feel unremarkable` });
  }
  if (g.combat.critMultiplier > 4) {
    warnings.push({ fieldKey: 'combat.critMultiplier', severity: 'warning', message: 'Extreme crit multiplier \u2014 spiky damage makes balancing difficult' });
  }
  if (g.combat.attackRange > 0 && g.combat.cleaveAngle === 0) {
    warnings.push({ fieldKey: 'combat.cleaveAngle', severity: 'warning', message: 'Zero cleave angle \u2014 melee hits nothing' });
  }
  if (g.combat.comboWindowMs < 100) {
    warnings.push({ fieldKey: 'combat.comboWindowMs', severity: 'warning', message: 'Combo window < 100ms \u2014 near-impossible for human input' });
  }

  // Movement constraints
  if (g.movement.maxSprintSpeed < g.movement.maxWalkSpeed) {
    warnings.push({ fieldKey: 'movement.maxSprintSpeed', severity: 'error', message: 'Sprint slower than walk' });
  }
  if (g.movement.airControl > 0.8) {
    warnings.push({ fieldKey: 'movement.airControl', severity: 'warning', message: 'Very high air control \u2014 may feel floaty or exploitable' });
  }

  // Attribute constraints
  if (g.attributes.baseHP <= 0) {
    warnings.push({ fieldKey: 'attributes.baseHP', severity: 'error', message: 'Zero or negative HP \u2014 instant death' });
  }
  if (g.attributes.staminaRegenPerSec > 0 && g.attributes.baseStamina === 0) {
    warnings.push({ fieldKey: 'attributes.baseStamina', severity: 'warning', message: 'Stamina regen with zero base stamina \u2014 wasted stat' });
  }
  if (g.attributes.manaRegenPerSec > 0 && g.attributes.baseMana === 0) {
    warnings.push({ fieldKey: 'attributes.baseMana', severity: 'warning', message: 'Mana regen with zero base mana \u2014 wasted stat' });
  }

  return warnings;
}
