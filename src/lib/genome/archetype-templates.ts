import {
  ACCENT_RED, ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD,
  ACCENT_PINK, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import type { CharacterGenome } from '@/types/character-genome';
import {
  DEFAULT_MOVEMENT, DEFAULT_COMBAT, DEFAULT_DODGE,
  DEFAULT_CAMERA, DEFAULT_ATTRIBUTES,
  createGenome,
} from './defaults';

/* ── Lineage tagging ────────────────────────────────────────────────────── */

export const BASED_ON_TAG_PREFIX = 'based-on:';

export function isLineageTag(tag: string): boolean {
  return tag.startsWith(BASED_ON_TAG_PREFIX);
}

/** Extract the template id a genome was forked from, or null if none. */
export function getLineageId(tags: readonly string[] | undefined): string | null {
  if (!tags) return null;
  const t = tags.find(isLineageTag);
  return t ? t.slice(BASED_ON_TAG_PREFIX.length) : null;
}

/* ── Template definition ────────────────────────────────────────────────── */

export type GenomeBlueprint = Pick<
  CharacterGenome,
  'description' | 'movement' | 'combat' | 'dodge' | 'camera' | 'attributes'
>;

export interface ArchetypeTemplate {
  id: string;
  name: string;
  /** Plain-language one-liner — describes how the archetype FEELS to play. */
  feel: string;
  color: string;
  /** Curatorial tags for tag-filtering (e.g. melee, dps, tank, agile). */
  tags: string[];
  blueprint: GenomeBlueprint;
}

/* ── Curated archetype gallery ──────────────────────────────────────────── */

export const ARCHETYPE_TEMPLATES: ArchetypeTemplate[] = [
  {
    id: 'berserker',
    name: 'Berserker',
    feel: 'Reckless brawler that snowballs by staying glued to the enemy.',
    color: ACCENT_RED,
    tags: ['melee', 'dps', 'aggressive', 'high-risk'],
    blueprint: {
      description: 'Frenzied melee bruiser — heavy damage, thin defenses, rewards relentless aggression.',
      movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 420, maxSprintSpeed: 820, acceleration: 2400, turnRate: 600 },
      combat: { ...DEFAULT_COMBAT, baseDamage: 50, attackSpeed: 1.5, critChance: 0.25, critMultiplier: 2.3, attackRange: 220, cleaveAngle: 140, comboWindowMs: 350 },
      dodge: { ...DEFAULT_DODGE, distance: 450, cooldown: 0.7, staminaCost: 28 },
      camera: { ...DEFAULT_CAMERA },
      attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 900, hpPerLevel: 45, baseStamina: 120, staminaRegenPerSec: 18, baseArmor: 30, armorPerLevel: 2 },
    },
  },
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    feel: 'Maximum damage, paper-thin defenses — one mistake and you fold.',
    color: ACCENT_VIOLET,
    tags: ['ranged', 'dps', 'glass-cannon', 'high-risk'],
    blueprint: {
      description: 'Ranged nuker built around obscene burst — almost no HP, no armor, every shot matters.',
      movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 380, maxSprintSpeed: 720, acceleration: 1800 },
      combat: { ...DEFAULT_COMBAT, baseDamage: 70, attackSpeed: 0.7, critChance: 0.4, critMultiplier: 2.8, attackRange: 1100, cleaveAngle: 40, comboWindowMs: 700 },
      dodge: { ...DEFAULT_DODGE, distance: 500, cooldown: 0.8, staminaCost: 22 },
      camera: { ...DEFAULT_CAMERA, armLength: 950, fovBase: 95 },
      attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 450, hpPerLevel: 20, baseMana: 250, manaPerLevel: 20, baseArmor: 10, armorPerLevel: 1, manaRegenPerSec: 10 },
    },
  },
  {
    id: 'tank',
    name: 'Tank',
    feel: 'Slow, unkillable wall that holds aggro and outlasts the fight.',
    color: ACCENT_CYAN,
    tags: ['melee', 'tank', 'sustain', 'slow'],
    blueprint: {
      description: 'Heavy-armor frontline — sluggish but enormous HP/armor and the staying power to anchor a team.',
      movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 320, maxSprintSpeed: 580, acceleration: 1400, turnRate: 420 },
      combat: { ...DEFAULT_COMBAT, baseDamage: 28, attackSpeed: 0.7, attackRange: 230, cleaveAngle: 160, critChance: 0.08, hitReactionDuration: 0.15 },
      dodge: { ...DEFAULT_DODGE, distance: 280, cooldown: 1.2, staminaCost: 35 },
      camera: { ...DEFAULT_CAMERA },
      attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 1800, hpPerLevel: 100, baseStamina: 150, staminaRegenPerSec: 20, baseArmor: 110, armorPerLevel: 7 },
    },
  },
  {
    id: 'speedster',
    name: 'Speedster',
    feel: 'Hit-and-run skirmisher that wins by never being where the hit lands.',
    color: ACCENT_EMERALD,
    tags: ['melee', 'agile', 'mobility', 'evasive'],
    blueprint: {
      description: 'Blazing fast dodger — modest damage but constantly repositioning with long, low-cooldown dashes.',
      movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 520, maxSprintSpeed: 980, acceleration: 3200, deceleration: 3200, turnRate: 820, airControl: 0.55 },
      combat: { ...DEFAULT_COMBAT, baseDamage: 20, attackSpeed: 2.0, comboWindowMs: 280, critChance: 0.22, critMultiplier: 2.0, attackRange: 160 },
      dodge: { ...DEFAULT_DODGE, distance: 750, duration: 0.35, iFrameStart: 0.03, iFrameDuration: 0.28, cooldown: 0.35, staminaCost: 18 },
      camera: { ...DEFAULT_CAMERA, lagSpeed: 14 },
      attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 650, hpPerLevel: 28, baseStamina: 160, staminaPerLevel: 10, staminaRegenPerSec: 25, baseArmor: 15, armorPerLevel: 1 },
    },
  },
  {
    id: 'spellblade',
    name: 'Spellblade',
    feel: 'Spell-augmented swordplay that bridges weapon and arcane damage.',
    color: ACCENT_PINK,
    tags: ['hybrid', 'melee', 'caster', 'balanced'],
    blueprint: {
      description: 'Mid-range hybrid — sustained mana pool plus a real saber so spell volleys and melee combos chain together.',
      movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 410, maxSprintSpeed: 770, acceleration: 2100 },
      combat: { ...DEFAULT_COMBAT, baseDamage: 34, attackSpeed: 1.1, attackRange: 320, cleaveAngle: 90, critChance: 0.18, critMultiplier: 2.1, comboWindowMs: 450 },
      dodge: { ...DEFAULT_DODGE, distance: 480, cooldown: 0.7, staminaCost: 22 },
      camera: { ...DEFAULT_CAMERA, armLength: 850 },
      attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 900, hpPerLevel: 45, baseStamina: 110, baseMana: 140, manaPerLevel: 12, baseArmor: 40, armorPerLevel: 3, manaRegenPerSec: 6 },
    },
  },
];

/* ── Fork-to-Edit ───────────────────────────────────────────────────────── */

/** Clone a template into a fresh user genome and stamp a based-on lineage tag. */
export function forkTemplate(template: ArchetypeTemplate): CharacterGenome {
  return createGenome(`${template.name} Fork`, template.color, {
    description: template.blueprint.description,
    movement: { ...template.blueprint.movement },
    combat: { ...template.blueprint.combat },
    dodge: { ...template.blueprint.dodge },
    camera: { ...template.blueprint.camera },
    attributes: { ...template.blueprint.attributes },
    tags: [...template.tags, `${BASED_ON_TAG_PREFIX}${template.id}`],
  });
}

/* ── Tag indexing ───────────────────────────────────────────────────────── */

/** Distinct sorted curatorial tags across all templates (lineage tags excluded). */
export function getAllTemplateTags(): string[] {
  const all = new Set<string>();
  for (const t of ARCHETYPE_TEMPLATES) for (const tag of t.tags) all.add(tag);
  return Array.from(all).sort();
}

/** Use a stricter return type for index lookups. */
export function findTemplateById(id: string): ArchetypeTemplate | undefined {
  return ARCHETYPE_TEMPLATES.find((t) => t.id === id);
}
