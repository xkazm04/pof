import { ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET } from '@/lib/chart-colors';
import type {
  CharacterGenome, MovementProfile, CombatProfile,
  DodgeProfile, CameraProfile, AttributeScaling,
} from '@/types/character-genome';

/* ── ID helper ─────────────────────────────────────────────────────────── */

export function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ── Default profile values ────────────────────────────────────────────── */

export const DEFAULT_MOVEMENT: MovementProfile = {
  maxWalkSpeed: 400, maxSprintSpeed: 780, acceleration: 2048, deceleration: 2048,
  turnRate: 540, airControl: 0.35, jumpZVelocity: 520, gravityScale: 1.0,
};

export const DEFAULT_COMBAT: CombatProfile = {
  baseDamage: 25, attackSpeed: 1.2, comboWindowMs: 400, hitReactionDuration: 0.3,
  critChance: 0.15, critMultiplier: 2.0, attackRange: 200, cleaveAngle: 120,
};

export const DEFAULT_DODGE: DodgeProfile = {
  distance: 500, duration: 0.5, iFrameStart: 0.05, iFrameDuration: 0.3,
  cooldown: 0.8, staminaCost: 25, cancelWindowStart: 0.35, cancelWindowEnd: 0.5,
};

export const DEFAULT_CAMERA: CameraProfile = {
  armLength: 800, lagSpeed: 10, fovBase: 90, fovSprintOffset: 5,
  swayMaxRoll: 1.5, swayMaxPitch: 0.8, swayInterpSpeed: 4.0, socketOffsetZ: 60,
};

export const DEFAULT_ATTRIBUTES: AttributeScaling = {
  baseHP: 1000, hpPerLevel: 50, baseStamina: 100, staminaPerLevel: 5,
  baseMana: 0, manaPerLevel: 0, baseArmor: 50, armorPerLevel: 3,
  staminaRegenPerSec: 15, manaRegenPerSec: 0,
};

/* ── Sanitization utilities ────────────────────────────────────────────── */

/** Deep-merge a partial profile with its default, coercing every field to a valid finite number. */
export function sanitizeProfile<T>(defaults: T, partial: unknown): T {
  if (partial == null || typeof partial !== 'object') return { ...defaults };
  const result = { ...defaults };
  const src = partial as Record<string, unknown>;
  for (const key of Object.keys(defaults as object)) {
    const raw = src[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      (result as Record<string, unknown>)[key] = raw;
    }
    // else: keep default
  }
  return result;
}

/** Validate and deeply sanitize a raw parsed object into a safe CharacterGenome.
 *  Returns null with an error string if the data is irrecoverably invalid. */
export function sanitizeGenome(raw: unknown): { genome: CharacterGenome; warnings: string[] } | { error: string } {
  if (raw == null || typeof raw !== 'object') return { error: 'Parsed data is not an object' };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    return { error: 'Invalid genome: missing or empty "name" field' };
  }
  const warnings: string[] = [];
  const profileKeys = ['movement', 'combat', 'dodge', 'camera', 'attributes'] as const;
  for (const key of profileKeys) {
    if (obj[key] == null || typeof obj[key] !== 'object') {
      warnings.push(`Missing "${key}" profile — using defaults`);
    }
  }

  const genome: CharacterGenome = {
    id: createId(),
    name: obj.name as string,
    description: typeof obj.description === 'string' ? obj.description : '',
    author: typeof obj.author === 'string' ? obj.author : 'Imported',
    version: typeof obj.version === 'string' ? obj.version : '1.0.0',
    color: typeof obj.color === 'string' ? obj.color : ACCENT_CYAN,
    updatedAt: new Date().toISOString(),
    movement: sanitizeProfile(DEFAULT_MOVEMENT, obj.movement),
    combat: sanitizeProfile(DEFAULT_COMBAT, obj.combat),
    dodge: sanitizeProfile(DEFAULT_DODGE, obj.dodge),
    camera: sanitizeProfile(DEFAULT_CAMERA, obj.camera),
    attributes: sanitizeProfile(DEFAULT_ATTRIBUTES, obj.attributes),
    tags: Array.isArray(obj.tags) ? (obj.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
  };
  return { genome, warnings };
}

