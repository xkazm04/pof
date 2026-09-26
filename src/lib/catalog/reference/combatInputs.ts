import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { effectiveUnique } from '@/lib/catalog/reference/uniqueMonsters';
import {
  FIXED_POINT,
  attackTiming,
  monsterHitPoints,
  type ClassAnimations,
  type ClassCoefficients,
  type Difficulty,
  type ElementFlags,
  type GameMode,
  type MonsterProfile,
  type PlayerBuild,
  type PlayerClass,
  type WeaponGraphic,
  type WeaponType,
} from '@/lib/catalog/reference/combatMath';
/*
 * The class table stores life/mana coefficients in whole points. combatMath deliberately
 * keeps pools in the engine's six-bit fixed-point representation, so this adapter is the
 * one boundary that shifts those table inputs into the module's units.
 */
type PoolCoefficientKey =
  | 'lifeAdjustment' | 'manaAdjustment' | 'lifePerLevel' | 'manaPerLevel'
  | 'lifePerBaseVitality' | 'manaPerBaseMagic' | 'lifePerItemVitality' | 'manaPerItemMagic';

const fixedAt = (data: Record<string, unknown>, key: PoolCoefficientKey, owner: string) =>
  numberAt(data, key, owner) * FIXED_POINT;

const VANILLA_CLASSES: Record<string, PlayerClass> = {
  warrior: 'Warrior',
  rogue: 'Rogue',
  sorcerer: 'Sorcerer',
};

/** Resolve the combat CLI's opt-in multiplayer flag; vanilla single-player is the default. */
export function combatGameMode(args: readonly string[]): GameMode {
  return args.includes('--multiplayer') ? 'multi' : 'single';
}

function numberAt(data: Record<string, unknown>, key: string, owner: string): number {
  const value = Number(data[key]);
  if (!Number.isFinite(value)) throw new Error(`${owner} has no numeric data.${key}`);
  return value;
}

