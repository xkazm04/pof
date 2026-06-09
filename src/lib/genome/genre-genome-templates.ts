/** ── Genre-Aware Genome Template Gallery ───────────────────────────────────── *
 * Bridges the genre-evolution engine (which detects sub-genres like Souls-like,
 * Diablo-like, Character Action…) to the genome editors. Each SubGenreId maps to
 * a curated set of pre-tuned character archetypes + high-coherence item (weapon)
 * genomes so a designer can turn an "Evolve toward X" recommendation into an
 * instant, genre-aligned starting point — one click imports the matching genome
 * into the character / item genome stores.
 *
 * Reuses the existing archetype-template plumbing (`GenomeBlueprint`,
 * `ArchetypeTemplate`, `BASED_ON_TAG_PREFIX`) so lineage tracing is consistent
 * with the standalone Archetype Gallery.
 * ────────────────────────────────────────────────────────────────────────── */

import {
  ACCENT_RED, ACCENT_CYAN, ACCENT_EMERALD,
  ACCENT_PINK, ACCENT_ORANGE, ACCENT_PURPLE, STATUS_INFO,
} from '@/lib/chart-colors';
import type { SubGenreId } from '@/types/telemetry';
import type { CharacterGenome } from '@/types/character-genome';
import type { ItemGenome, TraitGene, MutationConfig, TraitAxis } from '@/types/item-genome';
import {
  DEFAULT_MOVEMENT, DEFAULT_COMBAT, DEFAULT_DODGE,
  DEFAULT_CAMERA, DEFAULT_ATTRIBUTES, createGenome,
} from './defaults';
import { createItemId } from '@/lib/item-dna/defaults';
import {
  type ArchetypeTemplate, BASED_ON_TAG_PREFIX,
} from './archetype-templates';

/* ── Item template definition ───────────────────────────────────────────────
 * The character side reuses `ArchetypeTemplate` verbatim. The item side needs a
 * parallel blueprint that omits the volatile fields (id/updatedAt/author) which
 * are stamped fresh on every import. */

export type ItemGenomeBlueprint = Pick<
  ItemGenome, 'description' | 'traits' | 'mutation' | 'itemType' | 'minRarity'
>;

export interface ItemArchetypeTemplate {
  id: string;
  name: string;
  /** Plain-language one-liner — how the weapon FEELS to wield. */
  feel: string;
  color: string;
  tags: string[];
  blueprint: ItemGenomeBlueprint;
}

/** A sub-genre's curated genome starting points. */
export interface GenreTemplateSet {
  subGenre: SubGenreId;
  characters: ArchetypeTemplate[];
  items: ItemArchetypeTemplate[];
}

/* ── Trait helper ───────────────────────────────────────────────────────────
 * Build the canonical four-axis trait array from a partial spec so every item
 * blueprint always carries all four axes (the DNA roller relies on this). */

function traits(spec: Partial<Record<TraitAxis, { weight: number; tags?: string[] }>>): TraitGene[] {
  const AXES: TraitAxis[] = ['offensive', 'defensive', 'utility', 'economic'];
  return AXES.map((axis) => ({
    axis,
    weight: spec[axis]?.weight ?? 0.05,
    affinityTags: spec[axis]?.tags ?? [],
  }));
}

const DELIBERATE_MUTATION: MutationConfig = { mutationRate: 0.04, maxMutations: 1, wildMutation: false };
const STANDARD_MUTATION: MutationConfig = { mutationRate: 0.08, maxMutations: 1, wildMutation: false };
const VOLATILE_MUTATION: MutationConfig = { mutationRate: 0.16, maxMutations: 2, wildMutation: true };

/* ── Curated genre → genome map ─────────────────────────────────────────────── */

