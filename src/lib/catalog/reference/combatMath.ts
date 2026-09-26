import { timingLaw } from '@/lib/catalog/reference/behaviourScale';

export type Difficulty = 'normal' | 'nightmare' | 'hell';
export type GameMode = 'single' | 'multi';
export type Element = 'physical' | 'magic' | 'fire' | 'lightning' | 'acid';
export type PlayerClass = 'Warrior' | 'Rogue' | 'Sorcerer';
export type WeaponType = 'sword' | 'mace' | 'bow' | 'axe' | 'staff' | 'other';
export type WeaponGraphic = 'unarmed' | 'unarmedShield' | 'sword' | 'swordShield' | 'bow' | 'axe' | 'mace' | 'maceShield' | 'staff';
export type FastAttackTier = 'none' | 'quick' | 'fast' | 'faster' | 'fastest';
export type HitRecoveryTier = 'none' | 'fast' | 'faster' | 'fastest';
export interface IntegerRange { min: number; max: number }
export interface ElementFlags { magic?: boolean; fire?: boolean; lightning?: boolean; acid?: boolean }
export interface Resistances { magic: number; fire: number; lightning: number }
export interface ActionAnimation { frames: number; actionFrame: number }
export interface ClassAnimations {
  attack: Record<WeaponGraphic, ActionAnimation>;
  cast: ActionAnimation;
  block: { frames: number };
  hitRecovery: { frames: number };
}
export interface ActionTiming { frames: number; actionFrame: number; ticks: number; seconds: number }
export interface DurationTiming { frames: number; ticks: number; seconds: number }
export interface ClassCoefficients {
  classFlags: readonly string[];
  baseStrength: number; baseMagic: number; baseDexterity: number; baseVitality: number;
  maxStrength: number; maxMagic: number; maxDexterity: number; maxVitality: number;
  blockBonus: number;
  lifeAdjustment: number; manaAdjustment: number; lifePerLevel: number; manaPerLevel: number;
  lifePerBaseVitality: number; manaPerBaseMagic: number;
  lifePerItemVitality: number; manaPerItemMagic: number;
  baseMagicToHit: number; baseMeleeToHit: number; baseRangedToHit: number;
}
export interface PlayerBuild {
  class: PlayerClass; level: number;
  strength: number; magic: number; dexterity: number; vitality: number;
  weaponDamage: IntegerRange; weaponType: WeaponType;
  /** Equipment armour and magical armour bonus; Dexterity / 5 is derived by the combat law. */
  armourClass: number; toHitBonusPercent: number; damageBonusPercent: number; flatDamage: number;
  hasShield: boolean; blockEnabled: boolean; resistances: Resistances; armourPiercing: number;
  weaponGraphic?: WeaponGraphic; swingSeconds?: number;
  tripleDemonDamage?: boolean; zeroResistance?: boolean;
}
export interface MonsterProfile {
  /** Hit-point bounds after the game-mode and difficulty transform, in whole-point units. */
  level: number; hitPoints: IntegerRange; armourClass: number; toHit: number; damage: IntegerRange;
  monsterClass: 'undead' | 'demon' | 'animal'; resist: ElementFlags; immune: ElementFlags;
  difficulty: Difficulty; gameMode?: GameMode; possibleToHit?: boolean; petrified?: boolean;
  /** True when an adapter has already applied the engine difficulty transforms. */
  difficultyAdjusted?: boolean;
}
export interface DamageDistribution {
  /** All damage fields use the engine's six-fractional-bit unit: 64 = one hit point. */
  min: number; max: number; mean: number; expectedNumerator: number; expectedDenominator: number;
  outcomes: readonly { damage: number; weight: number }[];
}