function recordAt(data: Record<string, unknown>, key: string, owner: string): Record<string, unknown> {
  const value = data[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${owner} has no object data.${key}`);
  return value as Record<string, unknown>;
}

function animationAt(data: Record<string, unknown>, key: string, owner: string): { frames: number; actionFrame: number } {
  const animation = recordAt(data, key, owner);
  return { frames: numberAt(animation, 'frames', `${owner}.${key}`), actionFrame: numberAt(animation, 'actionFrame', `${owner}.${key}`) };
}

function statAt(wrapper: ReferenceWrapper, label: string): number {
  const stats = wrapper.entity.data.stats;
  if (!Array.isArray(stats)) throw new Error(`${wrapper.entity.id} has no data.stats list`);
  const entry = stats.find((item): item is { label: string; value: unknown } =>
    item != null && typeof item === 'object' && (item as { label?: unknown }).label === label);
  const value = Number(entry?.value);
  if (!Number.isFinite(value)) throw new Error(`${wrapper.entity.id} has no numeric data.stats[${label}]`);
  return value;
}

function classOf(wrapper: ReferenceWrapper): PlayerClass {
  const match = /^d1-class-(.+)$/.exec(wrapper.entity.id);
  const playerClass = match ? VANILLA_CLASSES[match[1].toLowerCase()] : undefined;
  if (playerClass) return playerClass;
  if (match && ['monk', 'bard', 'barbarian'].includes(match[1].toLowerCase())) {
    throw new Error(`${wrapper.entity.id} is a Hellfire class; combat reference builds are vanilla Diablo I only`);
  }
  throw new Error(`${wrapper.entity.id} is not a vanilla d1-class-<folder> wrapper`);
}

/** Translate one vanilla class wrapper without retaining any source-table values in code. */
export function classCoefficients(classWrapper: ReferenceWrapper): ClassCoefficients {
  if (classWrapper.catalogId !== 'characters') throw new Error(`${classWrapper.entity.id} is not a characters wrapper`);
  classOf(classWrapper);
  const data = classWrapper.entity.data;
  const owner = classWrapper.entity.id;
  const flags = data.classFlags;
  if (!Array.isArray(flags) || flags.some((flag) => typeof flag !== 'string')) {
    throw new Error(`${owner} has no string data.classFlags list`);
  }
  return {
    classFlags: flags as string[],
    baseStrength: numberAt(data, 'baseStrength', owner),
    baseMagic: numberAt(data, 'baseMagic', owner),
    baseDexterity: numberAt(data, 'baseDexterity', owner),
    baseVitality: numberAt(data, 'baseVitality', owner),
    maxStrength: numberAt(data, 'maxStrength', owner),
    maxMagic: numberAt(data, 'maxMagic', owner),
    maxDexterity: numberAt(data, 'maxDexterity', owner),
    maxVitality: numberAt(data, 'maxVitality', owner),
    blockBonus: numberAt(data, 'blockBonus', owner),
    lifeAdjustment: fixedAt(data, 'lifeAdjustment', owner),
    manaAdjustment: fixedAt(data, 'manaAdjustment', owner),
    lifePerLevel: fixedAt(data, 'lifePerLevel', owner),
    manaPerLevel: fixedAt(data, 'manaPerLevel', owner),
    lifePerBaseVitality: fixedAt(data, 'lifePerBaseVitality', owner),
    manaPerBaseMagic: fixedAt(data, 'manaPerBaseMagic', owner),
    lifePerItemVitality: fixedAt(data, 'lifePerItemVitality', owner),
    manaPerItemMagic: fixedAt(data, 'manaPerItemMagic', owner),
    baseMagicToHit: numberAt(data, 'baseMagicToHit', owner),
    baseMeleeToHit: numberAt(data, 'baseMeleeToHit', owner),
    baseRangedToHit: numberAt(data, 'baseRangedToHit', owner),
  };
}

/** Translate the merged class wrapper's animation tables without retaining source values in code. */
export function classAnimations(classWrapper: ReferenceWrapper): ClassAnimations {
  if (classWrapper.catalogId !== 'characters') throw new Error(`${classWrapper.entity.id} is not a characters wrapper`);
  classOf(classWrapper);
  const owner = classWrapper.entity.id;
  const animations = recordAt(classWrapper.entity.data, 'animations', owner);
  const attackData = recordAt(animations, 'attack', `${owner}.animations`);
  const graphics: WeaponGraphic[] = [
    'unarmed', 'unarmedShield', 'sword', 'swordShield', 'bow', 'axe', 'mace', 'maceShield', 'staff',
  ];
  const attack = Object.fromEntries(graphics.map((graphic) => [
    graphic,
    animationAt(attackData, graphic, `${owner}.animations.attack`),
  ])) as Record<WeaponGraphic, { frames: number; actionFrame: number }>;
  return {
    attack,
    cast: animationAt(animations, 'cast', `${owner}.animations`),
    block: { frames: numberAt(recordAt(animations, 'block', `${owner}.animations`), 'frames', `${owner}.animations.block`) },
    hitRecovery: { frames: numberAt(recordAt(animations, 'hitRecovery', `${owner}.animations`), 'frames', `${owner}.animations.hitRecovery`) },
  };
}

function weaponTypeOf(wrapper: ReferenceWrapper): WeaponType {
  const subtype = String(wrapper.entity.data.subtype ?? '').toLowerCase();
  if (subtype.includes('sword')) return 'sword';
  if (subtype.includes('mace') || subtype.includes('club')) return 'mace';
  if (subtype.includes('bow')) return 'bow';
  if (subtype.includes('axe')) return 'axe';
  if (subtype.includes('staff')) return 'staff';
  return 'other';
}

function weaponGraphicOf(type: WeaponType, hasShield: boolean): WeaponGraphic {
  if (type === 'sword') return hasShield ? 'swordShield' : 'sword';
  if (type === 'mace') return hasShield ? 'maceShield' : 'mace';
  if (type === 'bow' || type === 'axe' || type === 'staff') return type;
  return hasShield ? 'unarmedShield' : 'unarmed';
}

/**
 * A level-L reference hero with BASE attributes: no level-up stat points are spent and no
 * equipment is present, except for the optional weapon wrapper. The no-weapon engine baseline
 * is the verified one-point bare-handed damage roll.
 */
export function referenceBuild(classWrapper: ReferenceWrapper, level: number, weapon?: ReferenceWrapper): PlayerBuild {
  if (!Number.isInteger(level) || level < 1) throw new Error(`character level must be a positive integer (got ${level})`);
  const coefficients = classCoefficients(classWrapper);
  if (weapon && weapon.catalogId !== 'items') throw new Error(`${weapon.entity.id} is not an items wrapper`);
  const weaponDamage = weapon
    ? { min: statAt(weapon, 'Damage Min'), max: statAt(weapon, 'Damage Max') }
    : { min: 1, max: 1 };
  if (weaponDamage.min > weaponDamage.max) throw new Error(`${weapon?.entity.id ?? 'bare hands'} has an inverted damage range`);
  const weaponType = weapon ? weaponTypeOf(weapon) : 'other';
  const weaponGraphic = weaponGraphicOf(weaponType, false);
  const animations = classWrapper.entity.data.animations === undefined ? undefined : classAnimations(classWrapper);
  return {
    class: classOf(classWrapper),
    level,
    strength: coefficients.baseStrength,
    magic: coefficients.baseMagic,
    dexterity: coefficients.baseDexterity,
    vitality: coefficients.baseVitality,
    weaponDamage,
    weaponType,
    weaponGraphic,
    ...(animations ? { swingSeconds: attackTiming(animations, weaponGraphic, 'none').seconds } : {}),
    armourClass: 0,
    toHitBonusPercent: 0,
    damageBonusPercent: 0,
    flatDamage: 0,
    hasShield: false,
    blockEnabled: false,
    resistances: { magic: 0, fire: 0, lightning: 0 },
    armourPiercing: 0,
  };
}

function itemWeaponGraphic(wrapper: ReferenceWrapper): WeaponGraphic | null {
  const effective = wrapper.entity.data.effective;
  const effectiveType = effective && typeof effective === 'object'
    ? (effective as { itemType?: { value?: unknown } }).itemType?.value
    : undefined;
  const itemType = String(effectiveType ?? wrapper.entity.data.subtype ?? wrapper.raw.itemType ?? '').toLowerCase();
  if (itemType.includes('sword')) return 'sword';
  if (itemType.includes('mace') || itemType.includes('club')) return 'mace';
  if (itemType.includes('bow')) return 'bow';
  if (itemType.includes('axe')) return 'axe';
  if (itemType.includes('staff')) return 'staff';
  return null;
}

/**
 * Put class-owned base swing times on weapon entities for their produce-prompt reference values.
 * One-handed weapons use their unshielded graphic; shield variants remain explicit in class data.
 */
export function withClassSwingTimes(
  itemWrappers: readonly ReferenceWrapper[],
  classWrappers: readonly ReferenceWrapper[],
): ReferenceWrapper[] {
  const classByFolder = new Map(classWrappers.flatMap((wrapper) => {
    const match = /^d1-class-(warrior|rogue|sorcerer)$/.exec(wrapper.entity.id);
    return match ? [[match[1], wrapper] as const] : [];
  }));
  return itemWrappers.map((wrapper) => {
    const graphic = itemWeaponGraphic(wrapper);
    if (!graphic) return wrapper;
    const swingSecondsByClass = Object.fromEntries([...classByFolder].map(([folder, classWrapper]) => [
      folder,
      attackTiming(classAnimations(classWrapper), graphic, 'none').seconds,
    ]));
    if (Object.keys(swingSecondsByClass).length === 0) return wrapper;
    const currentDerived = wrapper.entity.data.derived;
    const derived = currentDerived && typeof currentDerived === 'object' && !Array.isArray(currentDerived)
      ? currentDerived as Record<string, unknown>
      : {};
    return {
      ...wrapper,
      entity: {
        ...wrapper.entity,
        data: {
          ...wrapper.entity.data,
          derived: {
            ...derived,
            swingSecondsByClass,
            swingSecondsBasis: `${graphic} class animation, no fast-attack modifier; one-handed weapons are unshielded`,
          },
        },
      },
    };
  });
}

function resistanceFlags(raw: string, prefix: 'RESIST' | 'IMMUNE'): ElementFlags {
  const flags = new Set(raw.split(',').map((flag) => flag.trim().toUpperCase()).filter(Boolean));
  return {
    ...(flags.has(`${prefix}_MAGIC`) ? { magic: true } : {}),
    ...(flags.has(`${prefix}_FIRE`) ? { fire: true } : {}),
    ...(flags.has(`${prefix}_LIGHTNING`) ? { lightning: true } : {}),
    ...(flags.has(`${prefix}_ACID`) ? { acid: true } : {}),
  };
}

/** Translate an ordinary or unique Diablo monster wrapper into the profile consumed by the combat laws. */
export function monsterProfile(
  bestiaryWrapper: ReferenceWrapper,
  difficulty: Difficulty,
  baseWrapperOrMode?: ReferenceWrapper | GameMode,
  gameMode: GameMode = 'single',
): MonsterProfile {
  const baseWrapper = typeof baseWrapperOrMode === 'string' ? undefined : baseWrapperOrMode;
  const selectedMode = typeof baseWrapperOrMode === 'string' ? baseWrapperOrMode : gameMode;
  const isUnique = bestiaryWrapper.catalogId === 'bestiary' && bestiaryWrapper.file === 'monsters/unique_monstdat.tsv';
  if (bestiaryWrapper.catalogId !== 'bestiary' || (!isUnique && bestiaryWrapper.file !== 'monsters/monstdat.tsv')) {
    throw new Error(`${bestiaryWrapper.entity.id} is not a Diablo monster bestiary wrapper`);
  }
  if (!(['normal', 'nightmare', 'hell'] as const).includes(difficulty)) throw new Error(`unknown difficulty ${difficulty}`);
  if (isUnique && !baseWrapper) throw new Error(`${bestiaryWrapper.entity.id} requires its monstdat base wrapper`);
  const categoryOwner = isUnique ? baseWrapper! : bestiaryWrapper;
  const category = String(categoryOwner.entity.data.category ?? '').toLowerCase();
  if (!['undead', 'demon', 'animal'].includes(category)) {
    throw new Error(`${bestiaryWrapper.entity.id} has unknown monster class ${String(categoryOwner.entity.data.category)}`);
  }
  if (isUnique) {
    const effective = effectiveUnique(bestiaryWrapper, baseWrapper!, difficulty, { gameMode: selectedMode });
    const resistance = effective.resistances.value.join(',');
    return {
      level: effective.level.value,
      hitPoints: effective.hitPoints.value,
      armourClass: effective.armorClass.value,
      toHit: effective.toHit.value,
      damage: effective.damage.value,
      monsterClass: category as MonsterProfile['monsterClass'],
      resist: resistanceFlags(resistance, 'RESIST'),
      immune: resistanceFlags(resistance, 'IMMUNE'),
      difficulty,
      gameMode: selectedMode,
      difficultyAdjusted: true,
    };
  }
  const resistance = bestiaryWrapper.raw.resistance ?? '';
  return {
    level: statAt(bestiaryWrapper, 'Level'),
    hitPoints: monsterHitPoints(
      { min: statAt(bestiaryWrapper, 'HP Min'), max: statAt(bestiaryWrapper, 'HP Max') },
      difficulty,
      selectedMode,
    ),
    armourClass: statAt(bestiaryWrapper, 'Armor Class'),
    toHit: statAt(bestiaryWrapper, 'To Hit'),
    damage: { min: statAt(bestiaryWrapper, 'Damage Min'), max: statAt(bestiaryWrapper, 'Damage Max') },
    monsterClass: category as MonsterProfile['monsterClass'],
    resist: resistanceFlags(resistance, 'RESIST'),
    immune: resistanceFlags(resistance, 'IMMUNE'),
    difficulty,
    gameMode: selectedMode,
  };
}
