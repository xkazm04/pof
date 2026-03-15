/**
 * Character Feel Optimizer Engine
 *
 * Genre-reference presets and AI prompt builder for tuning ARPGCharacterBase
 * UPROPERTY values to match a target "feel" (Dark Souls heavy, Hades snappy, etc.).
 */

import type {
  MovementProfile,
  CombatProfile,
  DodgeProfile,
  CameraProfile,
} from '@/types/character-genome';

// ── Feel Profile (subset of genome focused on "feel") ────────────────────────

export interface FeelProfile {
  movement: MovementProfile;
  combat: CombatProfile;
  dodge: DodgeProfile;
  camera: CameraProfile;
  staminaDrainPerSec: number;
  staminaRegenPerSec: number;
}

export interface FeelPreset {
  id: string;
  name: string;
  genre: string;
  description: string;
  tags: string[];
  color: string;
  profile: FeelProfile;
  rationale: Record<string, string>;
}

// ── Genre Reference Presets ──────────────────────────────────────────────────

export const FEEL_PRESETS: FeelPreset[] = [
  {
    id: 'dark-souls',
    name: 'Dark Souls Heavy',
    genre: 'Soulslike',
    description: 'Deliberate, weighty combat with commitment-heavy dodges and slow recovery',
    tags: ['heavy', 'deliberate', 'punishing', 'stamina-management'],
    color: '#8b5cf6',
    profile: {
      movement: {
        maxWalkSpeed: 320, maxSprintSpeed: 580, acceleration: 1200, deceleration: 2400,
        turnRate: 360, airControl: 0.1, jumpZVelocity: 400, gravityScale: 1.3,
      },
      combat: {
        baseDamage: 45, attackSpeed: 0.7, comboWindowMs: 600, hitReactionDuration: 0.5,
        critChance: 0.08, critMultiplier: 1.5, attackRange: 250, cleaveAngle: 90,
      },
      dodge: {
        distance: 350, duration: 0.7, iFrameStart: 0.05, iFrameDuration: 0.4,
        cooldown: 0.3, staminaCost: 35, cancelWindowStart: 0.55, cancelWindowEnd: 0.7,
      },
      camera: {
        armLength: 600, lagSpeed: 6, fovBase: 80, fovSprintOffset: 3,
        swayMaxRoll: 0.5, swayMaxPitch: 0.3, swayInterpSpeed: 2.0, socketOffsetZ: 40,
      },
      staminaDrainPerSec: 25,
      staminaRegenPerSec: 12,
    },
    rationale: {
      maxWalkSpeed: 'Slow walk speed (320) creates a deliberate, methodical feel — every step matters',
      maxSprintSpeed: 'Sprint is relatively slow (580) so repositioning takes commitment',
      acceleration: 'Low acceleration (1200) means movement builds up gradually — no instant starts',
      deceleration: 'High deceleration (2400) creates a "planted" stop — momentum is punished',
      turnRate: 'Restricted turn rate (360) forces directional commitment during attacks',
      attackSpeed: 'Slow attacks (0.7/s) make each swing a commitment with high risk/reward',
      comboWindowMs: 'Wide combo window (600ms) allows delayed follow-ups but punishes button mashing',
      dodgeDistance: 'Short dodge (350cm) forces precise spacing rather than panic rolling',
      dodgeDuration: 'Long dodge (0.7s) with generous i-frames (0.4s) rewards timing',
      staminaCost: 'High stamina cost (35) limits dodge spam — stamina management is core gameplay',
      cameraLagSpeed: 'Slow camera lag (6) adds cinematic weight to movement transitions',
      fovBase: 'Tight FOV (80) creates tunnel-vision intensity during combat encounters',
      staminaDrainPerSec: 'High stamina drain (25/s) while sprinting limits escape options',
      staminaRegenPerSec: 'Slow regen (12/s) creates tension during recovery windows',
    },
  },
  {
    id: 'hades',
    name: 'Hades Snappy',
    genre: 'Roguelite Action',
    description: 'Ultra-responsive, fast-paced combat with instant dodges and fluid combos',
    tags: ['snappy', 'fast', 'responsive', 'fluid', 'low-commitment'],
    color: '#f97316',
    profile: {
      movement: {
        maxWalkSpeed: 520, maxSprintSpeed: 900, acceleration: 4096, deceleration: 4096,
        turnRate: 1080, airControl: 0.6, jumpZVelocity: 600, gravityScale: 1.0,
      },
      combat: {
        baseDamage: 15, attackSpeed: 2.2, comboWindowMs: 250, hitReactionDuration: 0.15,
        critChance: 0.2, critMultiplier: 2.0, attackRange: 180, cleaveAngle: 140,
      },
      dodge: {
        distance: 500, duration: 0.25, iFrameStart: 0.0, iFrameDuration: 0.2,
        cooldown: 0.3, staminaCost: 10, cancelWindowStart: 0.1, cancelWindowEnd: 0.25,
      },
      camera: {
        armLength: 1000, lagSpeed: 18, fovBase: 95, fovSprintOffset: 8,
        swayMaxRoll: 2.0, swayMaxPitch: 1.0, swayInterpSpeed: 8.0, socketOffsetZ: 80,
      },
      staminaDrainPerSec: 8,
      staminaRegenPerSec: 30,
    },
    rationale: {
      maxWalkSpeed: 'High walk speed (520) keeps movement feeling zippy even without sprinting',
      maxSprintSpeed: 'Fast sprint (900) lets player fly across arenas for repositioning',
      acceleration: 'Max acceleration (4096) gives instant responsiveness — zero input lag feel',
      deceleration: 'Instant deceleration (4096) so stopping feels precise and controllable',
      turnRate: 'Very high turn rate (1080) means instant directional changes',
      attackSpeed: 'Rapid attacks (2.2/s) create a machine-gun feel for melee combos',
      comboWindowMs: 'Tight combo window (250ms) rewards fast, rhythmic button presses',
      dodgeDistance: 'Long dash (500cm) covers significant ground instantly',
      dodgeDuration: 'Ultra-short dash (0.25s) feels near-instantaneous',
      staminaCost: 'Very low stamina cost (10) means dashes are nearly free to use',
      cameraLagSpeed: 'High lag speed (18) keeps camera glued to fast character movement',
      fovBase: 'Wide FOV (95) helps track fast-moving enemies across the screen',
      staminaDrainPerSec: 'Minimal sprint drain (8/s) — sprinting is essentially free',
      staminaRegenPerSec: 'Very fast regen (30/s) — downtime between actions is minimal',
    },
  },
  {
    id: 'diablo4',
    name: 'Diablo 4 Weighty',
    genre: 'ARPG Isometric',
    description: 'Satisfying impact with screen shake, moderate speed, and crowd-clearing sweeps',
    tags: ['weighty', 'impactful', 'crowd-control', 'isometric'],
    color: '#ef4444',
    profile: {
      movement: {
        maxWalkSpeed: 420, maxSprintSpeed: 750, acceleration: 2048, deceleration: 2400,
        turnRate: 720, airControl: 0.2, jumpZVelocity: 0, gravityScale: 1.0,
      },
      combat: {
        baseDamage: 35, attackSpeed: 1.0, comboWindowMs: 450, hitReactionDuration: 0.35,
        critChance: 0.15, critMultiplier: 2.5, attackRange: 300, cleaveAngle: 180,
      },
      dodge: {
        distance: 450, duration: 0.45, iFrameStart: 0.05, iFrameDuration: 0.25,
        cooldown: 1.5, staminaCost: 0, cancelWindowStart: 0.3, cancelWindowEnd: 0.45,
      },
      camera: {
        armLength: 1400, lagSpeed: 12, fovBase: 60, fovSprintOffset: 3,
        swayMaxRoll: 0.3, swayMaxPitch: 0.2, swayInterpSpeed: 3.0, socketOffsetZ: 0,
      },
      staminaDrainPerSec: 0,
      staminaRegenPerSec: 0,
    },
    rationale: {
      maxWalkSpeed: 'Moderate walk speed (420) balances responsiveness with screen readability',
      maxSprintSpeed: 'Sprint (750) feels meaningful for traversal without breaking isometric framing',
      acceleration: 'Standard acceleration (2048) — no delay but not instant either',
      turnRate: 'Fast turn rate (720) for isometric — direction changes feel natural',
      attackSpeed: 'Moderate attack speed (1.0/s) gives each hit satisfying weight',
      comboWindowMs: 'Medium combo window (450ms) feels natural for skill rotation',
      dodgeDistance: 'Medium dodge (450cm) — evade mechanic, not primary movement',
      dodgeDuration: 'Short dodge (0.45s) with cooldown — used tactically, not spammed',
      dodgeCooldown: 'Long cooldown (1.5s) makes dodge a tactical decision',
      staminaCost: 'No stamina cost — dodge is cooldown-gated instead',
      cameraArmLength: 'Very high camera (1400cm) for isometric overview of mob packs',
      fovBase: 'Narrow FOV (60) for isometric perspective — reduces distortion',
      staminaDrainPerSec: 'No stamina system — resource management is skill-cooldown based',
      staminaRegenPerSec: 'No stamina system — keeps things streamlined for mob clearing',
    },
  },
  {
    id: 'elden-ring',
    name: 'Elden Ring Mounted',
    genre: 'Open-World Soulslike',
    description: 'Hybrid feel — soulslike combat with faster open-world traversal and longer dodge rolls',
    tags: ['hybrid', 'open-world', 'exploration', 'mounted-feel'],
    color: '#eab308',
    profile: {
      movement: {
        maxWalkSpeed: 380, maxSprintSpeed: 700, acceleration: 1600, deceleration: 2000,
        turnRate: 450, airControl: 0.15, jumpZVelocity: 480, gravityScale: 1.2,
      },
      combat: {
        baseDamage: 40, attackSpeed: 0.8, comboWindowMs: 550, hitReactionDuration: 0.45,
        critChance: 0.1, critMultiplier: 1.8, attackRange: 270, cleaveAngle: 100,
      },
      dodge: {
        distance: 420, duration: 0.6, iFrameStart: 0.05, iFrameDuration: 0.35,
        cooldown: 0.2, staminaCost: 28, cancelWindowStart: 0.45, cancelWindowEnd: 0.6,
      },
      camera: {
        armLength: 700, lagSpeed: 8, fovBase: 85, fovSprintOffset: 5,
        swayMaxRoll: 0.8, swayMaxPitch: 0.4, swayInterpSpeed: 3.0, socketOffsetZ: 50,
      },
      staminaDrainPerSec: 20,
      staminaRegenPerSec: 15,
    },
    rationale: {
      maxWalkSpeed: 'Slightly faster walk (380) than Dark Souls for open-world pacing',
      maxSprintSpeed: 'Faster sprint (700) for open-world traversal without mount',
      acceleration: 'Moderate acceleration (1600) — weightier than action games but not glacial',
      jumpZVelocity: 'Jump enabled (480) for vertical exploration in open world',
      attackSpeed: 'Slightly faster attacks (0.8/s) than DS for more aggressive play',
      dodgeDistance: 'Longer dodge (420cm) compensates for open-world enemy spacing',
      dodgeDuration: 'Long roll (0.6s) with generous i-frames for forgiving timing',
      dodgeCooldown: 'Minimal cooldown (0.2s) allows consecutive rolls when needed',
      staminaCost: 'Moderate stamina (28) — allows 3-4 dodges before depleted',
      cameraArmLength: 'Wider camera (700cm) for landscape appreciation in open world',
      fovBase: 'Moderate FOV (85) balances combat awareness with cinematic framing',
      staminaDrainPerSec: 'Moderate sprint drain (20/s) — can sprint for meaningful distances',
      staminaRegenPerSec: 'Faster regen (15/s) than DS — reduces downtime during exploration',
    },
  },
  {
    id: 'dmc5',
    name: 'DMC5 Stylish',
    genre: 'Character Action',
    description: 'Extreme speed, aerial combos, animation cancels, and style-driven combat',
    tags: ['stylish', 'aerial', 'combo-heavy', 'cancel-driven', 'fast'],
    color: '#ec4899',
    profile: {
      movement: {
        maxWalkSpeed: 480, maxSprintSpeed: 850, acceleration: 3200, deceleration: 3500,
        turnRate: 900, airControl: 0.8, jumpZVelocity: 700, gravityScale: 0.9,
      },
      combat: {
        baseDamage: 12, attackSpeed: 2.5, comboWindowMs: 200, hitReactionDuration: 0.2,
        critChance: 0.25, critMultiplier: 2.0, attackRange: 200, cleaveAngle: 160,
      },
      dodge: {
        distance: 550, duration: 0.3, iFrameStart: 0.0, iFrameDuration: 0.25,
        cooldown: 0.1, staminaCost: 0, cancelWindowStart: 0.05, cancelWindowEnd: 0.3,
      },
      camera: {
        armLength: 750, lagSpeed: 14, fovBase: 90, fovSprintOffset: 10,
        swayMaxRoll: 3.0, swayMaxPitch: 1.5, swayInterpSpeed: 10.0, socketOffsetZ: 70,
      },
      staminaDrainPerSec: 0,
      staminaRegenPerSec: 0,
    },
    rationale: {
      maxWalkSpeed: 'Fast walk (480) keeps pacing brisk between encounters',
      maxSprintSpeed: 'Very fast sprint (850) for arena repositioning mid-combo',
      acceleration: 'High acceleration (3200) for responsive direction changes',
      turnRate: 'Very high turn rate (900) for instant target switching in groups',
      airControl: 'Extreme air control (0.8) enables aerial combo positioning',
      jumpZVelocity: 'High jump (700) for launcher follow-ups and aerial raves',
      gravityScale: 'Low gravity (0.9) extends air time for longer aerial combos',
      attackSpeed: 'Very fast attacks (2.5/s) for fluid multi-hit combos',
      comboWindowMs: 'Tight combo window (200ms) rewards precise input timing',
      dodgeDistance: 'Long dodge (550cm) doubles as movement tool during combos',
      dodgeCooldown: 'Near-zero cooldown (0.1s) — dodge is a core combat verb, not a resource',
      staminaCost: 'No stamina — combat is limited by player skill, not meters',
      cameraSway: 'Aggressive sway (3.0) adds dynamism to flashy combat sequences',
      fovSprintOffset: 'Large FOV boost (10) on sprint creates a rush/speed sensation',
    },
  },
  {
    id: 'monster-hunter',
    name: 'Monster Hunter Tactical',
    genre: 'Hunting Action',
    description: 'Weapon-dependent feel with heavy commitment, positional play, and deliberate timing',
    tags: ['tactical', 'positional', 'weapon-dependent', 'commitment'],
    color: '#22d3ee',
    profile: {
      movement: {
        maxWalkSpeed: 360, maxSprintSpeed: 650, acceleration: 1400, deceleration: 1800,
        turnRate: 300, airControl: 0.05, jumpZVelocity: 350, gravityScale: 1.4,
      },
      combat: {
        baseDamage: 55, attackSpeed: 0.5, comboWindowMs: 700, hitReactionDuration: 0.6,
        critChance: 0.05, critMultiplier: 1.3, attackRange: 350, cleaveAngle: 70,
      },
      dodge: {
        distance: 300, duration: 0.55, iFrameStart: 0.06, iFrameDuration: 0.2,
        cooldown: 0.4, staminaCost: 30, cancelWindowStart: 0.4, cancelWindowEnd: 0.55,
      },
      camera: {
        armLength: 650, lagSpeed: 7, fovBase: 82, fovSprintOffset: 4,
        swayMaxRoll: 0.4, swayMaxPitch: 0.2, swayInterpSpeed: 2.5, socketOffsetZ: 45,
      },
      staminaDrainPerSec: 22,
      staminaRegenPerSec: 10,
    },
    rationale: {
      maxWalkSpeed: 'Slow walk (360) emphasizes positional play — approach matters',
      maxSprintSpeed: 'Moderate sprint (650) — sheathing weapon for sprint is a tactical choice',
      acceleration: 'Low acceleration (1400) makes starting movement feel heavy',
      turnRate: 'Very restricted turn (300) during attacks — commit to your swing direction',
      attackSpeed: 'Very slow attacks (0.5/s) make each hit a significant commitment',
      comboWindowMs: 'Wide combo window (700ms) allows delayed follow-ups for positioning',
      dodgeDistance: 'Short dodge (300cm) — primarily for avoiding attacks, not repositioning',
      dodgeIFrames: 'Short i-frames (0.2s) require precise timing — rewarding to master',
      staminaCost: 'High stamina cost (30) — can only dodge 3 times before exhausted',
      cameraLagSpeed: 'Slow camera (7) creates a grounded, realistic tracking feel',
      baseDamage: 'High damage per hit (55) — fewer hits but each one is impactful',
      staminaDrainPerSec: 'High sprint drain (22/s) — forces tactical sprint usage',
      staminaRegenPerSec: 'Slow regen (10/s) creates meaningful recovery windows',
    },
  },
];