export const FIXED_POINT = 64;
const UINT32_MAX = 2 ** 32 - 1;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const div = (n: number, d: number) => Math.trunc(n / d);
const monsterLevel = (m: MonsterProfile) => m.level + (m.difficultyAdjusted ? 0 : m.difficulty === 'nightmare' ? 15 : m.difficulty === 'hell' ? 30 : 0);
const monsterToHit = (m: MonsterProfile) => m.toHit + (m.difficultyAdjusted ? 0 : m.difficulty === 'nightmare' ? 85 : m.difficulty === 'hell' ? 120 : 0);
const monsterArmourClass = (m: MonsterProfile) => m.armourClass + (m.difficultyAdjusted ? 0 : m.difficulty === 'nightmare' ? 50 : m.difficulty === 'hell' ? 80 : 0);
const playerArmour = (p: PlayerBuild) => p.armourClass + div(p.dexterity, 5);
const flag = (flags: ElementFlags, element: Element) => element === 'physical' ? false : flags[element] === true;
const floorChance = (dungeonLevel: number, fallback: number) => dungeonLevel === 16 ? 30 : dungeonLevel === 15 ? 25 : dungeonLevel === 14 ? 20 : fallback;

function checkedFrames(frames: number, owner: string): number {
  if (!Number.isInteger(frames) || frames < 1) throw new Error(`${owner} frames must be a positive integer (got ${frames})`);
  return frames;
}

function checkedAction(animation: ActionAnimation, owner: string): ActionAnimation {
  const frames = checkedFrames(animation.frames, owner);
  if (!Number.isInteger(animation.actionFrame) || animation.actionFrame < 1 || animation.actionFrame > frames) {
    throw new Error(`${owner} action frame must be within 1..${frames} (got ${animation.actionFrame})`);
  }
  return { frames, actionFrame: animation.actionFrame };
}

/** Implements canon law `d1-hero-attack-timing-law` for an attack that includes its first frame. */
export function attackTiming(
  classAnimations: Pick<ClassAnimations, 'attack'>,
  weaponGraphic: WeaponGraphic,
  fastAttackTier: FastAttackTier = 'none',
): ActionTiming {
  const animation = checkedAction(classAnimations.attack[weaponGraphic], `${weaponGraphic} attack`);
  const ordinarySkips: Record<FastAttackTier, number> = { none: 0, quick: 1, fast: 2, faster: 3, fastest: 4 };
  const bowSkips: Record<FastAttackTier, number> = { none: 0, quick: 1, fast: 2, faster: 0, fastest: 0 };
  const skipped = (weaponGraphic === 'bow' ? bowSkips : ordinarySkips)[fastAttackTier];
  const ticks = checkedFrames(animation.frames - skipped, `${weaponGraphic} attack after ${fastAttackTier} skipping`);
  return { ...animation, ticks, seconds: ticks / timingLaw().ticksPerSecond };
}

/** Implements canon law `d1-hero-casting-timing-law`. */
export function castTiming(classAnimations: Pick<ClassAnimations, 'cast'>): ActionTiming & { releaseTicks: number; releaseSeconds: number } {
  const animation = checkedAction(classAnimations.cast, 'cast');
  const ticks = animation.frames;
  const ticksPerSecond = timingLaw().ticksPerSecond;
  return {
    ...animation,
    ticks,
    seconds: ticks / ticksPerSecond,
    releaseTicks: animation.actionFrame,
    releaseSeconds: animation.actionFrame / ticksPerSecond,
  };
}

/** Implements canon law `d1-hero-block-timing-law`. */
export function blockTiming(classAnimations: Pick<ClassAnimations, 'block'>, fastBlock = false): DurationTiming {
  const declaredFrames = checkedFrames(classAnimations.block.frames, 'block');
  const frames = fastBlock ? Math.min(2, declaredFrames) : declaredFrames;
  const ticks = frames * 3 - 2;
  return { frames: declaredFrames, ticks, seconds: ticks / timingLaw().ticksPerSecond };
}

/** Implements the hero portion of canon law `d1-combat-hit-recovery-law`. */
export function hitRecoveryTiming(classAnimations: Pick<ClassAnimations, 'hitRecovery'>, tier: HitRecoveryTier = 'none'): DurationTiming {
  const frames = checkedFrames(classAnimations.hitRecovery.frames, 'hit recovery');
  const skipped: Record<HitRecoveryTier, number> = { none: 0, fast: 1, faster: 2, fastest: 3 };
  const ticks = checkedFrames(frames - skipped[tier], `hit recovery after ${tier} skipping`);
  return { frames, ticks, seconds: ticks / timingLaw().ticksPerSecond };
}

