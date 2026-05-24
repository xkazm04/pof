import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_GREEN, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_INFO,
} from '@/lib/chart-colors';
import type { CharacterGenome } from '@/types/character-genome';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import type {
  FieldDef, CompactRadarAxis, ComparisonAxis,
  PowerCurveStat, CompStatRow,
} from './types';

export const ACCENT = MODULE_COLORS.core;

/* ── Profile field definitions ─────────────────────────────────────────── */

export const MOVEMENT_FIELDS: FieldDef[] = [
  { key: 'maxWalkSpeed', label: 'Walk Speed', unit: 'cm/s', min: 100, max: 1200, step: 10 },
  { key: 'maxSprintSpeed', label: 'Sprint Speed', unit: 'cm/s', min: 200, max: 1500, step: 10 },
  { key: 'acceleration', label: 'Acceleration', unit: 'cm/s\u00B2', min: 500, max: 5000, step: 50 },
  { key: 'deceleration', label: 'Deceleration', unit: 'cm/s\u00B2', min: 500, max: 5000, step: 50 },
  { key: 'turnRate', label: 'Turn Rate', unit: 'deg/s', min: 90, max: 1080, step: 10 },
  { key: 'airControl', label: 'Air Control', unit: '', min: 0, max: 1, step: 0.05 },
  { key: 'jumpZVelocity', label: 'Jump Velocity', unit: 'cm/s', min: 100, max: 1200, step: 10 },
  { key: 'gravityScale', label: 'Gravity Scale', unit: 'x', min: 0.1, max: 4.0, step: 0.1 },
];

export const COMBAT_FIELDS: FieldDef[] = [
  { key: 'baseDamage', label: 'Base Damage', unit: '', min: 1, max: 200, step: 1 },
  { key: 'attackSpeed', label: 'Attack Speed', unit: '/s', min: 0.1, max: 4.0, step: 0.1 },
  { key: 'comboWindowMs', label: 'Combo Window', unit: 'ms', min: 100, max: 1000, step: 25 },
  { key: 'hitReactionDuration', label: 'Hit Stun', unit: 's', min: 0, max: 2, step: 0.05 },
  { key: 'critChance', label: 'Crit Chance', unit: '%', min: 0, max: 1, step: 0.01 },
  { key: 'critMultiplier', label: 'Crit Multi', unit: 'x', min: 1, max: 5, step: 0.1 },
  { key: 'attackRange', label: 'Attack Range', unit: 'cm', min: 50, max: 1500, step: 10 },
  { key: 'cleaveAngle', label: 'Cleave Angle', unit: '\u00B0', min: 0, max: 360, step: 5 },
];

export const DODGE_FIELDS: FieldDef[] = [
  { key: 'distance', label: 'Distance', unit: 'cm', min: 100, max: 1200, step: 10 },
  { key: 'duration', label: 'Duration', unit: 's', min: 0.1, max: 1.5, step: 0.05 },
  { key: 'iFrameStart', label: 'I-Frame Start', unit: 's', min: 0, max: 0.5, step: 0.01 },
  { key: 'iFrameDuration', label: 'I-Frame Dur.', unit: 's', min: 0, max: 1.0, step: 0.01 },
  { key: 'cooldown', label: 'Cooldown', unit: 's', min: 0, max: 3, step: 0.05 },
  { key: 'staminaCost', label: 'Stamina Cost', unit: '', min: 0, max: 100, step: 1 },
  { key: 'cancelWindowStart', label: 'Cancel Start', unit: 's', min: 0, max: 1, step: 0.01 },
  { key: 'cancelWindowEnd', label: 'Cancel End', unit: 's', min: 0, max: 1.5, step: 0.01 },
];