/* ── Genome factory ────────────────────────────────────────────────────── */

export function createGenome(name: string, color: string, overrides?: Partial<CharacterGenome>): CharacterGenome {
  return {
    id: createId(),
    name,
    description: '',
    author: 'User',
    version: '1.0.0',
    color,
    updatedAt: new Date().toISOString(),
    movement: { ...DEFAULT_MOVEMENT },
    combat: { ...DEFAULT_COMBAT },
    dodge: { ...DEFAULT_DODGE },
    camera: { ...DEFAULT_CAMERA },
    attributes: { ...DEFAULT_ATTRIBUTES },
    tags: [],
    ...overrides,
  };
}

/* ── Preset genomes ────────────────────────────────────────────────────── */

export const PRESET_GENOMES: CharacterGenome[] = [
  createGenome('Warrior', ACCENT_ORANGE, {
    description: 'Heavy melee bruiser — high HP, slow but devastating',
    movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 350, maxSprintSpeed: 650, acceleration: 1600 },
    combat: { ...DEFAULT_COMBAT, baseDamage: 40, attackSpeed: 0.8, attackRange: 250, cleaveAngle: 150, critChance: 0.1 },
    dodge: { ...DEFAULT_DODGE, distance: 350, staminaCost: 30 },
    attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 1500, hpPerLevel: 80, baseArmor: 80, armorPerLevel: 5 },
    tags: ['melee', 'tank', 'slow'],
  }),
  createGenome('Rogue', ACCENT_EMERALD, {
    description: 'Fast and agile — crit-focused glass cannon',
    movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 480, maxSprintSpeed: 900, acceleration: 2800, turnRate: 720 },
    combat: { ...DEFAULT_COMBAT, baseDamage: 18, attackSpeed: 1.8, comboWindowMs: 300, critChance: 0.35, critMultiplier: 2.5, attackRange: 150 },
    dodge: { ...DEFAULT_DODGE, distance: 600, duration: 0.4, cooldown: 0.5, staminaCost: 20 },
    attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 600, hpPerLevel: 30, baseStamina: 130, staminaPerLevel: 8, baseArmor: 20, armorPerLevel: 1 },
    tags: ['melee', 'agile', 'crit'],
  }),
  createGenome('Mage', ACCENT_VIOLET, {
    description: 'Ranged spellcaster — high mana, low defense',
    movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 380, maxSprintSpeed: 700, acceleration: 1800 },
    combat: { ...DEFAULT_COMBAT, baseDamage: 35, attackSpeed: 0.6, attackRange: 1000, cleaveAngle: 60, comboWindowMs: 600 },
    dodge: { ...DEFAULT_DODGE, distance: 450, staminaCost: 20 },
    camera: { ...DEFAULT_CAMERA, armLength: 1000, fovBase: 95 },
    attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 500, hpPerLevel: 25, baseMana: 200, manaPerLevel: 15, baseArmor: 15, armorPerLevel: 1, manaRegenPerSec: 8 },
    tags: ['ranged', 'caster', 'glass-cannon'],
  }),
  createGenome('Paladin', ACCENT_CYAN, {
    description: 'Balanced holy warrior — medium speed, self-healing',
    movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 400, maxSprintSpeed: 740 },
    combat: { ...DEFAULT_COMBAT, baseDamage: 30, attackSpeed: 1.0, attackRange: 220, critChance: 0.12 },
    dodge: { ...DEFAULT_DODGE, distance: 400, staminaCost: 25 },
    attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 1200, hpPerLevel: 60, baseMana: 80, manaPerLevel: 8, baseArmor: 65, armorPerLevel: 4, manaRegenPerSec: 4 },
    tags: ['melee', 'hybrid', 'sustain'],
  }),
];