/** Implements canon law `d1-combat-monster-hp-law`; returned bounds are in whole-point units. */
export function monsterHitPoints(
  base: IntegerRange,
  difficulty: Difficulty,
  gameMode: GameMode = 'single',
  options: { hellfire?: boolean } = {},
): IntegerRange {
  const modeBounds = gameMode === 'single'
    ? { min: Math.max(base.min / 2, 1), max: Math.max(base.max / 2, 1) }
    : { ...base };
  if (difficulty === 'normal') return modeBounds;
  const scale = difficulty === 'nightmare' ? 3 : 4;
  const multiplayerBonus = difficulty === 'nightmare' ? 100 : 200;
  const bonus = options.hellfire && gameMode === 'single' ? multiplayerBonus / 2 : multiplayerBonus;
  return { min: scale * modeBounds.min + bonus, max: scale * modeBounds.max + bonus };
}

function distribution(entries: readonly (readonly [damage: number, weight: number])[]): DamageDistribution {
  const active = entries.filter(([, weight]) => weight > 0);
  const denominator = active.reduce((sum, [, weight]) => sum + weight, 0);
  if (denominator === 0) return { min: 0, max: 0, mean: 0, expectedNumerator: 0, expectedDenominator: 1, outcomes: [] };
  const numerator = active.reduce((sum, [damage, weight]) => sum + damage * weight, 0);
  return {
    min: Math.min(...active.map(([damage]) => damage)), max: Math.max(...active.map(([damage]) => damage)),
    mean: numerator / denominator, expectedNumerator: numerator, expectedDenominator: denominator,
    outcomes: active.map(([damage, weight]) => ({ damage, weight })),
  };
}
function classDamage(p: PlayerBuild): number {
  return p.class === 'Rogue' ? div(p.level * (p.strength + p.dexterity), 200) : div(p.level * p.strength, 100);
}
function targetWeaponModifier(damage: number, weapon: WeaponType, target: MonsterProfile['monsterClass']): number {
  if ((target === 'undead' && weapon === 'sword') || (target === 'animal' && weapon === 'mace')) return damage - div(damage, 2);
  if ((target === 'undead' && weapon === 'mace') || (target === 'animal' && weapon === 'sword')) return damage + div(damage, 2);
  return damage;
}

/** Implements canon law `d1-combat-melee-to-hit-law`. */
export function playerMeleeHitChance(p: PlayerBuild, c: ClassCoefficients, m: MonsterProfile): number {
  if (m.possibleToHit === false) return 0;
  const percent = clamp(p.level + div(p.dexterity, 2) + p.toHitBonusPercent + c.baseMeleeToHit + p.armourPiercing - monsterArmourClass(m), 5, 95);
  return m.petrified ? 1 : percent / 100;
}

/** Implements canon law `d1-combat-ranged-to-hit-law`. */
export function playerRangedHitChance(p: PlayerBuild, c: ClassCoefficients, m: MonsterProfile, distance: number, element: Element = 'physical'): number {
  if (m.possibleToHit === false || flag(m.immune, element)) return 0;
  const percent = clamp(p.level + p.dexterity + p.toHitBonusPercent + c.baseRangedToHit + p.armourPiercing - monsterArmourClass(m) - div(distance * distance, 2), 5, 95);
  return m.petrified ? 1 : percent / 100;
}

/** Implements canon law `d1-spell-cast-law`. */
export function playerSpellHitChance(p: PlayerBuild, c: ClassCoefficients, m: MonsterProfile, distance: number, element: Element = 'magic'): number {
  if (m.possibleToHit === false || flag(m.immune, element)) return 0;
  const percent = clamp(p.magic + c.baseMagicToHit - 2 * monsterLevel(m) - distance, 5, 95);
  return m.petrified ? 1 : percent / 100;
}

/** Implements canon law `d1-combat-monster-melee-to-hit-law`. */
export function monsterMeleeHitChance(p: PlayerBuild, m: MonsterProfile, dungeonLevel: number, family: 'ordinary' | 'magma' | 'storm' = 'ordinary'): number {
  const familyToHit = family === 'magma' ? 10 : family === 'storm' ? -20 : 0;
  const threshold = Math.max(monsterToHit(m) + familyToHit + 2 * (monsterLevel(m) - p.level) + 30 - playerArmour(p), floorChance(dungeonLevel, 15));
  return clamp(threshold, 0, 100) / 100;
}

