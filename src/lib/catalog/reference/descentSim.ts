/** Deterministic Diablo I descent expectations assembled from reference wrappers and combat laws. */
import { DIABLO1_SOURCE } from '@/lib/catalog/ingest/diablo1';
import {
  DEFAULT_RANGED_ENGAGEMENT_DISTANCE,
  duel,
  type DuelSpellAttack,
  type PlayerAttackMode,
} from '@/lib/catalog/reference/combatDuel';
import { classAnimations, classCoefficients, monsterProfile, referenceBuild } from '@/lib/catalog/reference/combatInputs';
import {
  attackTiming,
  castTiming,
  experienceAward,
  experienceCurveLaw,
  FIXED_POINT,
  lifeAndMana,
  type Difficulty,
  type ExperienceCurveLaw,
  type GameMode,
  type PlayerBuild,
  type WeaponGraphic,
} from '@/lib/catalog/reference/combatMath';
import { aggregateClassWrappers } from '@/lib/catalog/reference/classHeroes';
import { contentHash } from '@/lib/catalog/reference/hash';
import { D1_AI_ROUTINES, isD1AiRoutineId } from '@/lib/catalog/reference/aiRoutines';
import { locationEntities, type LocationEntityWrapper } from '@/lib/catalog/reference/locationSpecs';
import {
  bestArmourExpectation,
  bestWeaponExpectation,
  expectedLootBudget,
  monsterLootProfile,
  type BestArmourExpectation,
  type BestWeaponExpectation,
  type WeightedLootMonsterProfile,
} from '@/lib/catalog/reference/lootMath';
import { spellSpec } from '@/lib/catalog/reference/spellSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export const DESCENT_CLASSES = ['warrior', 'rogue', 'sorcerer'] as const;
export type DescentClassName = typeof DESCENT_CLASSES[number];
export type StatPointPolicy = 'none' | 'all-strength' | 'balanced';
export type DescentGear = 'none' | 'expected';
export type SorcererCombatPolicy = 'mixed' | 'pure-spell';

/** Explicit non-solid-tile assumption used only when a caller does not provide one. */
export const DEFAULT_TILES_PER_LEVEL_ASSUMPTION = 3_000;

/** Deliberately simple cumulative learned-set policy; these unlock depths are model assumptions, not table rows. */
export const SORCERER_SPELL_PROGRESSION = [
  { learnedAtDepth: 1, spell: 'Firebolt', spellLevel: 1 },
  { learnedAtDepth: 3, spell: 'ChargedBolt', spellLevel: 1 },
  { learnedAtDepth: 5, spell: 'Lightning', spellLevel: 1 },
  { learnedAtDepth: 9, spell: 'Fireball', spellLevel: 1 },
  { learnedAtDepth: 13, spell: 'ChainLightning', spellLevel: 1 },
] as const;

export interface DescentAssumption {
  id: string;
  value: string | number;
  source: string;
  detail: string;
}

export interface DescentMonsterDifficulty {
  monsterId: string;
  monster: string;
  value: number;
}

export interface DescentHardestMonster {
  byLowestHeroHitChance: DescentMonsterDifficulty;
  byHighestExpectedDamageTaken: DescentMonsterDifficulty;
}

export interface DescentLevelResult {
  depth: number;
  poolSize: number;
  expectedMonstersKilled: number;
  /** Present for the mana-aware Sorcerer policy. */
  expectedSpellKills?: number;
  /** Present for the mana-aware Sorcerer policy. */
  expectedMeleeKills?: number;
  expectedXpGained: number;
  heroLevelBefore: number;
  heroLevelAfter: number;
  expectedSecondsToClear: number | null;
  expectedDamageTaken: number | null;
  hardestMonster: DescentHardestMonster;
  note: string;
  /** Omitted for melee to preserve the legacy Warrior result shape. */
  attackMode?: Exclude<PlayerAttackMode, 'melee'>;
  /** Present only when every bounded target at this depth selects the same spell. */
  spellAssumed?: DescentSpellExpectation;
  /** Target-aware spell allocation over bounded kills at this depth. */
  spellsUsed?: DescentSpellUsage[];
  /** Targets for which every learned spell has unbounded time-to-kill. */
  unboundedMonsters?: DescentUnboundedMonster[];
  /** Present only for ranged/spell heroes, preserving the legacy melee result shape. */
  approach?: DescentApproachExpectation;
  /** Present for spell-mode depths, including gear:none where no purchased potions exist. */
  mana?: DescentManaExpectation;
  /** Present only when expected gear is enabled, preserving the gear:none result shape. */
  weaponAssumed?: BestWeaponExpectation;
  /** Present only when expected gear is enabled, preserving the gear:none result shape. */
  armourAssumed?: BestArmourExpectation;
  /** Mean conditional block chance across this depth's eligible monster types. */
  expectedBlockChance?: number;
  /** Present only for expected gear because sustain is funded by expected loot. */
  sustain?: DescentSustainExpectation;
}

export interface SustainArithmeticInput {
  expectedDamageTaken: number;
  lifePool: number;
  healingPotions: number;
  fullHealingPotions: number;
  lifeRestoredPerHealingPotion: number;
}

export interface SustainArithmetic {
  healingSupply: number;
  sustainable: boolean;
  deficit: number;
}

export interface DescentSustainExpectation extends SustainArithmetic {
  expectedGoldDropped: number;
  healingPotionPrice: number;
  healingPotionsDropped: number;
  fullHealingPotionsDropped: number;
  healingPotionsBought: number;
  healingPotionsAvailable: number;
  fullHealingPotionsAvailable: number;
  lifePool: number;
  lifeRestoredPerHealingPotion: number;
  lifeRestoredPerFullHealingPotion: number;
}

export interface ManaSustainArithmeticInput {
  expectedManaSpent: number;
  currentMana: number;
  manaPool: number;
  manaPotions: number;
  fullManaPotions: number;
  manaRestoredPerPotion: number;
}

export interface ManaSustainArithmetic {
  potionManaSupply: number;
  totalManaAvailable: number;
  sustainable: boolean;
  deficit: number;
}

export interface DescentSpellExpectation {
  spell: string;
  spellLevel: number;
  element: string;
  manaPerCast: number;
}

export interface DescentSpellUsage extends DescentSpellExpectation {
  expectedKills: number;
  killShare: number;
}

export interface DescentUnboundedMonster {
  monsterId: string;
  monster: string;
  reason: string;
}

export interface DescentMonsterApproachSpeed {
  monsterId: string;
  monster: string;
  tilesPerSecond: number | null;
  source: 'effective-routine-cadence' | 'while-walking-upper-bound' | 'ranged-monster-holds-range';
}

export interface DescentApproachExpectation {
  engagementDistance: number;
  expectedFreeActionsPerKill: number;
  freeShotShare: number;
  monsterSpeeds: DescentMonsterApproachSpeed[];
}

export interface DescentManaExpectation {
  expectedManaSpent: number | null;
  currentManaAtStart: number;
  manaPool: number;
  expectedGoldAllocated: number;
  manaPotionPrice: number | null;
  manaPotionsDropped: number;
  fullManaPotionsDropped: number;
  manaPotionsBought: number;
  manaPotionsAvailable: number;
  fullManaPotionsAvailable: number;
  manaRestoredPerPotion: number;
  manaRestoredPerFullPotion: number;
  potionManaSupply: number;
  totalManaAvailable: number;
  sustainable: boolean;
  deficit: number | null;
}

export interface DescentSimulation {
  model: 'deterministic-expectation';
  className: DescentClassName;
  policy: StatPointPolicy;
  gameMode: GameMode;
  difficulty: Difficulty;
  weaponId: string | null;
  /** Omitted for the legacy Warrior default. */
  attackMode?: Exclude<PlayerAttackMode, 'melee'>;
  /** Present for the default mana-aware Sorcerer policy; omitted by legacy pure-spell output. */
  sorcererCombatPolicy?: 'mixed';
  /** Present for the expected-loot model (the Rogue/Sorcerer default unless gear:none is explicit). */
  gear?: 'expected';
  assumptions: DescentAssumption[];
  levels: DescentLevelResult[];
}

export interface SimulateDescentInput {
  className: DescentClassName;
  policy: StatPointPolicy;
  tilesPerLevel?: number;
  gameMode: GameMode;
  difficulty: Difficulty;
  weapon?: ReferenceWrapper;
  gear?: DescentGear;
  /** Sorcerer defaults to finite-mana mixed combat; pure-spell preserves the comparison model. */
  sorcererCombatPolicy?: SorcererCombatPolicy;
  /** Source rows are passed in; the simulator never reads a database or filesystem. */
  wrappers: readonly ReferenceWrapper[];
  /** Tests and other pure callers may pass already-projected location entities. */
  locations?: readonly LocationEntityWrapper[];
}