export const GENRE_GENOME_TEMPLATES: Record<SubGenreId, GenreTemplateSet> = {
  'souls-like': {
    subGenre: 'souls-like',
    characters: [{
      id: 'souls-vanguard',
      name: 'Deliberate Vanguard',
      feel: 'Patient, stamina-gated bruiser — every swing and roll is a committed, punishable decision.',
      color: ACCENT_RED,
      tags: ['souls-like', 'melee', 'deliberate', 'stamina', 'high-stakes'],
      blueprint: {
        description: 'Souls-style frontliner: slow deliberate attacks, generous dodge i-frames, and a deep stamina pool with slow regen so resource management drives the fight.',
        movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 360, maxSprintSpeed: 600, acceleration: 1500, turnRate: 480 },
        combat: { ...DEFAULT_COMBAT, baseDamage: 42, attackSpeed: 0.75, comboWindowMs: 520, hitReactionDuration: 0.35, critChance: 0.1, attackRange: 240, cleaveAngle: 130 },
        dodge: { ...DEFAULT_DODGE, distance: 480, duration: 0.55, iFrameStart: 0.05, iFrameDuration: 0.35, cooldown: 0.9, staminaCost: 30 },
        camera: { ...DEFAULT_CAMERA },
        attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 1400, hpPerLevel: 70, baseStamina: 140, staminaPerLevel: 7, staminaRegenPerSec: 12, baseArmor: 80, armorPerLevel: 5 },
      },
    }],
    items: [{
      id: 'souls-greatsword',
      name: 'Greatsword of Poise',
      feel: 'Heavy, predictable, devastating — concentrated raw power with almost no off-type noise.',
      color: ACCENT_RED,
      tags: ['souls-like', 'weapon', 'poise', 'high-coherence'],
      blueprint: {
        description: 'High-coherence two-hander biased hard toward strength, armor-penetration and crit damage, with a low mutation rate for reliable, readable rolls.',
        traits: traits({
          offensive: { weight: 0.9, tags: ['Stat.Strength', 'Stat.AttackPower', 'Stat.CritDamage', 'Stat.PenArmor'] },
          defensive: { weight: 0.2, tags: ['Stat.Armor'] },
          utility: { weight: 0.05 },
          economic: { weight: 0.05 },
        }),
        mutation: DELIBERATE_MUTATION,
        itemType: 'Weapon',
        minRarity: 'Rare',
      },
    }],
  },

  'character-action': {
    subGenre: 'character-action',
    characters: [{
      id: 'action-slayer',
      name: 'Stylish Slayer',
      feel: 'Blistering combo machine — fast attacks, tight cancel windows and air mobility for juggle chains.',
      color: STATUS_INFO,
      tags: ['character-action', 'melee', 'combo', 'stylish', 'air'],
      blueprint: {
        description: 'DMC-style striker tuned for flashy uptime: high attack speed, short combo windows, low-cost dashes and strong air control for launch-juggle play.',
        movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 460, maxSprintSpeed: 880, acceleration: 2800, turnRate: 720, airControl: 0.6, jumpZVelocity: 620 },
        combat: { ...DEFAULT_COMBAT, baseDamage: 26, attackSpeed: 1.9, comboWindowMs: 300, hitReactionDuration: 0.18, critChance: 0.2, critMultiplier: 2.2, attackRange: 180, cleaveAngle: 110 },
        dodge: { ...DEFAULT_DODGE, distance: 600, duration: 0.4, iFrameDuration: 0.3, cooldown: 0.5, staminaCost: 18, cancelWindowStart: 0.25, cancelWindowEnd: 0.4 },
        camera: { ...DEFAULT_CAMERA, lagSpeed: 12 },
        attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 750, hpPerLevel: 35, baseStamina: 150, staminaPerLevel: 9, staminaRegenPerSec: 22, baseArmor: 25, armorPerLevel: 2 },
      },
    }],
    items: [{
      id: 'action-stinger',
      name: 'Stinger Blade',
      feel: 'Rewards relentless aggression — attack speed and crit stack the longer your combo runs.',
      color: STATUS_INFO,
      tags: ['character-action', 'weapon', 'combo', 'high-coherence'],
      blueprint: {
        description: 'Coherent combo blade favouring attack speed and crit, with a utility splash of cooldown reduction so ability cancels stay online.',
        traits: traits({
          offensive: { weight: 0.85, tags: ['Stat.AttackSpeed', 'Stat.CritChance', 'Stat.CritDamage'] },
          defensive: { weight: 0.05 },
          utility: { weight: 0.3, tags: ['Stat.CooldownReduction'] },
          economic: { weight: 0.05 },
        }),
        mutation: STANDARD_MUTATION,
        itemType: 'Weapon',
        minRarity: 'Rare',
      },
    }],
  },

  'diablo-like': {
    subGenre: 'diablo-like',
    characters: [{
      id: 'diablo-hunter',
      name: 'Loot Hunter',
      feel: 'Crit-stacking farmer built to chew through packs and convert kills into drops.',
      color: ACCENT_PURPLE,
      tags: ['diablo-like', 'melee', 'crit', 'itemization'],
      blueprint: {
        description: 'Isometric ARPG bruiser tuned for clear speed and crit scaling — solid sustain with build headroom for deep itemization.',
        movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 420, maxSprintSpeed: 760, acceleration: 2200 },
        combat: { ...DEFAULT_COMBAT, baseDamage: 30, attackSpeed: 1.3, comboWindowMs: 380, critChance: 0.3, critMultiplier: 2.4, attackRange: 200, cleaveAngle: 140 },
        dodge: { ...DEFAULT_DODGE, distance: 520, cooldown: 0.7, staminaCost: 22 },
        camera: { ...DEFAULT_CAMERA, armLength: 900, fovBase: 92 },
        attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 1000, hpPerLevel: 55, baseStamina: 110, baseArmor: 55, armorPerLevel: 4 },
      },
    }],
    items: [{
      id: 'diablo-affixroller',
      name: 'Endgame Affixroller',
      feel: 'A god-roll chase weapon — offensive core with magic-find upside and wild mutation potential.',
      color: ACCENT_PURPLE,
      tags: ['diablo-like', 'weapon', 'itemization', 'high-coherence'],
      blueprint: {
        description: 'Offensive-coherent endgame weapon with a magic-find economic splash and an elevated wild-mutation rate to model deep affix variety.',
        traits: traits({
          offensive: { weight: 0.8, tags: ['Stat.CritChance', 'Stat.CritDamage', 'Stat.AttackPower'] },
          defensive: { weight: 0.05 },
          utility: { weight: 0.1 },
          economic: { weight: 0.35, tags: ['Stat.MagicFind', 'Stat.GoldFind'] },
        }),
        mutation: VOLATILE_MUTATION,
        itemType: 'Weapon',
        minRarity: 'Epic',
      },
    }],
  },

  'arpg-shooter': {
    subGenre: 'arpg-shooter',
    characters: [{
      id: 'shooter-marksman',
      name: 'Precision Marksman',
      feel: 'Kite-and-shoot specialist — long reach, sharp crits, and the mobility to never get cornered.',
      color: STATUS_INFO,
      tags: ['arpg-shooter', 'ranged', 'projectile', 'precision'],
      blueprint: {
        description: 'Ranged-dominant build: long attack range, narrow cleave, high crit and strong acceleration for kiting between volleys.',
        movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 440, maxSprintSpeed: 820, acceleration: 2600, deceleration: 2600 },
        combat: { ...DEFAULT_COMBAT, baseDamage: 32, attackSpeed: 1.0, comboWindowMs: 600, critChance: 0.28, critMultiplier: 2.3, attackRange: 1200, cleaveAngle: 30 },
        dodge: { ...DEFAULT_DODGE, distance: 560, duration: 0.4, cooldown: 0.7, staminaCost: 20 },
        camera: { ...DEFAULT_CAMERA, armLength: 950, fovBase: 95 },
        attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 700, hpPerLevel: 32, baseStamina: 120, baseArmor: 25, armorPerLevel: 2 },
      },
    }],
    items: [{
      id: 'shooter-rifle',
      name: 'Precision Rifle',
      feel: 'Pure damage discipline — crit, penetration and a touch of move speed to keep firing on the move.',
      color: STATUS_INFO,
      tags: ['arpg-shooter', 'weapon', 'ranged', 'high-coherence'],
      blueprint: {
        description: 'Highly-coherent ranged weapon biased toward crit, armor penetration and attack power, with a utility splash of move speed for kiting.',
        traits: traits({
          offensive: { weight: 0.88, tags: ['Stat.CritChance', 'Stat.AttackPower', 'Stat.PenArmor', 'Stat.AttackSpeed'] },
          defensive: { weight: 0.05 },
          utility: { weight: 0.25, tags: ['Stat.MoveSpeed'] },
          economic: { weight: 0.05 },
        }),
        mutation: DELIBERATE_MUTATION,
        itemType: 'Weapon',
        minRarity: 'Rare',
      },
    }],
  },

  'tactical-arpg': {
    subGenre: 'tactical-arpg',
    characters: [{
      id: 'tactical-commander',
      name: 'Squad Commander',
      feel: 'Durable anchor that fuels the party — built to survive, sustain, and keep abilities cycling.',
      color: ACCENT_EMERALD,
      tags: ['tactical-arpg', 'hybrid', 'support', 'sustain'],
      blueprint: {
        description: 'Squad-tactics frontliner: balanced damage, high HP/armor to hold the line, and a mana pool with steady regen to drive ability synergies.',
        movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 400, maxSprintSpeed: 720, acceleration: 1900 },
        combat: { ...DEFAULT_COMBAT, baseDamage: 28, attackSpeed: 1.0, attackRange: 220, critChance: 0.14 },
        dodge: { ...DEFAULT_DODGE, distance: 420, cooldown: 0.9, staminaCost: 26 },
        camera: { ...DEFAULT_CAMERA, armLength: 880 },
        attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 1150, hpPerLevel: 58, baseMana: 120, manaPerLevel: 10, baseArmor: 70, armorPerLevel: 4, manaRegenPerSec: 6 },
      },
    }],
    items: [{
      id: 'tactical-sigil',
      name: "Tactician's Warstaff",
      feel: 'A command focus — bends rolls toward cooldown, area and mana so squad abilities never stall.',
      color: ACCENT_EMERALD,
      tags: ['tactical-arpg', 'weapon', 'support', 'high-coherence'],
      blueprint: {
        description: 'Utility-coherent command weapon favouring cooldown reduction, area-of-effect and mana regen to sustain coordinated ability rotations.',
        traits: traits({
          offensive: { weight: 0.2, tags: ['Stat.AttackPower'] },
          defensive: { weight: 0.15 },
          utility: { weight: 0.85, tags: ['Stat.CooldownReduction', 'Stat.AreaOfEffect', 'Stat.ManaRegen'] },
          economic: { weight: 0.05 },
        }),
        mutation: STANDARD_MUTATION,
        itemType: 'Weapon',
        minRarity: 'Rare',
      },
    }],
  },

  'open-world-arpg': {
    subGenre: 'open-world-arpg',
    characters: [{
      id: 'openworld-wanderer',
      name: 'Wanderer',
      feel: 'Endurance traveller — fast, springy and built to cover ground between encounters.',
      color: ACCENT_ORANGE,
      tags: ['open-world-arpg', 'explorer', 'mobility', 'balanced'],
      blueprint: {
        description: 'Exploration-tuned build: high traversal speed, strong air control and a deep stamina pool with fast regen for sustained overworld movement.',
        movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 480, maxSprintSpeed: 950, acceleration: 2400, airControl: 0.5, jumpZVelocity: 560 },
        combat: { ...DEFAULT_COMBAT, baseDamage: 30, attackSpeed: 1.1, attackRange: 210, critChance: 0.16 },
        dodge: { ...DEFAULT_DODGE, distance: 520, cooldown: 0.7, staminaCost: 22 },
        camera: { ...DEFAULT_CAMERA, armLength: 920 },
        attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 950, hpPerLevel: 48, baseStamina: 150, staminaPerLevel: 8, staminaRegenPerSec: 20, baseArmor: 45, armorPerLevel: 3 },
      },
    }],
    items: [{
      id: 'openworld-wayfarer',
      name: "Wayfarer's Edge",
      feel: 'A traveller’s companion — leans into move speed and cooldowns so you flow between fights.',
      color: ACCENT_ORANGE,
      tags: ['open-world-arpg', 'weapon', 'traversal', 'high-coherence'],
      blueprint: {
        description: 'Utility-coherent travel weapon favouring move speed and cooldown reduction, with offensive and magic-find splashes for opportunistic overworld loot.',
        traits: traits({
          offensive: { weight: 0.35, tags: ['Stat.AttackPower'] },
          defensive: { weight: 0.1 },
          utility: { weight: 0.8, tags: ['Stat.MoveSpeed', 'Stat.CooldownReduction'] },
          economic: { weight: 0.2, tags: ['Stat.MagicFind'] },
        }),
        mutation: STANDARD_MUTATION,
        itemType: 'Weapon',
        minRarity: 'Rare',
      },
    }],
  },

  'roguelite-arpg': {
    subGenre: 'roguelite-arpg',
    characters: [{
      id: 'roguelite-survivor',
      name: 'Run Survivor',
      feel: 'Nimble, snowball-ready glass build that scales explosively as boons stack each run.',
      color: ACCENT_PINK,
      tags: ['roguelite-arpg', 'agile', 'scaling', 'mobility'],
      blueprint: {
        description: 'Hades-style run build: fast attacks, long low-cooldown dashes and a big stamina pool — light defenses that lean on boon scaling to survive.',
        movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 470, maxSprintSpeed: 900, acceleration: 2900, turnRate: 760 },
        combat: { ...DEFAULT_COMBAT, baseDamage: 24, attackSpeed: 1.6, comboWindowMs: 320, critChance: 0.25, critMultiplier: 2.2, attackRange: 180 },
        dodge: { ...DEFAULT_DODGE, distance: 700, duration: 0.36, iFrameDuration: 0.3, cooldown: 0.4, staminaCost: 16 },
        camera: { ...DEFAULT_CAMERA },
        attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 700, hpPerLevel: 30, baseStamina: 160, staminaPerLevel: 10, staminaRegenPerSec: 24, baseArmor: 20, armorPerLevel: 1 },
      },
    }],
    items: [{
      id: 'roguelite-boonchannel',
      name: 'Boon Channel',
      feel: 'Unpredictable by design — an offensive core whose wild mutations reroll your run identity.',
      color: ACCENT_PINK,
      tags: ['roguelite-arpg', 'weapon', 'boon', 'high-coherence'],
      blueprint: {
        description: 'Offensive-coherent weapon with the highest wild-mutation rate in the gallery, so each run reforges it toward a different crit/speed identity.',
        traits: traits({
          offensive: { weight: 0.82, tags: ['Stat.CritChance', 'Stat.CritDamage', 'Stat.AttackSpeed'] },
          defensive: { weight: 0.05 },
          utility: { weight: 0.35, tags: ['Stat.CooldownReduction'] },
          economic: { weight: 0.15 },
        }),
        mutation: VOLATILE_MUTATION,
        itemType: 'Weapon',
        minRarity: 'Epic',
      },
    }],
  },

  'survival-arpg': {
    subGenre: 'survival-arpg',
    characters: [{
      id: 'survival-frontier',
      name: 'Frontier Survivor',
      feel: 'Tough, tireless homesteader — outlasts threats and keeps swinging through long gather loops.',
      color: ACCENT_CYAN,
      tags: ['survival-arpg', 'sustain', 'resourceful', 'endurance'],
      blueprint: {
        description: 'Survival build with a huge HP and stamina pool and fast stamina regen for marathon gathering, building and defending loops.',
        movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 400, maxSprintSpeed: 700, acceleration: 1900 },
        combat: { ...DEFAULT_COMBAT, baseDamage: 26, attackSpeed: 1.0, attackRange: 200, critChance: 0.12 },
        dodge: { ...DEFAULT_DODGE, distance: 420, cooldown: 0.8, staminaCost: 24 },
        camera: { ...DEFAULT_CAMERA },
        attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 1200, hpPerLevel: 60, baseStamina: 170, staminaPerLevel: 10, staminaRegenPerSec: 20, baseArmor: 60, armorPerLevel: 3 },
      },
    }],
    items: [{
      id: 'survival-cleaver',
      name: 'Forged Cleaver',
      feel: 'Tool and weapon in one — biased toward gather yield and craft bonuses with real harvesting bite.',
      color: ACCENT_CYAN,
      tags: ['survival-arpg', 'weapon', 'crafted', 'high-coherence'],
      blueprint: {
        description: 'Economic-coherent survival tool-weapon favouring craft bonus, item quantity and gold find, with an offensive splash so it still harvests and fights.',
        traits: traits({
          offensive: { weight: 0.4, tags: ['Stat.Strength', 'Stat.AttackPower'] },
          defensive: { weight: 0.1 },
          utility: { weight: 0.2 },
          economic: { weight: 0.82, tags: ['Stat.CraftBonus', 'Stat.ItemQuantity', 'Stat.GoldFind'] },
        }),
        mutation: STANDARD_MUTATION,
        itemType: 'Weapon',
        minRarity: 'Uncommon',
      },
    }],
  },
};

