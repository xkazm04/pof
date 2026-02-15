import type {
  AttributeSet,
  CombatAbility,
  EnemyArchetype,
  GearLoadout,
  TuningOverrides,
  CombatSimConfig,
} from '@/types/combat-simulator';

// ── Base Player Attributes (Level 1) ────────────────────────────────────────

export const BASE_PLAYER_ATTRIBUTES: AttributeSet = {
  health: 100,
  maxHealth: 100,
  mana: 50,
  maxMana: 50,
  strength: 10,
  dexterity: 8,
  intelligence: 6,
  armor: 5,
  attackPower: 15,
  critChance: 0.05,
  critDamage: 1.5,
};

/** Per-level attribute gains */
export const PLAYER_LEVEL_SCALING: Partial<Record<keyof AttributeSet, number>> = {
  maxHealth: 12,
  health: 12,
  maxMana: 5,
  mana: 5,
  strength: 2,
  dexterity: 1.5,
  intelligence: 1,
  armor: 1.5,
  attackPower: 3,
  critChance: 0.005,
  critDamage: 0.02,
};

// ── Player Abilities (GA_ GameplayAbilities) ────────────────────────────────

export const PLAYER_ABILITIES: CombatAbility[] = [
  {
    id: 'ga-melee-attack',
    name: 'Melee Attack',
    type: 'melee',
    baseDamage: 10,
    attackPowerScaling: 1.0,
    manaCost: 0,
    cooldownSec: 0.8,
    castTimeSec: 0.4,
    range: 200,
    aoeRadius: 0,
  },
  {
    id: 'ga-combo-finisher',
    name: 'Combo Finisher',
    type: 'melee',
    baseDamage: 25,
    attackPowerScaling: 1.4,
    manaCost: 0,
    cooldownSec: 2.0,
    castTimeSec: 0.6,
    range: 250,
    aoeRadius: 0,
  },
  {
    id: 'ga-fireball',
    name: 'Fireball',
    type: 'ranged',
    baseDamage: 35,
    attackPowerScaling: 1.2,
    manaCost: 15,
    cooldownSec: 3.0,
    castTimeSec: 0.8,
    range: 1200,
    aoeRadius: 150,
  },
  {
    id: 'ga-ground-slam',
    name: 'Ground Slam',
    type: 'aoe',
    baseDamage: 30,
    attackPowerScaling: 1.1,
    manaCost: 20,
    cooldownSec: 5.0,
    castTimeSec: 0.7,
    range: 0,
    aoeRadius: 400,
    appliesStun: 1.5,
  },
  {
    id: 'ga-dash-strike',
    name: 'Dash Strike',
    type: 'melee',
    baseDamage: 20,
    attackPowerScaling: 0.9,
    manaCost: 10,
    cooldownSec: 4.0,
    castTimeSec: 0.3,
    range: 600,
    aoeRadius: 100,
    appliesInvulnerable: 0.3,
  },
  {
    id: 'ga-war-cry',
    name: 'War Cry',
    type: 'buff',
    baseDamage: 0,
    attackPowerScaling: 0,
    manaCost: 25,
    cooldownSec: 15.0,
    castTimeSec: 0.5,
    range: 0,
    aoeRadius: 0,
    appliesBuff: { attribute: 'attackPower', amount: 15, durationSec: 15 },
  },
  {
    id: 'ga-dodge',
    name: 'Dodge Roll',
    type: 'dodge',
    baseDamage: 0,
    attackPowerScaling: 0,
    manaCost: 0,
    cooldownSec: 2.0,
    castTimeSec: 0.4,
    range: 0,
    aoeRadius: 0,
    appliesInvulnerable: 0.5,
  },
];

// ── Enemy Archetypes ────────────────────────────────────────────────────────