/** Implements canon law `d1-combat-monster-ranged-to-hit-law`. */
export function monsterRangedHitChance(p: PlayerBuild, m: MonsterProfile, opts: { distance: number; dungeonLevel: number; projectile: 'arrow' | 'magic'; monsterSource?: boolean }): number {
  const level = monsterLevel(m);
  const threshold = opts.monsterSource === false
    ? opts.projectile === 'arrow' ? 100 - div(playerArmour(p), 2) - 2 * opts.distance : 40
    : opts.projectile === 'arrow' ? monsterToHit(m) + 2 * (level - p.level) + 30 - 2 * opts.distance - playerArmour(p) : 40 + 2 * level - 2 * p.level - 2 * opts.distance;
  return clamp(Math.max(threshold, floorChance(opts.dungeonLevel, 10)), 0, 100) / 100;
}

/** Implements canon law `d1-combat-player-melee-damage-law`. */
export function playerMeleeDamage(p: PlayerBuild, c: ClassCoefficients, m: MonsterProfile): DamageDistribution {
  const critical = c.classFlags.includes('CriticalStrike') ? clamp(p.level, 0, 100) : 0;
  const entries: Array<readonly [number, number]> = [];
  for (let roll = p.weaponDamage.min; roll <= p.weaponDamage.max; roll++) {
    const base = roll + div(roll * p.damageBonusPercent, 100) + p.flatDamage + classDamage(p);
    for (const [criticalDamage, weight] of [[base, 100 - critical], [base * 2, critical]] as const) {
      let damage = targetWeaponModifier(criticalDamage, p.weaponType, m.monsterClass);
      if (m.monsterClass === 'demon' && p.tripleDemonDamage) damage *= 3;
      entries.push([damage * FIXED_POINT, weight]);
    }
  }
  return distribution(entries);
}

/** Implements canon law `d1-combat-player-ranged-damage-law`. */
export function playerRangedDamage(p: PlayerBuild, m: MonsterProfile): DamageDistribution {
  const modifier = p.class === 'Rogue' ? classDamage(p) : div(classDamage(p), 2);
  const entries: Array<readonly [number, number]> = [];
  for (let roll = p.weaponDamage.min; roll <= p.weaponDamage.max; roll++) {
    let damage = p.flatDamage + roll + div(roll * p.damageBonusPercent, 100) + modifier;
    if (m.monsterClass === 'demon' && p.tripleDemonDamage) damage *= 3;
    entries.push([damage * FIXED_POINT, 1]);
  }
  return distribution(entries);
}

/** Implements canon law `d1-combat-monster-damage-law`. */
export function monsterDamageByDifficulty(m: MonsterProfile, input: number | { playerGetHit?: number; family?: 'ordinary' | 'magma' | 'storm'; baseBounds?: IntegerRange; attack?: 'melee' | 'projectile'; trap?: boolean } = 0): { bounds: IntegerRange; damage: DamageDistribution } {
  const playerGetHit = typeof input === 'number' ? input : input.playerGetHit ?? 0;
  const family = typeof input === 'number' ? 'ordinary' : input.family ?? 'ordinary';
  const attack = typeof input === 'number' ? 'melee' : input.attack ?? 'melee';
  const baseBounds = typeof input === 'number' ? m.damage : input.baseBounds ?? m.damage;
  const transform = (bound: number) => m.difficultyAdjusted ? bound : m.difficulty === 'nightmare' ? 2 * (bound + 2) : m.difficulty === 'hell' ? 4 * bound + 6 : bound;
  const adjustment = family === 'magma' ? -2 : family === 'storm' ? 4 : 0;
  const bounds = { min: transform(baseBounds.min) + adjustment, max: transform(baseBounds.max) + adjustment };
  const entries: Array<readonly [number, number]> = [];
  const scale = attack === 'melee' ? FIXED_POINT : 1;
  for (let roll = bounds.min * scale; roll <= bounds.max * scale; roll++) {
    let damage = attack === 'projectile' ? roll * FIXED_POINT : roll;
    if (typeof input !== 'number' && input.trap) damage = Math.floor(damage / 2);
    entries.push([Math.max(damage + playerGetHit * FIXED_POINT, FIXED_POINT), 1]);
  }
  return { bounds, damage: distribution(entries) };
}