export interface MixedKillCandidate {
  id: string;
  expectedKills: number;
  manaPerKill: number;
  secondsSavedPerKill: number;
  lifeSavedPerKill: number;
}

export interface MixedKillAllocation extends MixedKillCandidate {
  spellKills: number;
  manaSpent: number;
}

function compareMixedCandidates(left: MixedKillCandidate, right: MixedKillCandidate): number {
  const leftSavesTime = left.secondsSavedPerKill > 0;
  const rightSavesTime = right.secondsSavedPerKill > 0;
  if (leftSavesTime !== rightSavesTime) return leftSavesTime ? -1 : 1;
  const leftEfficiency = (leftSavesTime ? left.secondsSavedPerKill : left.lifeSavedPerKill) / left.manaPerKill;
  const rightEfficiency = (rightSavesTime ? right.secondsSavedPerKill : right.lifeSavedPerKill) / right.manaPerKill;
  return rightEfficiency - leftEfficiency
    || (right.lifeSavedPerKill / right.manaPerKill) - (left.lifeSavedPerKill / left.manaPerKill)
    || left.manaPerKill - right.manaPerKill
    || left.id.localeCompare(right.id);
}

/**
 * Spend a fixed start-of-depth mana budget on the best per-target spell option. Positive time
 * saved per mana ranks first; when casting does not save time, positive life saved per mana is
 * the fallback. Stable id order is the final tie-break. Fractional kills remain expectations.
 */
export function allocateMixedSpellKills(
  candidates: readonly MixedKillCandidate[],
  totalManaAvailable: number,
): MixedKillAllocation[] {
  if (!Number.isFinite(totalManaAvailable) || totalManaAvailable < 0) {
    throw new Error(`totalManaAvailable must be a non-negative finite number (got ${totalManaAvailable})`);
  }
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.expectedKills) || candidate.expectedKills < 0) {
      throw new Error(`${candidate.id}.expectedKills must be a non-negative finite number`);
    }
    if (!Number.isFinite(candidate.manaPerKill) || candidate.manaPerKill <= 0) {
      throw new Error(`${candidate.id}.manaPerKill must be a positive finite number`);
    }
    if (!Number.isFinite(candidate.secondsSavedPerKill) || !Number.isFinite(candidate.lifeSavedPerKill)) {
      throw new Error(`${candidate.id} savings must be finite numbers`);
    }
  }
  let manaRemaining = totalManaAvailable;
  return [...candidates]
    .filter((candidate) => candidate.secondsSavedPerKill > 0 || candidate.lifeSavedPerKill > 0)
    .sort(compareMixedCandidates)
    .map((candidate) => {
      const spellKills = Math.min(candidate.expectedKills, manaRemaining / candidate.manaPerKill);
      const manaSpent = spellKills * candidate.manaPerKill;
      manaRemaining = Math.max(0, manaRemaining - manaSpent);
      return { ...candidate, spellKills, manaSpent };
    });
}

const ATTRIBUTE_KEYS = ['strength', 'magic', 'dexterity', 'vitality'] as const;
type AttributeKey = typeof ATTRIBUTE_KEYS[number];

function numericStat(wrapper: ReferenceWrapper, label: string): number {
  const stats = wrapper.entity.data.stats;
  const entry = Array.isArray(stats)
    ? stats.find((item) => item && typeof item === 'object' && (item as { label?: unknown }).label === label)
    : undefined;
  const value = Number((entry as { value?: unknown } | undefined)?.value);
  if (!Number.isFinite(value)) throw new Error(`${wrapper.entity.id} has no numeric data.stats[${label}]`);
  return value;
}

function curveFrom(wrappers: readonly ReferenceWrapper[]): ExperienceCurveLaw {
  const aggregate = wrappers.find((wrapper) =>
    wrapper.catalogId === 'progression-curves' && Array.isArray(wrapper.entity.data.levels));
  const records = aggregate
    ? (aggregate.entity.data.levels as { level?: unknown; experience?: unknown }[]).map((row) => ({
        level: Number(row.level),
        experience: Number(row.experience),
      }))
    : wrappers.filter((wrapper) => wrapper.catalogId === 'progression-curves').map((wrapper) => ({
        level: wrapper.entity.data.level === 'MaxLevel' ? 'MaxLevel' as const : Number(wrapper.entity.data.level),
        experience: Number(wrapper.entity.data.experienceToReach),
      }));
  const usable = records.filter((row): row is { level: number | 'MaxLevel'; experience: number } =>
    (row.level === 'MaxLevel' || Number.isInteger(row.level)) && Number.isFinite(row.experience));
  const curve = experienceCurveLaw(usable);
  if (curve.maxLevel === 0) throw new Error('the supplied wrappers have no usable Diablo I XP curve');
  return curve;
}

function classWrapperFrom(wrappers: readonly ReferenceWrapper[], className: DescentClassName): ReferenceWrapper {
  const classes = aggregateClassWrappers(wrappers.filter((wrapper) => wrapper.catalogId === 'characters'));
  const classWrapper = classes.find((wrapper) => wrapper.entity.id === `d1-class-${className}`);
  if (!classWrapper) throw new Error(`the supplied wrappers have no d1-class-${className} aggregate`);
  // An empty source flag cell maps to an absent optional field; combat coefficients need its
  // equivalent empty list. Sorcerer has no class combat flag in the vanilla attributes row.
  if (classWrapper.entity.data.classFlags !== undefined) return classWrapper;
  return {
    ...classWrapper,
    entity: {
      ...classWrapper.entity,
      data: { ...classWrapper.entity.data, classFlags: [] },
    },
  };
}

/**
 * Item enum ids a class loadout names whose itemdat.tsv row carries no `id` cell: the engine
 * resolves them by enum ordinal (= row index). Engine constants, Source/tables/itemdat.h:81-82
 * (IDI_RUNEOFSTONE = 165, IDI_SORCERER_DIABLO follows) — the vanilla Sorcerer's starting staff.
 */
const ITEM_ENUM_ROWS: Readonly<Record<string, number>> = { IDI_SORCERER_DIABLO: 166 };

function startingWeaponFrom(
  classWrapper: ReferenceWrapper,
  wrappers: readonly ReferenceWrapper[],
): ReferenceWrapper {
  const loadout = classWrapper.entity.data.startingLoadout;
  const itemIds = loadout && typeof loadout === 'object' && !Array.isArray(loadout)
    ? (loadout as { itemIds?: unknown }).itemIds
    : undefined;
  if (!Array.isArray(itemIds)) throw new Error(`${classWrapper.entity.id} has no startingLoadout.itemIds list`);
  for (const itemId of itemIds) {
    if (typeof itemId !== 'string') continue;
    const enumRow = ITEM_ENUM_ROWS[itemId.toUpperCase()];
    const item = wrappers.find((candidate) => candidate.file === 'items/itemdat.tsv'
      && (String(candidate.raw.id).toLowerCase() === itemId.toLowerCase()
        || String(candidate.entity.data.id).toLowerCase() === itemId.toLowerCase()))
      ?? (enumRow === undefined ? undefined
        : wrappers.find((candidate) => candidate.file === 'items/itemdat.tsv' && candidate.key === `row${enumRow}`));
    if (!item) continue;
    if (referenceBuild(classWrapper, 1, item).weaponType !== 'other') return item;
  }
  throw new Error(`${classWrapper.entity.id} has no supplied starting-loadout weapon`);
}

function allocateStats(build: PlayerBuild, policy: StatPointPolicy, maxima: Record<AttributeKey, number>): PlayerBuild {
  if (policy === 'none') return build;
  let remaining = Math.max(0, (build.level - 1) * 5);
  const allocated = { ...build };
  if (policy === 'all-strength') {
    allocated.strength += Math.min(remaining, Math.max(0, maxima.strength - allocated.strength));
    return allocated;
  }
  while (remaining > 0) {
    let spent = false;
    for (const key of ATTRIBUTE_KEYS) {
      if (remaining === 0) break;
      if (allocated[key] >= maxima[key]) continue;
      allocated[key]++;
      remaining--;
      spent = true;
    }
    if (!spent) break;
  }
  return allocated;
}