export const ENEMY_ARCHETYPES: EnemyArchetype[] = [
  {
    id: 'melee-grunt',
    name: 'Forest Grunt',
    baseAttributes: {
      health: 60, maxHealth: 60,
      mana: 0, maxMana: 0,
      strength: 6, dexterity: 4, intelligence: 2,
      armor: 3, attackPower: 8,
      critChance: 0.02, critDamage: 1.3,
    },
    levelScaling: {
      maxHealth: 10, health: 10,
      armor: 1, attackPower: 2,
      strength: 1,
    },
    abilities: [
      {
        id: 'ga-enemy-melee',
        name: 'Enemy Swing',
        type: 'melee',
        baseDamage: 8,
        attackPowerScaling: 0.8,
        manaCost: 0,
        cooldownSec: 0,
        castTimeSec: 0.5,
        range: 200,
        aoeRadius: 0,
      },
    ],
    attackIntervalSec: 1.8,
    aggroRange: 600,
    xpReward: 25,
  },
  {
    id: 'ranged-caster',
    name: 'Dark Mage',
    baseAttributes: {
      health: 40, maxHealth: 40,
      mana: 80, maxMana: 80,
      strength: 3, dexterity: 5, intelligence: 10,
      armor: 1, attackPower: 12,
      critChance: 0.08, critDamage: 1.6,
    },
    levelScaling: {
      maxHealth: 7, health: 7,
      attackPower: 3, intelligence: 2,
      critChance: 0.005,
    },
    abilities: [
      {
        id: 'ga-enemy-ranged',
        name: 'Shadow Bolt',
        type: 'ranged',
        baseDamage: 15,
        attackPowerScaling: 1.1,
        manaCost: 10,
        cooldownSec: 0,
        castTimeSec: 0.8,
        range: 800,
        aoeRadius: 0,
      },
    ],
    attackIntervalSec: 2.5,
    aggroRange: 800,
    xpReward: 35,
  },
  {
    id: 'brute',
    name: 'Stone Brute',
    baseAttributes: {
      health: 150, maxHealth: 150,
      mana: 0, maxMana: 0,
      strength: 14, dexterity: 2, intelligence: 1,
      armor: 10, attackPower: 18,
      critChance: 0.01, critDamage: 1.2,
    },
    levelScaling: {
      maxHealth: 25, health: 25,
      armor: 3, attackPower: 4,
      strength: 2,
    },
    abilities: [
      {
        id: 'ga-enemy-charge',
        name: 'Charge Attack',
        type: 'melee',
        baseDamage: 30,
        attackPowerScaling: 1.3,
        manaCost: 0,
        cooldownSec: 6.0,
        castTimeSec: 1.0,
        range: 500,
        aoeRadius: 200,
      },
      {
        id: 'ga-enemy-brute-swing',
        name: 'Heavy Swing',
        type: 'melee',
        baseDamage: 15,
        attackPowerScaling: 0.9,
        manaCost: 0,
        cooldownSec: 0,
        castTimeSec: 0.7,
        range: 250,
        aoeRadius: 0,
      },
    ],
    attackIntervalSec: 2.8,
    aggroRange: 500,
    xpReward: 60,
  },
  {
    id: 'elite-knight',
    name: 'Hollow Knight',
    baseAttributes: {
      health: 200, maxHealth: 200,
      mana: 30, maxMana: 30,
      strength: 12, dexterity: 8, intelligence: 4,
      armor: 15, attackPower: 14,
      critChance: 0.06, critDamage: 1.5,
    },
    levelScaling: {
      maxHealth: 20, health: 20,
      armor: 2.5, attackPower: 3.5,
      strength: 1.5, dexterity: 1,
      critChance: 0.003,
    },
    abilities: [
      {
        id: 'ga-knight-slash',
        name: 'Knight Slash',
        type: 'melee',
        baseDamage: 12,
        attackPowerScaling: 1.0,
        manaCost: 0,
        cooldownSec: 0,
        castTimeSec: 0.5,
        range: 250,
        aoeRadius: 0,
      },
      {
        id: 'ga-knight-shield-bash',
        name: 'Shield Bash',
        type: 'melee',
        baseDamage: 8,
        attackPowerScaling: 0.6,
        manaCost: 0,
        cooldownSec: 5.0,
        castTimeSec: 0.3,
        range: 200,
        aoeRadius: 0,
        appliesStun: 1.0,
      },
    ],
    attackIntervalSec: 2.0,
    aggroRange: 600,
    xpReward: 80,
  },
];

// ── Gear Loadouts ───────────────────────────────────────────────────────────

export const GEAR_LOADOUTS: GearLoadout[] = [
  {
    id: 'starter',
    name: 'Starter Gear',
    bonuses: { attackPower: 3, armor: 2, maxHealth: 10, health: 10 },
  },
  {
    id: 'mid-tier',
    name: 'Mid-Tier Set',
    bonuses: { attackPower: 10, armor: 8, maxHealth: 40, health: 40, critChance: 0.03, critDamage: 0.2 },
  },
  {
    id: 'endgame',
    name: 'Endgame Set',
    bonuses: { attackPower: 25, armor: 18, maxHealth: 100, health: 100, critChance: 0.08, critDamage: 0.5, mana: 30, maxMana: 30 },
  },
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    bonuses: { attackPower: 35, critChance: 0.12, critDamage: 0.8, maxHealth: -20, health: -20, armor: -3 },
  },
  {
    id: 'tank',
    name: 'Tank Build',
    bonuses: { armor: 25, maxHealth: 80, health: 80, attackPower: 5, critChance: -0.02 },
  },
];

// ── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_TUNING: TuningOverrides = {
  playerHealthMul: 1.0,
  playerDamageMul: 1.0,
  playerArmorMul: 1.0,
  enemyHealthMul: 1.0,
  enemyDamageMul: 1.0,
  critMultiplierMul: 1.0,
  armorEffectivenessWeight: 1.0,
  healingMul: 1.0,
};

export const DEFAULT_CONFIG: CombatSimConfig = {
  iterations: 1000,
  seed: 42,
  maxFightDurationSec: 120,
};
