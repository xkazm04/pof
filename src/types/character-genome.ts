/** ── Character Genome Schema ──────────────────────────────────────────────── *
 * Portable JSON schema encoding the complete DNA of any ARPG character
 * archetype. Includes movement, combat, dodge, camera, and attribute profiles.
 * ────────────────────────────────────────────────────────────────────────── */

export interface MovementProfile {
  maxWalkSpeed: number;       // cm/s
  maxSprintSpeed: number;     // cm/s
  acceleration: number;       // cm/s²
  deceleration: number;       // cm/s²
  turnRate: number;           // deg/s
  airControl: number;         // 0-1
  jumpZVelocity: number;     // cm/s
  gravityScale: number;       // multiplier
}

export interface CombatProfile {
  baseDamage: number;
  attackSpeed: number;         // attacks/sec
  comboWindowMs: number;       // ms
  hitReactionDuration: number; // seconds
  critChance: number;          // 0-1
  critMultiplier: number;      // multiplier
  attackRange: number;         // cm
  cleaveAngle: number;         // degrees
}

export interface DodgeProfile {
  distance: number;            // cm
  duration: number;            // seconds
  iFrameStart: number;         // seconds from dodge start
  iFrameDuration: number;      // seconds
  cooldown: number;            // seconds
  staminaCost: number;         // flat cost
  cancelWindowStart: number;   // seconds — when dodge can be cancelled
  cancelWindowEnd: number;     // seconds
}

export interface CameraProfile {
  armLength: number;           // cm
  lagSpeed: number;            // FInterpTo speed
  fovBase: number;             // degrees
  fovSprintOffset: number;     // degrees added while sprinting
  swayMaxRoll: number;         // degrees
  swayMaxPitch: number;        // degrees
  swayInterpSpeed: number;     // FInterpTo speed
  socketOffsetZ: number;       // cm
}

export interface AttributeScaling {
  baseHP: number;
  hpPerLevel: number;
  baseStamina: number;
  staminaPerLevel: number;
  baseMana: number;
  manaPerLevel: number;
  baseArmor: number;
  armorPerLevel: number;
  staminaRegenPerSec: number;
  manaRegenPerSec: number;
}

/** Complete character genome — portable, shareable. */
export interface CharacterGenome {
  /** Unique id for this genome instance */
  id: string;
  /** Display name of the archetype (e.g. "Berserker", "Shadow Rogue") */
  name: string;
  /** Short description */
  description: string;
  /** Author / creator name */
  author: string;
  /** Semantic version */
  version: string;
  /** Accent color for UI display */
  color: string;
  /** ISO timestamp of creation/last edit */
  updatedAt: string;

  movement: MovementProfile;
  combat: CombatProfile;
  dodge: DodgeProfile;
  camera: CameraProfile;
  attributes: AttributeScaling;

  /** Optional tags for community search/filtering */
  tags?: string[];
}

/** Radar axis config for genome visualisation */
export interface GenomeRadarAxis {
  key: string;
  label: string;
  profile: keyof Pick<CharacterGenome, 'movement' | 'combat' | 'dodge' | 'camera' | 'attributes'>;
  field: string;
  min: number;
  max: number;
}