// ── Profile field metadata ───────────────────────────────────────────────────

export interface FeelFieldMeta {
  key: string;
  label: string;
  category: 'Movement' | 'Combat' | 'Dodge' | 'Camera' | 'Stamina';
  unit: string;
  min: number;
  max: number;
}

export const FEEL_FIELD_META: FeelFieldMeta[] = [
  // Movement
  { key: 'movement.maxWalkSpeed', label: 'Walk Speed', category: 'Movement', unit: 'cm/s', min: 200, max: 600 },
  { key: 'movement.maxSprintSpeed', label: 'Sprint Speed', category: 'Movement', unit: 'cm/s', min: 400, max: 1000 },
  { key: 'movement.acceleration', label: 'Acceleration', category: 'Movement', unit: 'cm/s²', min: 800, max: 4500 },
  { key: 'movement.deceleration', label: 'Deceleration', category: 'Movement', unit: 'cm/s²', min: 800, max: 4500 },
  { key: 'movement.turnRate', label: 'Turn Rate', category: 'Movement', unit: 'deg/s', min: 200, max: 1200 },
  { key: 'movement.airControl', label: 'Air Control', category: 'Movement', unit: '', min: 0, max: 1 },
  { key: 'movement.jumpZVelocity', label: 'Jump Velocity', category: 'Movement', unit: 'cm/s', min: 0, max: 800 },
  { key: 'movement.gravityScale', label: 'Gravity Scale', category: 'Movement', unit: 'x', min: 0.5, max: 2.0 },
  // Combat
  { key: 'combat.baseDamage', label: 'Base Damage', category: 'Combat', unit: '', min: 5, max: 80 },
  { key: 'combat.attackSpeed', label: 'Attack Speed', category: 'Combat', unit: '/s', min: 0.3, max: 3.0 },
  { key: 'combat.comboWindowMs', label: 'Combo Window', category: 'Combat', unit: 'ms', min: 100, max: 800 },
  { key: 'combat.hitReactionDuration', label: 'Hit Reaction', category: 'Combat', unit: 's', min: 0.05, max: 1.0 },
  { key: 'combat.critChance', label: 'Crit Chance', category: 'Combat', unit: '%', min: 0, max: 0.5 },
  { key: 'combat.critMultiplier', label: 'Crit Multiplier', category: 'Combat', unit: 'x', min: 1.0, max: 3.0 },
  { key: 'combat.attackRange', label: 'Attack Range', category: 'Combat', unit: 'cm', min: 100, max: 500 },
  { key: 'combat.cleaveAngle', label: 'Cleave Angle', category: 'Combat', unit: 'deg', min: 30, max: 360 },
  // Dodge
  { key: 'dodge.distance', label: 'Dodge Distance', category: 'Dodge', unit: 'cm', min: 200, max: 700 },
  { key: 'dodge.duration', label: 'Dodge Duration', category: 'Dodge', unit: 's', min: 0.1, max: 1.0 },
  { key: 'dodge.iFrameStart', label: 'I-Frame Start', category: 'Dodge', unit: 's', min: 0, max: 0.2 },
  { key: 'dodge.iFrameDuration', label: 'I-Frame Duration', category: 'Dodge', unit: 's', min: 0.05, max: 0.5 },
  { key: 'dodge.cooldown', label: 'Dodge Cooldown', category: 'Dodge', unit: 's', min: 0, max: 2.0 },
  { key: 'dodge.staminaCost', label: 'Dodge Stamina Cost', category: 'Dodge', unit: '', min: 0, max: 50 },
  // Camera
  { key: 'camera.armLength', label: 'Camera Distance', category: 'Camera', unit: 'cm', min: 400, max: 1600 },
  { key: 'camera.lagSpeed', label: 'Camera Lag Speed', category: 'Camera', unit: '', min: 2, max: 20 },
  { key: 'camera.fovBase', label: 'FOV', category: 'Camera', unit: 'deg', min: 50, max: 110 },
  { key: 'camera.fovSprintOffset', label: 'Sprint FOV Boost', category: 'Camera', unit: 'deg', min: 0, max: 15 },
  { key: 'camera.swayMaxRoll', label: 'Sway Roll', category: 'Camera', unit: 'deg', min: 0, max: 5 },
  { key: 'camera.swayInterpSpeed', label: 'Sway Speed', category: 'Camera', unit: '', min: 1, max: 12 },
  // Stamina
  { key: 'staminaDrainPerSec', label: 'Sprint Drain', category: 'Stamina', unit: '/s', min: 0, max: 40 },
  { key: 'staminaRegenPerSec', label: 'Stamina Regen', category: 'Stamina', unit: '/s', min: 0, max: 40 },
];