export interface BlockOutcome { rollConsumed: boolean; conditionalBlockChance: number; attackMissChance: number; blockedChance: number; damagingHitChance: number }
/** Implements canon law `d1-combat-block-law`. */
export function blockProbability(p: PlayerBuild, c: ClassCoefficients, attacker: MonsterProfile | number, hitChance: number, opts: { kind: 'melee' | 'missile'; playerMode?: 'standing' | 'attacking' | 'other'; monsterSource?: boolean; resistance?: number; alreadyShifted?: boolean; acidPuddle?: boolean }): BlockOutcome {
  const eligible = p.hasShield && p.blockEnabled && (opts.playerMode === undefined || opts.playerMode === 'standing' || opts.playerMode === 'attacking');
  const attackerLevel = typeof attacker === 'number' ? attacker : monsterLevel(attacker);
  let chance = eligible ? clamp(p.dexterity + c.blockBonus + (opts.monsterSource === false ? 0 : 2 * p.level - 2 * attackerLevel), 0, 100) / 100 : 0;
  if (opts.kind === 'missile' && (opts.alreadyShifted || opts.acidPuddle || (opts.resistance ?? 0) > 0)) chance = 0;
  const hit = clamp(hitChance, 0, 1);
  return { rollConsumed: eligible, conditionalBlockChance: chance, attackMissChance: 1 - hit, blockedChance: hit * chance, damagingHitChance: hit * (1 - chance) };
}

/** Implements canon law `d1-combat-player-resistance-law`. */
export function playerResistance(p: PlayerBuild, damage: number, element: Element): { values: Resistances; resistance: number; damage: number } {
  const values = p.zeroResistance ? { magic: 0, fire: 0, lightning: 0 } : {
    magic: clamp(p.resistances.magic, 0, 75), fire: clamp(p.resistances.fire, 0, 75), lightning: clamp(p.resistances.lightning, 0, 75),
  };
  const resistance = element === 'fire' ? values.fire : element === 'lightning' ? values.lightning : element === 'magic' || element === 'acid' ? values.magic : 0;
  return { values, resistance, damage: damage - div(damage * resistance, 100) };
}

/** Implements canon law `d1-resistance-law`. */
export function monsterResistance(m: MonsterProfile, damage: number, element: Element): { immune: boolean; resistant: boolean; damage: number } {
  const immune = flag(m.immune, element);
  const resistant = !immune && flag(m.resist, element);
  return { immune, resistant, damage: immune ? 0 : resistant ? Math.floor(damage / 4) : damage };
}

/** Implements canon law `d1-combat-hit-recovery-law`. */
export function hitRecovery(p: PlayerBuild, m: MonsterProfile, damage: number, opts: { forcePlayer?: boolean; recovery?: 'none' | 'fast' | 'faster' | 'fastest'; monsterFamily?: 'sneak' | 'stalker' | 'unseen' | 'illusion-weaver' | 'other'; resistantMissile?: boolean } = {}) {
  const points = Math.floor(damage / FIXED_POINT);
  const hardHit = opts.monsterFamily !== undefined && opts.monsterFamily !== 'other' || points >= monsterLevel(m) + 3;
  return {
    player: { starts: opts.forcePlayer === true || points >= p.level, skippedFrames: opts.recovery === 'fastest' ? 3 : opts.recovery === 'faster' ? 2 : opts.recovery === 'fast' ? 1 : 0 },
    monster: { hardHit, playsHitSound: true, startsAnimation: hardHit && !m.petrified && !opts.resistantMissile },
  };
}