export const CAMERA_FIELDS: FieldDef[] = [
  { key: 'armLength', label: 'Arm Length', unit: 'cm', min: 100, max: 2000, step: 10 },
  { key: 'lagSpeed', label: 'Lag Speed', unit: '', min: 0, max: 30, step: 0.5 },
  { key: 'fovBase', label: 'FOV', unit: '\u00B0', min: 60, max: 120, step: 1 },
  { key: 'fovSprintOffset', label: 'Sprint FOV+', unit: '\u00B0', min: 0, max: 20, step: 1 },
  { key: 'swayMaxRoll', label: 'Sway Roll', unit: '\u00B0', min: 0, max: 5, step: 0.1 },
  { key: 'swayMaxPitch', label: 'Sway Pitch', unit: '\u00B0', min: 0, max: 5, step: 0.1 },
  { key: 'swayInterpSpeed', label: 'Sway Speed', unit: '', min: 0, max: 15, step: 0.5 },
  { key: 'socketOffsetZ', label: 'Socket Z', unit: 'cm', min: -100, max: 200, step: 5 },
];

export const ATTRIBUTE_FIELDS: FieldDef[] = [
  { key: 'baseHP', label: 'Base HP', unit: '', min: 100, max: 5000, step: 50 },
  { key: 'hpPerLevel', label: 'HP / Level', unit: '', min: 0, max: 200, step: 5 },
  { key: 'baseStamina', label: 'Base Stamina', unit: '', min: 10, max: 500, step: 5 },
  { key: 'staminaPerLevel', label: 'Stam / Level', unit: '', min: 0, max: 50, step: 1 },
  { key: 'baseMana', label: 'Base Mana', unit: '', min: 0, max: 500, step: 5 },
  { key: 'manaPerLevel', label: 'Mana / Level', unit: '', min: 0, max: 50, step: 1 },
  { key: 'baseArmor', label: 'Base Armor', unit: '', min: 0, max: 200, step: 1 },
  { key: 'armorPerLevel', label: 'Armor / Level', unit: '', min: 0, max: 20, step: 1 },
  { key: 'staminaRegenPerSec', label: 'Stam Regen', unit: '/s', min: 0, max: 50, step: 1 },
  { key: 'manaRegenPerSec', label: 'Mana Regen', unit: '/s', min: 0, max: 30, step: 1 },
];

/* ── Radar axes for overview comparison ────────────────────────────────── */

export const OVERVIEW_AXES: CompactRadarAxis[] = [
  { label: 'Speed', getValue: (g) => g.movement.maxSprintSpeed, max: 1500 },
  { label: 'DPS', getValue: (g) => g.combat.baseDamage * g.combat.attackSpeed, max: 200 },
  { label: 'Range', getValue: (g) => g.combat.attackRange, max: 1500 },
  { label: 'Tankiness', getValue: (g) => g.attributes.baseHP + g.attributes.baseArmor * 5, max: 2500 },
  { label: 'Agility', getValue: (g) => g.dodge.distance / g.dodge.cooldown, max: 1200 },
  { label: 'Crit', getValue: (g) => g.combat.critChance * g.combat.critMultiplier * 100, max: 200 },
];

export function genomeToRadar(genome: CharacterGenome): RadarDataPoint[] {
  return OVERVIEW_AXES.map((axis) => ({
    axis: axis.label,
    value: Math.min(axis.getValue(genome) / axis.max, 1),
  }));
}

/* ── Comparison axes for archetype panel ───────────────────────────────── */

export const COMPARISON_AXES: ComparisonAxis[] = [
  { label: 'Speed', getValue: (g) => g.movement.maxSprintSpeed, max: 1500, unit: 'cm/s', higherIsBetter: true },
  { label: 'DPS', getValue: (g) => g.combat.baseDamage * g.combat.attackSpeed, max: 200, unit: '', higherIsBetter: true },
  { label: 'Range', getValue: (g) => g.combat.attackRange, max: 1500, unit: 'cm', higherIsBetter: true },
  { label: 'Tankiness', getValue: (g) => g.attributes.baseHP + g.attributes.baseArmor * 5, max: 2500, unit: 'eHP', higherIsBetter: true },
  { label: 'Agility', getValue: (g) => g.dodge.distance / Math.max(g.dodge.cooldown, 0.01), max: 1200, unit: '', higherIsBetter: true },
  { label: 'Crit', getValue: (g) => g.combat.critChance * g.combat.critMultiplier * 100, max: 200, unit: '%', higherIsBetter: true },
  { label: 'Sustain', getValue: (g) => g.attributes.staminaRegenPerSec + g.attributes.manaRegenPerSec, max: 50, unit: '/s', higherIsBetter: true },
  { label: 'Armor', getValue: (g) => g.attributes.baseArmor, max: 200, unit: '', higherIsBetter: true },
];