/** Every genre's template set, as a stable-ordered array. */
export const GENRE_TEMPLATE_SETS: GenreTemplateSet[] = Object.values(GENRE_GENOME_TEMPLATES);

/* ── Lookups ────────────────────────────────────────────────────────────────── */

export function getGenreTemplateSet(subGenre: SubGenreId): GenreTemplateSet | undefined {
  return GENRE_GENOME_TEMPLATES[subGenre];
}

/* ── Instantiation (fresh, importable genomes) ──────────────────────────────────
 * Each call mints a brand-new genome with a fresh id + updatedAt and a
 * `based-on:<templateId>` lineage tag, so repeated imports never collide and the
 * origin stays traceable. Math.random()/Date are read here (event-handler time),
 * never during render. */

export function instantiateCharacterTemplate(template: ArchetypeTemplate): CharacterGenome {
  return createGenome(template.name, template.color, {
    description: template.blueprint.description,
    author: 'Genre Engine',
    movement: { ...template.blueprint.movement },
    combat: { ...template.blueprint.combat },
    dodge: { ...template.blueprint.dodge },
    camera: { ...template.blueprint.camera },
    attributes: { ...template.blueprint.attributes },
    tags: [...template.tags, `${BASED_ON_TAG_PREFIX}${template.id}`],
  });
}

export function instantiateItemTemplate(template: ItemArchetypeTemplate): ItemGenome {
  return {
    id: createItemId(),
    name: template.name,
    description: template.blueprint.description,
    author: 'Genre Engine',
    version: '1.0.0',
    color: template.color,
    updatedAt: new Date().toISOString(),
    traits: template.blueprint.traits.map((g) => ({ ...g, affinityTags: [...g.affinityTags] })),
    mutation: { ...template.blueprint.mutation },
    itemType: template.blueprint.itemType,
    minRarity: template.blueprint.minRarity,
    tags: [...template.tags, `${BASED_ON_TAG_PREFIX}${template.id}`],
  };
}

/** Dominant trait axis of an item genome/blueprint (the coherence anchor). */
export function dominantAxis(traitList: TraitGene[]): TraitGene {
  return traitList.reduce((a, b) => (b.weight > a.weight ? b : a));
}