export interface PoolOptions { bonusVitality?: number; bonusMagic?: number; flatItemLife?: number; flatItemMana?: number; noMana?: boolean }
/** Implements canon law `d1-combat-life-mana-law`; returned pool values are fixed-point integers. */
export function lifeAndMana(p: PlayerBuild, c: ClassCoefficients, items: PoolOptions = {}) {
  const baseLife = c.lifeAdjustment + c.lifePerLevel * p.level + c.lifePerBaseVitality * p.vitality;
  const baseMana = c.manaAdjustment + c.manaPerLevel * p.level + c.manaPerBaseMagic * p.magic;
  const lifeItems = (items.flatItemLife ?? 0) + Math.floor((items.bonusVitality ?? 0) * c.lifePerItemVitality / FIXED_POINT) * FIXED_POINT;
  const manaItems = (items.flatItemMana ?? 0) + Math.floor((items.bonusMagic ?? 0) * c.manaPerItemMagic / FIXED_POINT) * FIXED_POINT;
  const maximumLife = clamp(baseLife + lifeItems, FIXED_POINT, 2000 * FIXED_POINT);
  const maximumMana = clamp(baseMana + manaItems, 0, 2000 * FIXED_POINT);
  return {
    baseLife, baseMana, maximumLife, maximumMana,
    currentLife: Math.min(baseLife + lifeItems, maximumLife), currentMana: Math.min(baseMana + manaItems, maximumMana),
    afterLevelUp: { baseLife: baseLife + c.lifePerLevel, baseMana: baseMana + c.manaPerLevel, maximumLife: maximumLife + c.lifePerLevel, maximumMana: maximumMana + c.manaPerLevel, currentLife: maximumLife + c.lifePerLevel, currentMana: items.noMana ? Math.min(baseMana + manaItems, maximumMana) : maximumMana + c.manaPerLevel },
  };
}

export interface ExperienceCurveLaw { thresholds: readonly number[]; maxLevel: number; threshold: (level: number) => number | undefined }
/** Implements canon law `d1-xp-curve-law`. */
export function experienceCurveLaw(records: readonly { level: number | 'MaxLevel'; experience: number }[]): ExperienceCurveLaw {
  const thresholds: number[] = [];
  for (const record of records) {
    if (record.level === 'MaxLevel') continue;
    if (!Number.isInteger(record.level) || record.level < 1 || record.level > 255) throw new Error(`experience level must be in 1..255 (got ${record.level})`);
    while (thresholds.length < record.level) thresholds.push(UINT32_MAX);
    thresholds[record.level - 1] = record.experience;
  }
  const maxLevel = Math.min(thresholds.length, 255);
  return { thresholds, maxLevel, threshold: (level) => level > 0 ? thresholds[Math.min(level - 1, maxLevel)] : 0 };
}

export interface ExperienceAwardInput { baseExperience: number; difficulty: Difficulty; unique?: boolean; whoHitMask: number; localPlayerBit: number; playerLevel: number; monsterLevel: number; dead?: boolean; multiplayer?: boolean; totalExperience: number; curve: ExperienceCurveLaw }
/** Implements canon law `d1-xp-award-law`. */
export function experienceAward(input: ExperienceAwardInput) {
  let award = input.difficulty === 'nightmare' ? 2 * (input.baseExperience + 1000) : input.difficulty === 'hell' ? 4 * (input.baseExperience + 1000) : input.baseExperience;
  if (input.unique) award *= 2;
  let bits = input.whoHitMask >>> 0;
  let contributors = 0;
  while (bits !== 0) { contributors += bits & 1; bits >>>= 1; }
  const share = contributors === 0 ? 0 : div(award, contributors);
  const adjustedMonsterLevel = input.monsterLevel + (input.difficulty === 'nightmare' ? 15 : input.difficulty === 'hell' ? 30 : 0);
  let scaled = clamp(Math.trunc(share * (1 + (adjustedMonsterLevel - input.playerLevel) / 10)), 0, UINT32_MAX);
  const eligible = contributors > 0 && (input.whoHitMask & input.localPlayerBit) !== 0 && !input.dead && input.playerLevel < input.curve.maxLevel;
  if (!eligible) scaled = 0;
  const next = input.curve.threshold(input.playerLevel) ?? UINT32_MAX;
  if (input.multiplayer) scaled = Math.min(scaled, div(next, 20), 200 * input.playerLevel);
  const maxTotal = input.curve.threshold(input.curve.maxLevel) ?? UINT32_MAX;
  const granted = Math.min(scaled, Math.max(0, maxTotal - input.totalExperience));
  const totalExperience = input.totalExperience + granted;
  let level = input.playerLevel;
  while (level < input.curve.maxLevel && totalExperience >= (input.curve.threshold(level) ?? UINT32_MAX)) level++;
  return { difficultyAward: award, contributors, share, scaled, granted, totalExperience, level };
}