/* ── Power curve tab definitions ───────────────────────────────────────── */

export const POWER_CURVE_TABS: { key: PowerCurveStat; label: string; color: string }[] = [
  { key: 'hp', label: 'HP', color: ACCENT_GREEN },
  { key: 'stamina', label: 'Stamina', color: ACCENT_ORANGE },
  { key: 'mana', label: 'Mana', color: STATUS_INFO },
  { key: 'armor', label: 'Armor', color: ACCENT_CYAN },
  { key: 'power', label: 'Power Budget', color: ACCENT_VIOLET },
];

/* ── Comparison table stat rows ────────────────────────────────────────── */

export const COMP_STATS: CompStatRow[] = [
  { label: 'Walk Speed', unit: 'cm/s', getValue: (g) => g.movement.maxWalkSpeed, higherIsBetter: true },
  { label: 'Sprint Speed', unit: 'cm/s', getValue: (g) => g.movement.maxSprintSpeed, higherIsBetter: true },
  { label: 'Base Damage', unit: '', getValue: (g) => g.combat.baseDamage, higherIsBetter: true },
  { label: 'Attack Speed', unit: '/s', getValue: (g) => g.combat.attackSpeed, higherIsBetter: true },
  { label: 'DPS', unit: '', getValue: (g) => Math.round(g.combat.baseDamage * g.combat.attackSpeed * 10) / 10, higherIsBetter: true },
  { label: 'Crit Chance', unit: '%', getValue: (g) => Math.round(g.combat.critChance * 100), higherIsBetter: true },
  { label: 'Attack Range', unit: 'cm', getValue: (g) => g.combat.attackRange, higherIsBetter: true },
  { label: 'Dodge Distance', unit: 'cm', getValue: (g) => g.dodge.distance, higherIsBetter: true },
  { label: 'Dodge Cooldown', unit: 's', getValue: (g) => g.dodge.cooldown, higherIsBetter: false },
  { label: 'I-Frame Duration', unit: 's', getValue: (g) => g.dodge.iFrameDuration, higherIsBetter: true },
  { label: 'Base HP', unit: '', getValue: (g) => g.attributes.baseHP, higherIsBetter: true },
  { label: 'Base Armor', unit: '', getValue: (g) => g.attributes.baseArmor, higherIsBetter: true },
  { label: 'Base Stamina', unit: '', getValue: (g) => g.attributes.baseStamina, higherIsBetter: true },
  { label: 'Base Mana', unit: '', getValue: (g) => g.attributes.baseMana, higherIsBetter: true },
];

/* ── Simulation constants ──────────────────────────────────────────────── */

export const STANDARD_ENEMY_HP = 1000;
export const ARMOR_REDUCTION_FACTOR = 5;
export const ASSUMED_ENEMY_DPS = 80;

/* ── Genome color palette ──────────────────────────────────────────────── */

import {
  ACCENT_RED, ACCENT_EMERALD, ACCENT_PURPLE, ACCENT_PINK,
  STATUS_WARNING, STATUS_MUTED,
} from '@/lib/chart-colors';

export const GENOME_PALETTE = [
  ACCENT_RED, ACCENT_ORANGE, STATUS_WARNING, ACCENT_GREEN,
  ACCENT_EMERALD, ACCENT_CYAN, STATUS_INFO, MODULE_COLORS.core,
  ACCENT_VIOLET, ACCENT_PURPLE, ACCENT_PINK, STATUS_MUTED,
] as const;

export const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