function levelAt(totalExperience: number, currentLevel: number, curve: ExperienceCurveLaw): number {
  let level = currentLevel;
  while (level < curve.maxLevel && totalExperience >= (curve.threshold(level) ?? Number.MAX_SAFE_INTEGER)) level++;
  return level;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

/** Nominal-bin mean of Player::RestorePartialLife, expressed in whole life points. */
export function expectedHealingPotionLife(className: DescentClassName, maximumLife: number): number {
  if (!Number.isFinite(maximumLife) || maximumLife < 0) throw new Error(`maximumLife must be non-negative (got ${maximumLife})`);
  const wholeLife = Math.floor(maximumLife);
  const randomOutcomes = Math.floor(wholeLife / 4);
  const baseMean = Math.floor(wholeLife / 8) + (randomOutcomes > 0 ? (randomOutcomes - 1) / 2 : 0);
  if (className === 'warrior') return baseMean * 2;
  if (className === 'rogue') return baseMean * 1.5;
  return baseMean;
}

/** Nominal-bin mean of Player::RestorePartialMana, expressed in whole mana points. */
export function expectedManaPotionMana(className: DescentClassName, maximumMana: number): number {
  if (!Number.isFinite(maximumMana) || maximumMana < 0) throw new Error(`maximumMana must be non-negative (got ${maximumMana})`);
  const wholeMana = Math.floor(maximumMana);
  const randomOutcomes = Math.floor(wholeMana / 4);
  const baseMean = Math.floor(wholeMana / 8) + (randomOutcomes > 0 ? (randomOutcomes - 1) / 2 : 0);
  if (className === 'sorcerer') return baseMean * 2;
  if (className === 'rogue') return baseMean * 1.5;
  return baseMean;
}

/** Pure life-plus-potions budget used by each expected-gear depth. */
export function sustainArithmetic(input: SustainArithmeticInput): SustainArithmetic {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number (got ${value})`);
  }
  const healingSupply = input.healingPotions * input.lifeRestoredPerHealingPotion
    + input.fullHealingPotions * input.lifePool;
  const deficit = Math.max(0, input.expectedDamageTaken - input.lifePool - healingSupply);
  return {
    healingSupply,
    sustainable: input.expectedDamageTaken <= input.lifePool + healingSupply,
    deficit,
  };
}

/** Pure carried-mana-plus-potions budget; potions are consumed just in time, avoiding cap waste. */
export function manaSustainArithmetic(input: ManaSustainArithmeticInput): ManaSustainArithmetic {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number (got ${value})`);
  }
  const potionManaSupply = input.manaPotions * input.manaRestoredPerPotion
    + input.fullManaPotions * input.manaPool;
  const totalManaAvailable = input.currentMana + potionManaSupply;
  const deficit = Math.max(0, input.expectedManaSpent - totalManaAvailable);
  return {
    potionManaSupply,
    totalManaAvailable,
    sustainable: input.expectedManaSpent <= totalManaAvailable,
    deficit,
  };
}

function consumablePrice(
  wrappers: readonly ReferenceWrapper[],
  miscId: 'HEAL' | 'MANA',
  label: 'Healing' | 'Mana',
): number {
  const candidates = wrappers.filter((wrapper) =>
    wrapper.file === 'items/itemdat.tsv' && String(wrapper.raw.miscId).toUpperCase() === miscId);
  const base = candidates.find((wrapper) => Number(wrapper.raw.dropRate) <= 0) ?? candidates[0];
  if (!base) throw new Error(`the supplied item wrappers have no ${label} potion base`);
  const price = numericStat(base, 'Value');
  if (!(price > 0)) throw new Error(`${base.entity.id} has a non-positive ${label} potion value`);
  return price;
}

function sorcererSpellAttacks(wrappers: readonly ReferenceWrapper[], depth: number): DuelSpellAttack[] {
  const learned = SORCERER_SPELL_PROGRESSION.filter((entry) => depth >= entry.learnedAtDepth);
  if (learned.length === 0) throw new Error(`the Sorcerer spell policy has no learned spell for depth ${depth}`);
  return learned.map((policy) => {
    const wrapper = wrappers.find((candidate) => candidate.file === 'spells/spelldat.tsv'
      && String(candidate.raw.id).toLowerCase() === policy.spell.toLowerCase());
    if (!wrapper) throw new Error(`the supplied spell wrappers have no ${policy.spell} row`);
    const read = (key: 'manaCost' | 'manaMultiplier' | 'minMana') => {
      const value = Number(wrapper.raw[key]);
      if (!Number.isFinite(value)) throw new Error(`${wrapper.entity.id} has no numeric raw.${key}`);
      return value;
    };
    return {
      spell: policy.spell,
      spellLevel: policy.spellLevel,
      baseMana: read('manaCost'),
      manaAdj: read('manaMultiplier'),
      minMana: read('minMana'),
    };
  });
}

interface MonsterExchangeModel {
  monsterAttack: 'melee' | 'ranged-arrow' | 'ranged-magic';
  approachTilesPerSecond?: number;
  speed: DescentMonsterApproachSpeed;
}

function monsterExchangeModel(wrapper: ReferenceWrapper): MonsterExchangeModel {
  const rawDerived = wrapper.entity.data.derived;
  const derived = rawDerived && typeof rawDerived === 'object' && !Array.isArray(rawDerived)
    ? rawDerived as Record<string, unknown>
    : {};
  const attackKinds = Array.isArray(derived.attackKinds)
    ? derived.attackKinds.filter((kind): kind is string => typeof kind === 'string')
    : [];
  if (attackKinds.includes('missile')) {
    const ai = wrapper.file === 'monsters/unique_monstdat.tsv'
      ? wrapper.raw.ai
      : wrapper.entity.tags?.[0];
    const missiles = ai && isD1AiRoutineId(ai)
      ? D1_AI_ROUTINES[ai].attacks.filter((attack) => attack.kind === 'missile').map((attack) => attack.missile)
      : [];
    const arrow = missiles.length > 0 && missiles.every((missile) => missile === 'Arrow');
    return {
      monsterAttack: arrow ? 'ranged-arrow' : 'ranged-magic',
      speed: {
        monsterId: wrapper.entity.id,
        monster: wrapper.entity.name,
        tilesPerSecond: null,
        source: 'ranged-monster-holds-range',
      },
    };
  }
  const effective = Number(derived.tilesPerSecond);
  if (Number.isFinite(effective) && effective > 0) {
    return {
      monsterAttack: 'melee',
      approachTilesPerSecond: effective,
      speed: {
        monsterId: wrapper.entity.id,
        monster: wrapper.entity.name,
        tilesPerSecond: effective,
        source: 'effective-routine-cadence',
      },
    };
  }
  const rawLocomotion = derived.locomotion;
  const locomotion = rawLocomotion && typeof rawLocomotion === 'object' && !Array.isArray(rawLocomotion)
    ? rawLocomotion as Record<string, unknown>
    : {};
  const whileWalking = Number(locomotion.tilesPerSecondWhileWalking);
  if (Number.isFinite(whileWalking) && whileWalking > 0) {
    return {
      monsterAttack: 'melee',
      approachTilesPerSecond: whileWalking,
      speed: {
        monsterId: wrapper.entity.id,
        monster: wrapper.entity.name,
        tilesPerSecond: whileWalking,
        source: 'while-walking-upper-bound',
      },
    };
  }
  throw new Error(`${wrapper.entity.id} has no effective or while-walking approach speed`);
}

function shieldGraphic(build: PlayerBuild): WeaponGraphic {
  if (build.weaponType === 'sword') return 'swordShield';
  if (build.weaponType === 'mace') return 'maceShield';
  return 'unarmedShield';
}

function weaponPermitsShield(build: PlayerBuild, weapon: ReferenceWrapper | undefined): boolean {
  if (!weapon) return true;
  const equipType = String(weapon.raw.equipType ?? weapon.entity.data.equipType ?? '').toLowerCase();
  if (equipType === 'two-handed') return false;
  return build.weaponType !== 'bow' && build.weaponType !== 'axe' && build.weaponType !== 'staff';
}

function consumeHealing(
  healingPotions: number,
  fullHealingPotions: number,
  needed: number,
  healingPotionLife: number,
  fullHealingPotionLife: number,
): { healingPotions: number; fullHealingPotions: number } {
  let remaining = needed;
  let partial = healingPotions;
  let full = fullHealingPotions;
  if (remaining > 0 && healingPotionLife > 0) {
    const consumed = Math.min(partial, remaining / healingPotionLife);
    partial -= consumed;
    remaining -= consumed * healingPotionLife;
  }
  if (remaining > 0 && fullHealingPotionLife > 0) {
    const consumed = Math.min(full, remaining / fullHealingPotionLife);
    full -= consumed;
  }
  return { healingPotions: Math.max(0, partial), fullHealingPotions: Math.max(0, full) };
}

function consumeMana(
  currentMana: number,
  manaPotions: number,
  fullManaPotions: number,
  needed: number,
  manaPotionRestoration: number,
  fullManaPotionRestoration: number,
): { currentMana: number; manaPotions: number; fullManaPotions: number } {
  let remaining = needed;
  let mana = currentMana;
  let partial = manaPotions;
  let full = fullManaPotions;
  const fromPool = Math.min(mana, remaining);
  mana -= fromPool;
  remaining -= fromPool;
  if (remaining > 0 && manaPotionRestoration > 0) {
    const consumed = Math.min(partial, remaining / manaPotionRestoration);
    partial -= consumed;
    remaining -= consumed * manaPotionRestoration;
  }
  if (remaining > 0 && fullManaPotionRestoration > 0) {
    const consumed = Math.min(full, remaining / fullManaPotionRestoration);
    full -= consumed;
  }
  return {
    currentMana: Math.max(0, mana),
    manaPotions: Math.max(0, partial),
    fullManaPotions: Math.max(0, full),
  };
}