// ── Utility: get/set nested value ────────────────────────────────────────────

export function getNestedValue(profile: FeelProfile, path: string): number {
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = profile;
  for (const part of parts) {
    obj = obj?.[part];
  }
  return typeof obj === 'number' ? obj : 0;
}

// ── A/B Comparison ───────────────────────────────────────────────────────────

export interface FeelComparison {
  field: string;
  label: string;
  category: string;
  unit: string;
  valueA: number;
  valueB: number;
  delta: number;
  deltaPct: number;
}

export function compareProfiles(a: FeelProfile, b: FeelProfile): FeelComparison[] {
  return FEEL_FIELD_META.map((meta) => {
    const valueA = getNestedValue(a, meta.key);
    const valueB = getNestedValue(b, meta.key);
    const delta = valueB - valueA;
    const deltaPct = valueA !== 0 ? (delta / valueA) * 100 : valueB !== 0 ? 100 : 0;
    return {
      field: meta.key,
      label: meta.label,
      category: meta.category,
      unit: meta.unit,
      valueA,
      valueB,
      delta,
      deltaPct,
    };
  });
}

// ── Radar data for feel profiles ─────────────────────────────────────────────

const FEEL_RADAR_AXES = ['Speed', 'Weight', 'Responsiveness', 'Agility', 'Commitment', 'Impact'];