function hardest(
  rows: readonly { wrapper: ReferenceWrapper; playerHitChance: number; expectedDamageTaken: number }[],
): DescentHardestMonster {
  const hit = [...rows].sort((a, b) =>
    a.playerHitChance - b.playerHitChance || b.expectedDamageTaken - a.expectedDamageTaken ||
    a.wrapper.entity.id.localeCompare(b.wrapper.entity.id))[0];
  const damage = [...rows].sort((a, b) =>
    b.expectedDamageTaken - a.expectedDamageTaken || a.playerHitChance - b.playerHitChance ||
    a.wrapper.entity.id.localeCompare(b.wrapper.entity.id))[0];
  return {
    byLowestHeroHitChance: {
      monsterId: hit.wrapper.entity.id,
      monster: hit.wrapper.entity.name,
      value: hit.playerHitChance,
    },
    byHighestExpectedDamageTaken: {
      monsterId: damage.wrapper.entity.id,
      monster: damage.wrapper.entity.name,
      value: damage.expectedDamageTaken,
    },
  };
}

function assumptions(
  tilesPerLevel: number,
  policy: StatPointPolicy,
  gear: DescentGear,
  className: DescentClassName,
  sorcererCombatPolicy: SorcererCombatPolicy,
): DescentAssumption[] {
  return [
    {
      id: 'non-solid-tiles-per-level',
      value: tilesPerLevel,
      source: 'explicit caller assumption (the reference data has no per-level non-solid tile count)',
      detail: `Ambient population is floor(${tilesPerLevel} / 30); this value is an ASSUMPTION, not a Diablo table value.`,
    },
    {
      id: 'eligible-type-mixture',
      value: 'uniform mean over eligible ordinary monster types',
      source: 'd1-monster-type-selection plus zone-map spawns links',
      detail: 'The expectation averages type-level outcomes equally; it does not sample a game seed or claim the linked candidate pool is one generated roster.',
    },
    {
      id: 'unique-placement',
      value: 'eligible uniques reported but excluded from totals',
      source: 'd1-unique-placement',
      detail: 'A unique requires its base type in the actually registered roster and may depend on quest availability; neither event is fixed by a candidate-pool expectation.',
    },
    {
      id: 'stat-point-policy',
      value: policy,
      source: 'five points per completed hero level; class maxima from the supplied class wrapper',
      detail: policy === 'balanced'
        ? 'Balanced spends points round-robin in Strength, Magic, Dexterity, Vitality order, skipping capped attributes.'
        : policy === 'all-strength'
          ? 'All-strength spends only into Strength up to the class maximum; excess points remain unspent.'
          : 'No level-up stat points are spent.',
    },
    {
      id: 'duel-exchange',
      value: className === 'warrior'
        ? 'hero attacks first; one melee counterattack between hero swings'
        : 'hero attacks first; one melee counterattack between hero actions',
      source: 'combatDuel.duel expectations',
      detail: className === 'warrior'
        ? 'Expected damage per kill is (expected hero swings - 1) × expected monster damage per swing. Monster travel, AI delays, ranged spacing, healing, and simultaneous packs are outside this duel model.'
        : 'Melee monsters do no damage during their approach, then counter between adjacent hero actions. Missile-capable routines counter at the engagement distance. Healing and simultaneous packs are outside this duel model.',
    },
    ...(className === 'rogue' ? [
      {
        id: 'class-attack-mode',
        value: 'ranged bow attack',
        source: 'd1-combat-ranged-to-hit-law, d1-combat-player-ranged-damage-law, and Rogue bow animation data',
        detail: 'Rogue uses ranged to-hit and damage; expected gear considers bows only. An explicit fixed weapon remains a caller override for its damage inputs.',
      },
      {
        id: 'ranged-engagement-distance',
        value: DEFAULT_RANGED_ENGAGEMENT_DISTANCE,
        source: 'explicit combatDuel model parameter; the reference laws do not prescribe one fixed duel separation',
        detail: 'The monster starts four tiles away; adjacency is one tile away. A melee monster traverses the three-tile gap while the Rogue shoots without counterattacks.',
      },
    ] : []),
    ...(className === 'sorcerer' ? [
      {
        id: 'class-attack-mode',
        value: sorcererCombatPolicy === 'mixed' ? 'mana-aware mixed spell/melee' : 'spell casting',
        source: sorcererCombatPolicy === 'mixed'
          ? 'd1-spell-cast-law, spellMath, Sorcerer cast animation data, starting loadout, and weapon attack timing'
          : 'd1-spell-cast-law, spellMath, and Sorcerer cast animation data',
        detail: sorcererCombatPolicy === 'mixed'
          ? 'Sorcerer casts only within the finite start-of-depth mana budget and uses the best expected wieldable weapon for every remaining kill. Spell to-hit always uses effective distance 0.'
          : 'Sorcerer uses spell to-hit at the engagement distance, exact one-collision spell damage, class casting time, and mana per cast.',
      },
      {
        id: 'sorcerer-spell-progression',
        value: 'Firebolt L1 at depth 1; Charged Bolt L1 at 3; Lightning L1 at 5; Fireball L1 at 9; Chain Lightning L1 at 13; learned spells remain available',
        source: 'explicit cumulative depth schedule; book acquisition timing is not resolved by the deterministic type-mixture model',
        detail: sorcererCombatPolicy === 'mixed'
          ? 'Every learned damaging spell and the melee fallback are evaluated per monster. The spell saving the most time per mana wins for that target; if none saves time, life saved per mana is used. Targets are then funded in the same order, with lower mana and stable ids breaking ties.'
          : 'At each depth, every learned damaging spell is evaluated against each monster. Lowest expected time-to-kill wins; expected mana per kill and then schedule order break ties.',
      },
      {
        id: 'spell-damage-event',
        value: 'one collision damage roll per cast',
        source: 'spellMath.damage definition and d1-spell-firebolt-law/d1-spell-fireball-law',
        detail: 'The duel counts one target collision per cast. Fireball blast geometry and its possible second hit, packs, piercing, walls, and projectile travel are omitted.',
      },
      {
        id: 'mana-recovery',
        value: 'no passive regeneration; level-up refill applied before the next depth',
        source: 'd1-spell-cast-law, d1-combat-life-mana-law, and d1-instant-potion-restoration',
        detail: sorcererCombatPolicy === 'mixed'
          ? 'The casting budget is the mana pool at depth start plus carried and newly bought mana potions. Current-depth drops become carried supply afterward. A level gained refills mana before the next depth. Shrines are ignored.'
          : 'Unspent mana and potions carry forward. A level gained during a depth refills mana for the next depth; within-depth kill order is not modelled. Shrines are ignored.',
      },
    ] : []),
    ...(className !== 'warrior' ? [
      {
        id: 'ranged-approach-speed',
        value: 'per-monster effective tiles/second, falling back to the while-walking upper bound',
        source: 'bestiary data.derived.tilesPerSecond and data.derived.locomotion.tilesPerSecondWhileWalking',
        detail: 'Each depth reports the source used for every monster. Free actions are complete attack/cast cycles during the travel time from the engagement distance to adjacency.',
      },
      {
        id: 'ranged-monster-exchange',
        value: 'a routine whose attackKinds includes missile holds range and counters with ranged to-hit',
        source: 'bestiary data.derived.attackKinds and d1-combat-monster-ranged-to-hit-law',
        detail: 'Arrow-only routines use arrow to-hit; other missile routines use magic-projectile to-hit. Their AI retreat/circle geometry and projectile travel time remain outside the duel.',
      },
    ] : []),
    {
      id: 'clear-time',
      value: 'sum of duel time-to-kill; zero travel time',
      source: 'combatDuel.duel expectedPlayerSecondsToKill',
      detail: 'Every ambient kill is fought sequentially; navigation, doors, loot, recovery, and downtime add no seconds.',
    },
    ...(gear === 'expected' ? [
      {
        id: 'expected-loot-weapon',
        value: className === 'rogue'
          ? 'conservative expected best bow before each depth'
          : className === 'sorcerer' && sorcererCombatPolicy === 'mixed'
            ? 'conservative expected best melee weapon before each depth, retaining the starting weapon until improved'
            : 'conservative expected best melee weapon before each depth',
        source: 'pinned monster-drop, base-selection, quality, and affix procedures',
        detail: 'Prior kills form a weighted monster mixture. The model gates bases by the hero\'s current Strength, Magic, and Dexterity, then floors the expected maximum base-damage range and expected positive percentage-damage bonus; unique powers, flat damage, and base/affix correlation are omitted.',
      },
      {
        id: 'expected-loot-armour',
        value: 'conservative expected best body armour, helm, and compatible shield before each depth',
        source: 'pinned monster-drop, base-selection, quality, affix, and equipment procedures',
        detail: 'Each slot independently gates bases by current attributes and floors its expected best base-AC range. The lower bound plus a floored positive percentage-AC bonus enters combat. A shield is carried only with a one-handed or unarmed loadout and a positive conservative shield AC.',
      },
      {
        id: 'sustain-income',
        value: 'monster gold drops only; no sale value',
        source: 'd1-loot-drop-outcome and d1-loot-gold-consumables',
        detail: className === 'sorcerer'
          ? 'Expected gold and Healing, Full Healing, Mana, and Full Mana potion drops come only from the ambient monsters modelled here. Sale value, containers, useful-object drops, quests, and starting inventory are excluded.'
          : 'Expected gold and Healing/Full Healing potion drops come only from the ambient monsters modelled here. Sale value, containers, useful-object drops, quests, and starting inventory are excluded.',
      },
      {
        id: 'sustain-purchases',
        value: className === 'sorcerer'
          ? 'split expected gold 50/50 between Healing and Mana potions between depths'
          : 'spend all expected gold on Healing potions between depths',
        source: className === 'sorcerer'
          ? 'd1-store-pricing-law and the supplied Healing/Mana potion item wrappers'
          : 'd1-store-pricing-law and the supplied Healing potion item wrapper',
        detail: className === 'sorcerer'
          ? 'Half of prior-depth gold uses Pepin\'s Healing price and half uses Adria\'s Mana price; fractional potion counts are deterministic expectations. Pepin restores life, but not mana, between depths.'
          : 'Gold earned on one depth is divided by Pepin\'s wrapper-derived Healing potion price before the next depth; fractional potion counts are retained as deterministic expectations. Pepin restores the hero to full life between depths at no charge.',
      },
      {
        id: 'sustain-consumption',
        value: 'full life plus carried and same-depth expected potion drops',
        source: 'd1-loot-healing-potions and deterministic budget arithmetic',
        detail: 'Expected drops are treated as available on their floor, so within-floor drop order is omitted. Damage spends the fresh life pool first, then partial potions, then full potions; unused expected potions carry forward.',
      },
      ...(className === 'sorcerer' ? [{
        id: 'mana-sustain-consumption',
        value: 'carried mana plus bought, carried, and same-depth expected mana potion drops',
        source: 'd1-instant-potion-restoration and deterministic budget arithmetic',
        detail: 'Mana is spent before partial and full mana potions. Potions are consumed just in time, so the arithmetic assumes no restoration is wasted at the mana cap; unused expected potions carry forward.',
      }] : []),
    ] : []),
  ];
}

/**
 * Simulate the vanilla depths 1..16 as a deterministic expectation. No random roster, combat roll,
 * or dungeon seed is generated: every per-type quantity is an exact combat-law expectation, then
 * the eligible type pool is averaged and multiplied by the explicit population assumption.
 */
export function simulateDescent(input: SimulateDescentInput): DescentSimulation {
  if (!(DESCENT_CLASSES as readonly string[]).includes(input.className)) throw new Error(`unknown Diablo I class ${input.className}`);
  if (!(['none', 'all-strength', 'balanced'] as const).includes(input.policy)) throw new Error(`unknown stat-point policy ${input.policy}`);
  if (!(['normal', 'nightmare', 'hell'] as const).includes(input.difficulty)) throw new Error(`unknown difficulty ${input.difficulty}`);
  const gear = input.gear ?? (input.className === 'warrior' || input.weapon ? 'none' : 'expected');
  if (!(['none', 'expected'] as const).includes(gear)) throw new Error(`unknown gear policy ${gear}`);
  const sorcererCombatPolicy = input.sorcererCombatPolicy ?? 'mixed';
  if (!(['mixed', 'pure-spell'] as const).includes(sorcererCombatPolicy)) {
    throw new Error(`unknown Sorcerer combat policy ${input.sorcererCombatPolicy}`);
  }
  if (gear === 'expected' && input.weapon) throw new Error('gear:expected cannot be combined with a fixed weapon');
  const tilesPerLevel = input.tilesPerLevel ?? DEFAULT_TILES_PER_LEVEL_ASSUMPTION;
  if (!Number.isInteger(tilesPerLevel) || tilesPerLevel < 0) throw new Error(`tilesPerLevel must be a non-negative integer (got ${tilesPerLevel})`);

  const classWrapper = classWrapperFrom(input.wrappers, input.className);
  const startingWeapon = input.className === 'sorcerer' && sorcererCombatPolicy === 'mixed' && !input.weapon
    ? startingWeaponFrom(classWrapper, input.wrappers)
    : undefined;
  const coefficients = classCoefficients(classWrapper);
  const maxima = {
    strength: coefficients.maxStrength,
    magic: coefficients.maxMagic,
    dexterity: coefficients.maxDexterity,
    vitality: coefficients.maxVitality,
  };
  const curve = curveFrom(input.wrappers);
  const locations = input.locations ?? locationEntities(input.wrappers);
  const bestiary = input.wrappers.filter((wrapper) => wrapper.catalogId === 'bestiary');
  const bestiaryById = new Map(bestiary.map((wrapper) => [wrapper.entity.id, wrapper]));
  const ordinaryByType = new Map(bestiary
    .filter((wrapper) => wrapper.file === 'monsters/monstdat.tsv')
    .map((wrapper) => [wrapper.raw._monster_id, wrapper]));
  const ambientPopulation = Math.floor(tilesPerLevel / 30);
  const maximumExperience = curve.threshold(curve.maxLevel) ?? Number.MAX_SAFE_INTEGER;
  let heroLevel = 1;
  let totalExperience = 0;
  let killsSoFar = 0;
  const lootHistory: WeightedLootMonsterProfile[] = [];
  const levels: DescentLevelResult[] = [];
  const healingPotionPrice = gear === 'expected' ? consumablePrice(input.wrappers, 'HEAL', 'Healing') : 0;
  const manaPotionPrice = gear === 'expected' && input.className === 'sorcerer'
    ? consumablePrice(input.wrappers, 'MANA', 'Mana')
    : 0;
  const healingGoldShare = input.className === 'sorcerer' ? 0.5 : 1;
  const manaGoldShare = input.className === 'sorcerer' ? 0.5 : 0;
  let goldForNextDepth = 0;
  let carriedHealingPotions = 0;
  let carriedFullHealingPotions = 0;
  let currentMana: number | null = null;
  let carriedManaPotions = 0;
  let carriedFullManaPotions = 0;

  for (let depth = 1; depth <= 16; depth++) {
    const location = locations.find((candidate) => candidate.entity.data.depth === depth);
    if (!location) throw new Error(`the supplied locations have no vanilla dungeon depth ${depth}`);
    const spawnIds = (location.entity.links ?? []).filter((link) => link.role === 'spawns').map((link) => link.entityId);
    const uniqueIds = (location.entity.links ?? []).filter((link) => link.role === 'unique').map((link) => link.entityId);
    const pool = spawnIds.map((id) => bestiaryById.get(id)).filter((wrapper): wrapper is ReferenceWrapper => wrapper !== undefined);
    if (pool.length !== spawnIds.length) {
      const missing = spawnIds.filter((id) => !bestiaryById.has(id));
      throw new Error(`depth ${depth} references missing bestiary wrappers: ${missing.join(', ')}`);
    }
    if (pool.length === 0) throw new Error(`depth ${depth} has no eligible ordinary monster pool`);
    const dungeonType = String(location.entity.data.dungeonType);
    const depthLootProfiles: WeightedLootMonsterProfile[] = gear === 'expected'
      ? pool.map((wrapper) => ({
          profile: monsterLootProfile(wrapper, {
            dungeonLevel: depth,
            dungeonType,
            gameMode: input.gameMode,
          }),
          weight: ambientPopulation / pool.length,
        }))
      : [];

    const heroLevelBefore = heroLevel;
    let build = allocateStats(referenceBuild(classWrapper, heroLevelBefore, input.weapon ?? startingWeapon), input.policy, maxima);
    let weaponAssumed: BestWeaponExpectation | undefined;
    let armourAssumed: BestArmourExpectation | undefined;
    let expectedWeaponBase: ReferenceWrapper | undefined;
    if (gear === 'expected') {
      weaponAssumed = bestWeaponExpectation({
        class: build.class,
        depth,
        killsSoFar,
        monsterProfiles: lootHistory,
        itemWrappers: input.wrappers,
        affixWrappers: input.wrappers,
        uniqueItemWrappers: input.wrappers,
        difficulty: input.difficulty,
        strength: build.strength,
        magic: build.magic,
        dexterity: build.dexterity,
        fallbackWeapon: startingWeapon,
      });
      expectedWeaponBase = weaponAssumed.weaponId == null
        ? undefined
        : input.wrappers.find((wrapper) => wrapper.file === 'items/itemdat.tsv' && wrapper.entity.id === weaponAssumed!.weaponId);
      if (weaponAssumed.weaponId != null && !expectedWeaponBase) {
        throw new Error(`expected weapon base ${weaponAssumed.weaponId} is not supplied`);
      }
      if (expectedWeaponBase) {
        const equipped = referenceBuild(classWrapper, heroLevelBefore, expectedWeaponBase);
        build = {
          ...build,
          weaponDamage: weaponAssumed.damage,
          weaponType: equipped.weaponType,
          weaponGraphic: equipped.weaponGraphic,
          swingSeconds: equipped.swingSeconds,
          damageBonusPercent: weaponAssumed.damageBonusPercent,
        };
      }
      const shieldAllowed = weaponPermitsShield(build, expectedWeaponBase);
      armourAssumed = bestArmourExpectation({
        className: build.class,
        depth,
        killsSoFar,
        monsterProfiles: lootHistory,
        itemWrappers: input.wrappers,
        affixWrappers: input.wrappers,
        uniqueItemWrappers: input.wrappers,
        difficulty: input.difficulty,
        strength: build.strength,
        magic: build.magic,
        dexterity: build.dexterity,
        shieldAllowed,
      });
      build = {
        ...build,
        armourClass: armourAssumed.totalArmourClass,
        hasShield: armourAssumed.hasShield,
        blockEnabled: armourAssumed.hasShield,
      };
      if (armourAssumed.hasShield) {
        const weaponGraphic = shieldGraphic(build);
        build = {
          ...build,
          weaponGraphic,
          swingSeconds: attackTiming(classAnimations(classWrapper), weaponGraphic).seconds,
        };
      }
    }
    const loot = gear === 'expected' ? expectedLootBudget({
      monsterProfiles: depthLootProfiles,
      itemWrappers: input.wrappers,
      affixWrappers: input.wrappers,
      uniqueItemWrappers: input.wrappers,
      difficulty: input.difficulty,
    }) : undefined;
    const goldAvailableForPurchases = goldForNextDepth;
    const mixedSorcerer = input.className === 'sorcerer' && sorcererCombatPolicy === 'mixed';
    const manaPool = input.className === 'sorcerer'
      ? lifeAndMana(build, coefficients).maximumMana / FIXED_POINT
      : 0;
    if (input.className === 'sorcerer' && currentMana === null) currentMana = manaPool;
    const currentManaAtStart = currentMana ?? 0;
    const expectedGoldAllocated = input.className === 'sorcerer' && gear === 'expected'
      ? goldAvailableForPurchases * manaGoldShare
      : 0;
    const manaPotionsBought = input.className === 'sorcerer' && gear === 'expected'
      ? expectedGoldAllocated / manaPotionPrice
      : 0;
    const currentDepthManaPotions = sorcererCombatPolicy === 'pure-spell' ? loot?.expectedManaPotions ?? 0 : 0;
    const currentDepthFullManaPotions = sorcererCombatPolicy === 'pure-spell' ? loot?.expectedFullManaPotions ?? 0 : 0;
    const manaPotionsAvailable = carriedManaPotions + manaPotionsBought + currentDepthManaPotions;
    const fullManaPotionsAvailable = carriedFullManaPotions + currentDepthFullManaPotions;
    const manaRestoredPerPotion = input.className === 'sorcerer'
      ? expectedManaPotionMana(input.className, manaPool)
      : 0;
    const startManaBudget = currentManaAtStart
      + manaPotionsAvailable * manaRestoredPerPotion
      + fullManaPotionsAvailable * manaPool;
    const playerAttack: PlayerAttackMode = input.className === 'sorcerer'
      ? 'spell'
      : input.className === 'rogue' || build.weaponType === 'bow' ? 'ranged' : 'melee';
    const learnedSpells = playerAttack === 'spell' ? sorcererSpellAttacks(input.wrappers, depth) : [];
    const playerCastSeconds = playerAttack === 'spell' ? castTiming(classAnimations(classWrapper)).seconds : undefined;
    const evaluatedRows = pool.map((wrapper) => {
      const unique = wrapper.file === 'monsters/unique_monstdat.tsv';
      const base = unique ? ordinaryByType.get(wrapper.raw.type) : undefined;
      if (unique && !base) throw new Error(`${wrapper.entity.id} has no supplied monstdat base ${wrapper.raw.type}`);
      const monster = monsterProfile(wrapper, input.difficulty, base, input.gameMode);
      const exchange = playerAttack === 'melee' ? undefined : monsterExchangeModel(wrapper);
      const runDuel = (attack: PlayerAttackMode, spell?: DuelSpellAttack) => duel(build, coefficients, monster, {
        gameMode: input.gameMode,
        playerAttack: attack,
        engagementDistance: DEFAULT_RANGED_ENGAGEMENT_DISTANCE,
        monsterApproachTilesPerSecond: attack === 'melee' ? undefined : exchange?.approachTilesPerSecond,
        spell,
        playerCastSeconds,
        monsterAttack: exchange?.monsterAttack ?? 'melee',
        monsterDistance: attack === 'melee' ? 1 : DEFAULT_RANGED_ENGAGEMENT_DISTANCE,
        dungeonLevel: depth,
      });
      const damageTaken = (result: ReturnType<typeof runDuel>) => result.expectedMonsterAttacksBeforeKill
        * result.expectedMonsterDamagePerSwing / FIXED_POINT;
      const meleeResult = mixedSorcerer ? runDuel('melee') : undefined;
      const candidates = learnedSpells.map((spell, scheduleIndex) => ({
        spell,
        scheduleIndex,
        result: runDuel('spell', spell),
      }));
      if (mixedSorcerer) {
        candidates.sort((left, right) => compareMixedCandidates({
          id: `${wrapper.entity.id}:${left.scheduleIndex}`,
          expectedKills: 1,
          manaPerKill: left.result.expectedManaSpentPerKill ?? Infinity,
          secondsSavedPerKill: (meleeResult!.expectedPlayerSecondsToKill ?? Infinity)
            - (left.result.expectedPlayerSecondsToKill ?? Infinity),
          lifeSavedPerKill: damageTaken(meleeResult!) - damageTaken(left.result),
        }, {
          id: `${wrapper.entity.id}:${right.scheduleIndex}`,
          expectedKills: 1,
          manaPerKill: right.result.expectedManaSpentPerKill ?? Infinity,
          secondsSavedPerKill: (meleeResult!.expectedPlayerSecondsToKill ?? Infinity)
            - (right.result.expectedPlayerSecondsToKill ?? Infinity),
          lifeSavedPerKill: damageTaken(meleeResult!) - damageTaken(right.result),
        }));
      } else {
        candidates.sort((left, right) => {
          const leftSeconds = left.result.expectedPlayerSecondsToKill ?? Infinity;
          const rightSeconds = right.result.expectedPlayerSecondsToKill ?? Infinity;
          if (leftSeconds !== rightSeconds) {
            if (!Number.isFinite(leftSeconds)) return 1;
            if (!Number.isFinite(rightSeconds)) return -1;
            return leftSeconds - rightSeconds;
          }
          const leftMana = left.result.expectedManaSpentPerKill ?? Infinity;
          const rightMana = right.result.expectedManaSpentPerKill ?? Infinity;
          return leftMana - rightMana || left.scheduleIndex - right.scheduleIndex;
        });
      }
      const selected = playerAttack === 'spell' ? candidates[0] : undefined;
      const result = mixedSorcerer ? meleeResult! : selected?.result ?? runDuel(playerAttack);
      if (result.expectedPlayerSecondsToKill === null) {
        throw new Error(`${classWrapper.entity.id} has no ${playerAttack} timing for ${build.weaponGraphic ?? build.weaponType}`);
      }
      const difficultyLevelBonus = input.difficulty === 'nightmare' ? 15 : input.difficulty === 'hell' ? 30 : 0;
      const xp = experienceAward({
        baseExperience: numericStat(base ?? wrapper, 'XP'),
        difficulty: input.difficulty,
        unique,
        whoHitMask: 1,
        localPlayerBit: 1,
        playerLevel: heroLevelBefore,
        monsterLevel: unique ? monster.level - difficultyLevelBonus : monster.level,
        multiplayer: input.gameMode === 'multi',
        totalExperience,
        curve,
      });
      const expectedDamageTaken = damageTaken(result);
      const conditionalBlockChance = gear === 'expected'
        ? result.monsterConditionalBlockChance
        : 0;
      return {
        wrapper,
        xp: xp.granted,
        seconds: result.expectedPlayerSecondsToKill,
        playerHitChance: result.playerHitChance,
        expectedDamageTaken,
        conditionalBlockChance,
        expectedManaSpent: result.expectedManaSpentPerKill,
        manaPerCast: result.manaPerCast,
        selectedSpell: Number.isFinite(result.expectedPlayerSecondsToKill) ? selected?.spell : undefined,
        unbounded: !Number.isFinite(result.expectedPlayerSecondsToKill),
        expectedPlayerActions: result.expectedPlayerSwingsToKill,
        expectedFreeActions: result.approach?.expectedFreePlayerActions ?? 0,
        approachSpeed: exchange?.speed,
        ...(mixedSorcerer ? { meleeResult: result, spellResult: selected?.result } : {}),
      };
    });
    const divisor = evaluatedRows.length;
    const expectedKillsPerType = ambientPopulation / divisor;
    const mixedAllocations = mixedSorcerer ? allocateMixedSpellKills(evaluatedRows.flatMap((row) => {
      const spellResult = row.spellResult;
      const meleeResult = row.meleeResult;
      const manaPerKill = spellResult?.expectedManaSpentPerKill;
      const spellSeconds = spellResult?.expectedPlayerSecondsToKill;
      const meleeSeconds = meleeResult?.expectedPlayerSecondsToKill;
      if (spellResult === undefined || meleeResult === undefined || manaPerKill === undefined
        || !Number.isFinite(manaPerKill) || !Number.isFinite(spellSeconds) || !Number.isFinite(meleeSeconds)) return [];
      const spellDamage = spellResult.expectedMonsterAttacksBeforeKill
        * spellResult.expectedMonsterDamagePerSwing / FIXED_POINT;
      const meleeDamage = meleeResult.expectedMonsterAttacksBeforeKill
        * meleeResult.expectedMonsterDamagePerSwing / FIXED_POINT;
      return [{
        id: row.wrapper.entity.id,
        expectedKills: expectedKillsPerType,
        manaPerKill,
        secondsSavedPerKill: Number(meleeSeconds) - Number(spellSeconds),
        lifeSavedPerKill: meleeDamage - spellDamage,
      }];
    }), startManaBudget) : [];
    const mixedAllocationByMonster = new Map(mixedAllocations.map((allocation) => [allocation.id, allocation]));
    const expectedSpellKills = mixedAllocations.reduce((sum, allocation) => sum + allocation.spellKills, 0);
    const expectedMeleeKills = ambientPopulation - expectedSpellKills;
    const rows = evaluatedRows.map((row) => {
      if (!mixedSorcerer) return { ...row, spellExpectedKills: row.selectedSpell ? expectedKillsPerType : 0 };
      const allocation = mixedAllocationByMonster.get(row.wrapper.entity.id);
      const spellKills = allocation?.spellKills ?? 0;
      const spellShare = expectedKillsPerType > 0 ? spellKills / expectedKillsPerType : 0;
      const spellResult = row.spellResult;
      const meleeResult = row.meleeResult!;
      const blend = (melee: number, spell: number) => melee * (1 - spellShare) + spell * spellShare;
      const spellDamage = spellResult
        ? spellResult.expectedMonsterAttacksBeforeKill * spellResult.expectedMonsterDamagePerSwing / FIXED_POINT
        : row.expectedDamageTaken;
      return {
        ...row,
        seconds: spellResult?.expectedPlayerSecondsToKill == null
          ? row.seconds
          : blend(row.seconds, spellResult.expectedPlayerSecondsToKill),
        playerHitChance: spellResult ? blend(meleeResult.playerHitChance, spellResult.playerHitChance) : row.playerHitChance,
        expectedDamageTaken: blend(row.expectedDamageTaken, spellDamage),
        conditionalBlockChance: gear === 'expected' && spellResult
          ? blend(meleeResult.monsterConditionalBlockChance, spellResult.monsterConditionalBlockChance)
          : row.conditionalBlockChance,
        expectedManaSpent: allocation?.manaSpent ?? 0,
        manaPerCast: spellResult?.manaPerCast,
        selectedSpell: spellKills > 0 ? row.selectedSpell : undefined,
        unbounded: !Number.isFinite(row.seconds)
          || (spellShare > 0 && !Number.isFinite(spellResult?.expectedPlayerSecondsToKill)),
        expectedPlayerActions: spellResult
          ? blend(meleeResult.expectedPlayerSwingsToKill, spellResult.expectedPlayerSwingsToKill)
          : row.expectedPlayerActions,
        expectedFreeActions: spellResult
          ? spellShare * (spellResult.approach?.expectedFreePlayerActions ?? 0)
          : 0,
        spellExpectedKills: spellKills,
      };
    });
    const meanXp = rows.reduce((sum, row) => sum + row.xp, 0) / divisor;
    const uncappedXp = meanXp * ambientPopulation;
    const expectedXpGained = Math.min(uncappedXp, Math.max(0, maximumExperience - totalExperience));
    const expectedSeconds = ambientPopulation === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.seconds, 0) / divisor * ambientPopulation;
    const expectedDamage = ambientPopulation === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.expectedDamageTaken, 0) / divisor * ambientPopulation;
    const expectedManaSpent = playerAttack === 'spell'
      ? ambientPopulation === 0
        ? 0
        : mixedSorcerer
          ? mixedAllocations.reduce((sum, allocation) => sum + allocation.manaSpent, 0)
          : rows.reduce((sum, row) => sum + (row.expectedManaSpent ?? 0), 0) / divisor * ambientPopulation
      : undefined;
    const boundedSpellRows = rows.filter((row) => row.selectedSpell !== undefined);
    const spellGroups = new Map<string, DescentSpellUsage>();
    for (const row of boundedSpellRows) {
      const selected = row.selectedSpell!;
      const spec = spellSpec(selected.spell);
      if (!spec) throw new Error(`unknown vanilla spell ${selected.spell}`);
      const key = `${selected.spell}:${selected.spellLevel}`;
      const current = spellGroups.get(key);
      const expectedKills = row.spellExpectedKills;
      spellGroups.set(key, current ? { ...current, expectedKills: current.expectedKills + expectedKills } : {
        spell: selected.spell,
        spellLevel: selected.spellLevel,
        element: spec.element,
        manaPerCast: row.manaPerCast!,
        expectedKills,
        killShare: 0,
      });
    }
    const boundedKills = [...spellGroups.values()].reduce((sum, usage) => sum + usage.expectedKills, 0);
    const spellsUsed = [...spellGroups.values()].map((usage) => ({
      ...usage,
      killShare: boundedKills > 0 ? usage.expectedKills / boundedKills : 0,
    }));
    const unboundedMonsters = rows.filter((row) => row.unbounded).map((row) => ({
      monsterId: row.wrapper.entity.id,
      monster: row.wrapper.entity.name,
      reason: playerAttack === 'spell'
        ? `No spell learned by depth ${depth} can damage this target.`
        : 'The selected ranged attack has unbounded time-to-kill.',
    }));
    const totalPlayerActions = rows.reduce((sum, row) => sum + row.expectedPlayerActions, 0);
    const totalFreeActions = rows.reduce((sum, row) => sum + row.expectedFreeActions, 0);
    const approach = playerAttack === 'melee' ? undefined : {
      engagementDistance: DEFAULT_RANGED_ENGAGEMENT_DISTANCE,
      expectedFreeActionsPerKill: totalFreeActions / divisor,
      freeShotShare: Number.isFinite(totalPlayerActions) && totalPlayerActions > 0
        ? totalFreeActions / totalPlayerActions
        : 0,
      monsterSpeeds: rows.map((row) => row.approachSpeed!),
    };
    const expectedBlockChance = rows.reduce((sum, row) => sum + row.conditionalBlockChance, 0) / divisor;
    let sustain: DescentSustainExpectation | undefined;
    if (loot) {
      const healingPotionsBought = goldAvailableForPurchases * healingGoldShare / healingPotionPrice;
      const healingPotionsAvailable = carriedHealingPotions + healingPotionsBought + loot.expectedHealingPotions;
      const fullHealingPotionsAvailable = carriedFullHealingPotions + loot.expectedFullHealingPotions;
      const lifePool = lifeAndMana(build, coefficients).maximumLife / FIXED_POINT;
      const lifeRestoredPerHealingPotion = expectedHealingPotionLife(input.className, lifePool);
      const healingSupply = healingPotionsAvailable * lifeRestoredPerHealingPotion
        + fullHealingPotionsAvailable * lifePool;
      const arithmetic = Number.isFinite(expectedDamage)
        ? sustainArithmetic({
            expectedDamageTaken: expectedDamage,
            lifePool,
            healingPotions: healingPotionsAvailable,
            fullHealingPotions: fullHealingPotionsAvailable,
            lifeRestoredPerHealingPotion,
          })
        : { healingSupply, sustainable: false, deficit: Infinity };
      sustain = {
        ...arithmetic,
        expectedGoldDropped: loot.expectedGold,
        healingPotionPrice,
        healingPotionsDropped: loot.expectedHealingPotions,
        fullHealingPotionsDropped: loot.expectedFullHealingPotions,
        healingPotionsBought,
        healingPotionsAvailable,
        fullHealingPotionsAvailable,
        lifePool,
        lifeRestoredPerHealingPotion,
        lifeRestoredPerFullHealingPotion: lifePool,
      };
      const remaining = consumeHealing(
        healingPotionsAvailable,
        fullHealingPotionsAvailable,
        Math.max(0, expectedDamage - lifePool),
        lifeRestoredPerHealingPotion,
        lifePool,
      );
      carriedHealingPotions = remaining.healingPotions;
      carriedFullHealingPotions = remaining.fullHealingPotions;
    }
    let mana: DescentManaExpectation | undefined;
    let spellAssumed: DescentSpellExpectation | undefined;
    if (playerAttack === 'spell' && expectedManaSpent !== undefined) {
      const boundedManaSpent = Number.isFinite(expectedManaSpent) ? expectedManaSpent : 0;
      const arithmetic = manaSustainArithmetic({
        expectedManaSpent: boundedManaSpent,
        currentMana: currentManaAtStart,
        manaPool,
        manaPotions: manaPotionsAvailable,
        fullManaPotions: fullManaPotionsAvailable,
        manaRestoredPerPotion,
      });
      mana = {
        expectedManaSpent: finiteOrNull(expectedManaSpent),
        currentManaAtStart,
        manaPool,
        expectedGoldAllocated,
        manaPotionPrice: gear === 'expected' ? manaPotionPrice : null,
        manaPotionsDropped: loot?.expectedManaPotions ?? 0,
        fullManaPotionsDropped: loot?.expectedFullManaPotions ?? 0,
        manaPotionsBought,
        manaPotionsAvailable,
        fullManaPotionsAvailable,
        manaRestoredPerPotion,
        manaRestoredPerFullPotion: manaPool,
        potionManaSupply: arithmetic.potionManaSupply,
        totalManaAvailable: arithmetic.totalManaAvailable,
        sustainable: Number.isFinite(expectedManaSpent) && arithmetic.sustainable,
        deficit: Number.isFinite(expectedManaSpent) ? arithmetic.deficit : null,
      };
      const remaining = consumeMana(
        currentManaAtStart,
        manaPotionsAvailable,
        fullManaPotionsAvailable,
        expectedManaSpent,
        manaRestoredPerPotion,
        manaPool,
      );
      currentMana = remaining.currentMana;
      carriedManaPotions = remaining.manaPotions
        + (mixedSorcerer ? loot?.expectedManaPotions ?? 0 : 0);
      carriedFullManaPotions = remaining.fullManaPotions
        + (mixedSorcerer ? loot?.expectedFullManaPotions ?? 0 : 0);
      if (spellsUsed.length === 1) {
        const [only] = spellsUsed;
        spellAssumed = {
          spell: only.spell,
          spellLevel: only.spellLevel,
          element: only.element,
          manaPerCast: only.manaPerCast,
        };
      }
      if (sustain) sustain.sustainable = sustain.sustainable && mana.sustainable;
    }
    if (loot) goldForNextDepth = loot.expectedGold;
    totalExperience += expectedXpGained;
    heroLevel = levelAt(totalExperience, heroLevelBefore, curve);
    if (playerAttack === 'spell' && heroLevel > heroLevelBefore) currentMana = null;
    const notes = [
      `Uniform expectation across ${pool.length} eligible ordinary type${pool.length === 1 ? '' : 's'}; ${ambientPopulation} sequential ambient kills.`,
      `${uniqueIds.length} eligible unique row${uniqueIds.length === 1 ? '' : 's'} excluded because actual roster and quest conditions are unresolved.`,
      ...(depth === 16 ? ['Depth 16 uses the range-eligible pool as an explicit proxy; d1-monster-type-selection says the engine skips its random draw for the authored fixed roster.'] : []),
    ];
    levels.push({
      depth,
      poolSize: pool.length,
      expectedMonstersKilled: ambientPopulation,
      ...(mixedSorcerer ? { expectedSpellKills, expectedMeleeKills } : {}),
      expectedXpGained,
      heroLevelBefore,
      heroLevelAfter: heroLevel,
      expectedSecondsToClear: finiteOrNull(expectedSeconds),
      expectedDamageTaken: finiteOrNull(expectedDamage),
      hardestMonster: hardest(rows),
      note: notes.join(' '),
      ...(playerAttack !== 'melee' ? { attackMode: playerAttack } : {}),
      ...(spellAssumed ? { spellAssumed } : {}),
      ...(playerAttack === 'spell' ? { spellsUsed, unboundedMonsters } : {}),
      ...(approach ? { approach } : {}),
      ...(mana ? { mana } : {}),
      ...(weaponAssumed ? { weaponAssumed } : {}),
      ...(armourAssumed && sustain ? { armourAssumed, expectedBlockChance, sustain } : {}),
    });
    if (gear === 'expected' && ambientPopulation > 0) {
      lootHistory.push(...depthLootProfiles);
      killsSoFar += ambientPopulation;
    }
  }

  return {
    model: 'deterministic-expectation',
    className: input.className,
    policy: input.policy,
    gameMode: input.gameMode,
    difficulty: input.difficulty,
    weaponId: input.weapon?.entity.id ?? startingWeapon?.entity.id ?? null,
    ...(input.className === 'rogue' ? { attackMode: 'ranged' as const } : {}),
    ...(input.className === 'sorcerer' ? { attackMode: 'spell' as const } : {}),
    ...(input.className === 'sorcerer' && sorcererCombatPolicy === 'mixed'
      ? { sorcererCombatPolicy: 'mixed' as const }
      : {}),
    ...(gear === 'expected' ? { gear } : {}),
    assumptions: assumptions(tilesPerLevel, input.policy, gear, input.className, sorcererCombatPolicy),
    levels,
  };
}