export function profileToRadar(profile: FeelProfile): { axis: string; value: number }[] {
  const { movement, combat, dodge } = profile;

  const speed = Math.min(movement.maxSprintSpeed / 1000, 1);
  const weight = 1 - Math.min(movement.acceleration / 4500, 1);
  const responsiveness = Math.min(movement.acceleration / 4500, 1);
  const agility = Math.min((dodge.distance / 700 + movement.airControl) / 2, 1);
  const commitment = Math.min((combat.comboWindowMs / 800 + dodge.duration) / 2, 1);
  const impact = Math.min((combat.baseDamage / 60 + combat.hitReactionDuration) / 2, 1);

  return FEEL_RADAR_AXES.map((axis, i) => ({
    axis,
    value: [speed, weight, responsiveness, agility, commitment, impact][i],
  }));
}

// ── AI Prompt Builder ────────────────────────────────────────────────────────

export function buildFeelOptimizerPrompt(feelDescription: string): string {
  const fieldList = FEEL_FIELD_META.map(
    (f) => `  - ${f.key} (${f.label}): ${f.unit} [range: ${f.min}–${f.max}]`
  ).join('\n');

  return `## Task: Character Feel Optimization

The user wants their ARPGCharacterBase to feel like: "${feelDescription}"

Analyze this feel description and generate a complete parameter set for all 30+ tunable UPROPERTY values. Consider genre conventions, player psychology, and how parameters interact with each other.

### Parameters to tune
${fieldList}

### Instructions
1. For each parameter, output the recommended value and a brief rationale explaining WHY this value creates the desired feel.
2. Consider parameter interactions (e.g., high acceleration + low deceleration = floaty; low attack speed + high damage = weighty hits).
3. Reference real games that match the requested feel when explaining choices.
4. Group rationale by category (Movement, Combat, Dodge, Camera, Stamina).

### Output Format
Output valid JSON matching this schema:
{
  "presetName": "<short name for this feel>",
  "description": "<1-2 sentence description>",
  "profile": {
    "movement": {
      "maxWalkSpeed": <number>,
      "maxSprintSpeed": <number>,
      "acceleration": <number>,
      "deceleration": <number>,
      "turnRate": <number>,
      "airControl": <number>,
      "jumpZVelocity": <number>,
      "gravityScale": <number>
    },
    "combat": {
      "baseDamage": <number>,
      "attackSpeed": <number>,
      "comboWindowMs": <number>,
      "hitReactionDuration": <number>,
      "critChance": <number>,
      "critMultiplier": <number>,
      "attackRange": <number>,
      "cleaveAngle": <number>
    },
    "dodge": {
      "distance": <number>,
      "duration": <number>,
      "iFrameStart": <number>,
      "iFrameDuration": <number>,
      "cooldown": <number>,
      "staminaCost": <number>,
      "cancelWindowStart": <number>,
      "cancelWindowEnd": <number>
    },
    "camera": {
      "armLength": <number>,
      "lagSpeed": <number>,
      "fovBase": <number>,
      "fovSprintOffset": <number>,
      "swayMaxRoll": <number>,
      "swayMaxPitch": <number>,
      "swayInterpSpeed": <number>,
      "socketOffsetZ": <number>
    },
    "staminaDrainPerSec": <number>,
    "staminaRegenPerSec": <number>
  },
  "rationale": {
    "<parameterKey>": "<why this value was chosen>"
  }
}`;
}