/** Build the runtime-only combat-map pseudo-wrapper promoted by the Diablo ingest CLI. */
export function descentEntity(input: SimulateDescentInput): ReferenceWrapper {
  const simulation = simulateDescent(input);
  const classWrapper = classWrapperFrom(input.wrappers, input.className);
  const id = `d1-descent-${input.className}`;
  const relevantCatalogs: string[] = input.gear === 'expected'
    ? ['characters', 'bestiary', 'progression-curves', 'items', 'affixes']
    : ['characters', 'bestiary', 'progression-curves'];
  if (input.className === 'sorcerer') relevantCatalogs.push('spellbook');
  const relevantFiles = [...new Set(input.wrappers
    .filter((wrapper) => relevantCatalogs.includes(wrapper.catalogId))
    .map((wrapper) => wrapper.entity.provenance.sourceFile))];
  const mappingVersion = contentHash([
    'd1-monster-type-selection', 'd1-unique-placement', 'd1-xp-award-law', 'd1-xp-curve-law',
    'combatMath', 'combatDuel', simulation.policy, simulation.gameMode, simulation.difficulty,
    ...(simulation.attackMode ? [simulation.attackMode, 'class-attack-mode'] : []),
    ...(simulation.gear === 'expected' ? ['expected-loot-gear'] : []),
  ]);
  return {
    wrapperId: `${classWrapper.sourceId}:combat-map:${id}`,
    sourceId: classWrapper.sourceId,
    file: 'engine/descent-expectation',
    technique: 'engine-derived-expectation@1',
    key: id,
    keyKind: 'column',
    raw: {},
    rawHash: contentHash(simulation),
    catalogId: 'combat-map',
    mappingVersion,
    entity: {
      id,
      catalogId: 'combat-map',
      name: `Diablo I ${input.className} descent expectation`,
      categoryPath: ['Combat Map', 'Diablo I Descent'],
      lifecycle: 'planned',
      tags: ['diablo-descent', 'engine-derived', input.className],
      links: [
        { catalogId: 'characters', entityId: classWrapper.entity.id, role: 'simulates' },
        ...(input.weapon ? [{ catalogId: 'items', entityId: input.weapon.entity.id, role: 'weapon' }] : []),
      ],
      data: {
        kind: 'descent-expectation',
        difficultyCurve: simulation.levels,
        assumptions: simulation.assumptions,
        model: simulation.model,
        className: simulation.className,
        policy: simulation.policy,
        gameMode: simulation.gameMode,
        difficulty: simulation.difficulty,
        weaponId: simulation.weaponId,
        ...(simulation.attackMode ? { attackMode: simulation.attackMode } : {}),
        ...(simulation.gear === 'expected' ? { gear: simulation.gear } : {}),
      },
      provenance: {
        kind: 'ingest',
        sourceGame: DIABLO1_SOURCE.sourceGame,
        sourceProject: `${DIABLO1_SOURCE.sourceProject}; engine pinned at 4138a82`,
        sourceFile: relevantFiles.join(', '),
        sourceRow: `derived ${id} from eligible pools at depths 1-16`,
        licenceNote: DIABLO1_SOURCE.licenceNote,
        ingestedAt: classWrapper.entity.provenance.ingestedAt,
        canonProfile: 'diablo1',
      },
    },
  };
}
