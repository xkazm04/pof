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
  hitRecoveryTiming,
  lifeAndMana,
  type Difficulty,
  type DamageDistribution,
  type Element,
  type ExperienceCurveLaw,
  type GameMode,
  type HitRecoveryTier,
  type PlayerBuild,
  type Resistances,
  type WeaponGraphic,
} from '@/lib/catalog/reference/combatMath';
import { aggregateClassWrappers } from '@/lib/catalog/reference/classHeroes';
import { contentHash } from '@/lib/catalog/reference/hash';
import { D1_AI_ROUTINES, isD1AiRoutineId } from '@/lib/catalog/reference/aiRoutines';
import { locationEntities, type LocationEntityWrapper } from '@/lib/catalog/reference/locationSpecs';
import {
  bestArmourExpectation,
  bestDefensiveAffixExpectation,
  bestWeaponExpectation,
  expectedDrop,
  expectedLootBudget,
  expectedSaleIncome,
  monsterLootProfile,
  type BestArmourExpectation,
  type BestDefensiveAffixExpectation,
  type BestWeaponExpectation,
  type ExpectedSaleValue,
  type SaleIdentifyPolicy,
  type WeightedLootMonsterProfile,
} from '@/lib/catalog/reference/lootMath';
import {
  DEFAULT_ADJACENT_SLOTS,
  distributedPackExchange,
  expectedPackSize,
  ordinaryPackSizeDistribution,
  requestedUniquePackSize,
} from '@/lib/catalog/reference/packMath';
import { spellSpec } from '@/lib/catalog/reference/spellSpecs';
import {
  expectedDefensiveStoreStock,
  type DefensiveEquipmentSlot,
  type ExpectedDefensiveStoreOffer,
} from '@/lib/catalog/reference/storeMath';
import {
  monsterMissileDamageSource,
  monsterMissileMetadata,
  resolveMonsterMissileDamage,
  selectMonsterMissileAttack,
} from '@/lib/catalog/reference/monsterMissileDamage';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export const DESCENT_CLASSES = ['warrior', 'rogue', 'sorcerer'] as const;
export type DescentClassName = typeof DESCENT_CLASSES[number];
export type StatPointPolicy = 'none' | 'all-strength' | 'balanced';
export type DescentGear = 'none' | 'expected';
export type DefensiveAffixes = 'none' | 'expected';
export type SorcererCombatPolicy = 'mixed' | 'pure-spell';
export type SustainIncome = 'monster-gold' | 'gold-and-sales';
export type SaleIdentify = SaleIdentifyPolicy;
export type DescentEncounter = 'duel' | 'packs';
export type DescentPurchases = 'none' | 'defence';

/** Explicit non-solid-tile assumption used only when a caller does not provide one. */
export const DEFAULT_TILES_PER_LEVEL_ASSUMPTION = 3_000;

/** One abstract item per slot; real item footprints are deliberately outside this scalar policy. */
export const DEFAULT_SALE_ITEMS_PER_TRIP_ASSUMPTION = 40;

/** At least half of the between-depth gold budget remains available for sustain potions. */
export const DEFENCE_POTION_RESERVE_FRACTION = 0.5;

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

export interface DescentMonsterPackSize {
  monsterId: string;
  monster: string;
  expectedPackSize: number;
}

export interface DescentUniquePackSize {
  monsterId: string;
  monster: string;
  pack: string;
  requestedPackSize: number | null;
}

export interface DescentPackExpectation {
  adjacentSlots: number;
  expectedPackSize: number;
  expectedPacks: number;
  damageMultiplierVsDuel: number | null;
  expectedGotHitInterruptions: number | null;
  sustainable: boolean;
  typePackSizes: DescentMonsterPackSize[];
  eligibleUniquePacks: DescentUniquePackSize[];
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
  /** Present only for the opt-in expected defensive-affix policy. */
  defensiveAffixesAssumed?: BestDefensiveAffixExpectation;
  /** Mean conditional block chance across this depth's eligible monster types. */
  expectedBlockChance?: number;
  /** Present only for expected gear because sustain is funded by expected loot. */
  sustain?: DescentSustainExpectation;
  /** Present only for the opt-in simultaneous-packs encounter policy. */
  pack?: DescentPackExpectation;
  /** Present only for the opt-in town-defence purchase policy. */
  defencePurchases?: DescentDefencePurchaseReport;
}

export interface DescentPurchasedDefence extends ExpectedDefensiveStoreOffer {
  boughtAtDepth: number;
  /** Conditional resale credit applied if this offer is present and replaces the equipped item. */
  saleCredit: number;
  /** Conditional price after resale credit. */
  netPrice: number;
  /** Availability-weighted gold spend and outcome used by the deterministic expectation. */
  expectedGoldSpent: number;
  expectedDamageReduction: number;
  expectedDamageReductionPerGold: number;
  expectedArmourClass: number;
  expectedResistances: Resistances;
  expectedHitRecoverySkippedFrames: number;
  expectedEquippedSaleValue: number;
}

export interface DescentPurchasedDefenceState {
  slots: Partial<Record<DefensiveEquipmentSlot, DescentPurchasedDefence>>;
}

export interface DescentDefencePurchaseReport {
  potionReserveFraction: number;
  goldAvailable: number;
  goldBudget: number;
  goldSpent: number;
  bought: DescentPurchasedDefence[];
  resultingArmourClass: number;
  resultingResistances: Resistances;
  resultingHitRecoveryTier: HitRecoveryTier;
  expectedDamageTakenWithoutPurchases: number | null;
  expectedDamageReduction: number | null;
  sustainableWithoutPurchases: boolean;
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
  /** Present only for the opt-in gold-and-sales policy. */
  expectedGoldFromSales?: number;
  /** Present only for the opt-in gold-and-sales policy. */
  expectedGoldIncome?: number;
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

export interface DescentGoldFaucets {
  monsterGold: number;
  sales: number;
  total: number;
}

export interface DescentGoldSinks {
  potionsBought: number;
  /** Present only for the opt-in town-defence purchase policy. */
  defenceBought?: number;
  repair: number;
  identify: number;
  total: number;
}

export interface DescentGoldFlowRate {
  faucets: DescentGoldFaucets;
  sinks: DescentGoldSinks;
  net: number;
}

export interface DescentGoldFlowLevel {
  depth: number;
  clearHours: number | null;
  faucets: DescentGoldFaucets;
  sinks: DescentGoldSinks;
  net: number;
  perHour: DescentGoldFlowRate | null;
  sales: ExpectedSaleValue;
}

export interface DescentGoldFlow {
  measurement: 'derived-faucet-sink-per-clear-hour';
  sustainIncome: 'gold-and-sales';
  itemsPerTrip: number;
  levels: DescentGoldFlowLevel[];
  cumulative: Omit<DescentGoldFlowLevel, 'depth' | 'sales'>;
  equilibrium: {
    status: 'surplus' | 'deficit' | 'balanced' | 'unbounded-clear-time';
    netGoldPerHour: number | null;
    engineEquilibrium: null;
  };
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

export interface DescentLearnedSpell {
  spell: string;
  spellLevel: number;
}

export interface DescentPotionInventory {
  healing: number;
  fullHealing: number;
  mana: number;
  fullMana: number;
}

export interface DescentExpectedGearState {
  killsSoFar: number;
  /** Weighted prior-kill mixture; each row retains the difficulty under which it dropped. */
  dropHistory: WeightedLootMonsterProfile[];
  weapon: BestWeaponExpectation;
  armour: BestArmourExpectation;
  /** Present only when the W47 defensive-affix expectation is enabled. */
  defensiveAffixes?: BestDefensiveAffixExpectation;
}

/** Compact hero-only boundary state; generated world, quest, store, and ground state are excluded. */
export interface DescentInitialState {
  className: DescentClassName;
  level: number;
  totalExperience: number;
  strength: number;
  magic: number;
  dexterity: number;
  vitality: number;
  unspentStatPoints: number;
  /** Next attribute index for the deterministic balanced allocation policy. */
  balancedAllocationCursor: number;
  currentLife: number;
  maximumLife: number;
  currentMana: number;
  maximumMana: number;
  learnedSpells: DescentLearnedSpell[];
  expectedGear?: DescentExpectedGearState;
  gold: number;
  potions: DescentPotionInventory;
  /** Present only after the opt-in buyer has acquired defensive store items. */
  purchasedDefence?: DescentPurchasedDefenceState;
  diabloKillRank: number;
  completedDifficulties: Difficulty[];
}

export interface DescentFinalState extends DescentInitialState {
  completedDifficulty: Difficulty;
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
  /** Omitted for the byte-compatible default. */
  defensiveAffixes?: 'expected';
  /** Omitted for the byte-compatible duel default. */
  encounter?: 'packs';
  /** Omitted for the byte-compatible duel default. */
  adjacentSlots?: number;
  /** Omitted for the byte-compatible default. */
  purchases?: 'defence';
  /** Omitted for the byte-compatible unidentified-sale default. */
  saleIdentify?: 'when-profitable';
  assumptions: DescentAssumption[];
  levels: DescentLevelResult[];
  /** Opt-in derived measurement; omitted by the byte-compatible monster-gold policy. */
  goldFlow?: DescentGoldFlow;
  /** Non-enumerable so the legacy one-leg JSON remains byte-identical. */
  finalState: DescentFinalState;
}

export interface SimulateDescentInput {
  className: DescentClassName;
  policy: StatPointPolicy;
  tilesPerLevel?: number;
  gameMode: GameMode;
  difficulty: Difficulty;
  weapon?: ReferenceWrapper;
  gear?: DescentGear;
  /** Adds expected resistance and hit-recovery affixes to expected gear; defaults to none. */
  defensiveAffixes?: DefensiveAffixes;
  /** Sorcerer defaults to finite-mana mixed combat; pure-spell preserves the comparison model. */
  sorcererCombatPolicy?: SorcererCombatPolicy;
  /** Defaults to the legacy monster-drop-only sustain income. */
  sustainIncome?: SustainIncome;
  /** Abstract carried item count for the single town return after each depth. */
  saleItemsPerTrip?: number;
  /** Defaults to selling every drop unidentified. */
  saleIdentify?: SaleIdentify;
  /** Defaults to the legacy one-monster duel model. */
  encounter?: DescentEncounter;
  /** Simultaneous melee capacity; eight open tiles, or two for the documented corridor scenario. */
  adjacentSlots?: number;
  /** Town purchases are opt-in; the default spends no gold on equipment. */
  purchases?: DescentPurchases;
  /** Source rows are passed in; the simulator never reads a database or filesystem. */
  wrappers: readonly ReferenceWrapper[];
  /** Tests and other pure callers may pass already-projected location entities. */
  locations?: readonly LocationEntityWrapper[];
  /** Omitted for the byte-compatible fresh level-1 start. */
  initialState?: DescentInitialState;
}

export interface SimulateDifficultyChainInput extends Omit<SimulateDescentInput, 'difficulty' | 'initialState'> {
  difficulties?: readonly Difficulty[];
  initialHeroState?: DescentInitialState;
}

export interface DescentDifficultyChainLeg extends DescentSimulation {
  initialState: DescentInitialState;
  finalState: DescentFinalState;
  precedingLegCompleted: boolean;
}

export interface DescentDifficultyChainLegSummary {
  difficulty: Difficulty;
  levelAtEnd: number;
  firstUnsustainableDepth: number | null;
  /** Present only for the simultaneous-packs encounter policy. */
  stunLockDepths?: number[];
}

export interface DescentDifficultyChain {
  model: 'deterministic-expectation-chain';
  className: DescentClassName;
  policy: StatPointPolicy;
  gameMode: 'single';
  difficulties: Difficulty[];
  legs: DescentDifficultyChainLeg[];
  summary: { legs: DescentDifficultyChainLegSummary[] };
  finalState: DescentFinalState;
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

interface StatAllocation {
  attributes: Record<AttributeKey, number>;
  unspentStatPoints: number;
  balancedAllocationCursor: number;
}

function spendStatPoints(
  starting: Pick<PlayerBuild, AttributeKey>,
  points: number,
  policy: StatPointPolicy,
  maxima: Record<AttributeKey, number>,
  balancedAllocationCursor: number,
): StatAllocation {
  const attributes = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, starting[key]])) as Record<AttributeKey, number>;
  let remaining = points;
  let cursor = balancedAllocationCursor;
  if (policy === 'none') return { attributes, unspentStatPoints: remaining, balancedAllocationCursor: cursor };
  if (policy === 'all-strength') {
    const spent = Math.min(remaining, Math.max(0, maxima.strength - attributes.strength));
    attributes.strength += spent;
    remaining -= spent;
    return { attributes, unspentStatPoints: remaining, balancedAllocationCursor: cursor };
  }
  while (remaining > 0 && ATTRIBUTE_KEYS.some((key) => attributes[key] < maxima[key])) {
    const key = ATTRIBUTE_KEYS[cursor];
    cursor = (cursor + 1) % ATTRIBUTE_KEYS.length;
    if (attributes[key] >= maxima[key]) continue;
    attributes[key]++;
    remaining--;
  }
  return { attributes, unspentStatPoints: remaining, balancedAllocationCursor: cursor };
}

function defaultInitialState(
  className: DescentClassName,
  classWrapper: ReferenceWrapper,
): DescentInitialState {
  const build = referenceBuild(classWrapper, 1);
  const pools = lifeAndMana(build, classCoefficients(classWrapper));
  return {
    className,
    level: 1,
    totalExperience: 0,
    strength: build.strength,
    magic: build.magic,
    dexterity: build.dexterity,
    vitality: build.vitality,
    unspentStatPoints: 0,
    balancedAllocationCursor: 0,
    currentLife: pools.maximumLife / FIXED_POINT,
    maximumLife: pools.maximumLife / FIXED_POINT,
    currentMana: pools.maximumMana / FIXED_POINT,
    maximumMana: pools.maximumMana / FIXED_POINT,
    learnedSpells: [],
    gold: 0,
    potions: { healing: 0, fullHealing: 0, mana: 0, fullMana: 0 },
    diabloKillRank: 0,
    completedDifficulties: [],
  };
}

function cloneLootProfile(row: WeightedLootMonsterProfile): WeightedLootMonsterProfile {
  const clone: WeightedLootMonsterProfile = {
    profile: { ...row.profile },
    weight: row.weight,
    ...(row.difficulty ? { difficulty: row.difficulty } : {}),
  };
  if (row.drop) {
    Object.defineProperty(clone, 'drop', {
      value: row.drop,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return clone;
}

function validatedInitialState(
  state: DescentInitialState,
  className: DescentClassName,
  maxima: Record<AttributeKey, number>,
  maximumLevel: number,
): DescentInitialState {
  if (state.className !== className) {
    throw new Error(`initialState class ${state.className} does not match ${className}`);
  }
  if (!Number.isInteger(state.level) || state.level < 1 || state.level > maximumLevel) {
    throw new Error(`initialState.level must be an integer from 1 to ${maximumLevel} (got ${state.level})`);
  }
  const finiteNonNegative = (value: number, name: string) => {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number (got ${value})`);
  };
  finiteNonNegative(state.totalExperience, 'initialState.totalExperience');
  for (const key of ATTRIBUTE_KEYS) {
    finiteNonNegative(state[key], `initialState.${key}`);
    if (state[key] > maxima[key]) throw new Error(`initialState.${key} exceeds the class maximum ${maxima[key]}`);
  }
  finiteNonNegative(state.unspentStatPoints, 'initialState.unspentStatPoints');
  if (!Number.isInteger(state.balancedAllocationCursor)
    || state.balancedAllocationCursor < 0
    || state.balancedAllocationCursor >= ATTRIBUTE_KEYS.length) {
    throw new Error(`initialState.balancedAllocationCursor must be an integer from 0 to ${ATTRIBUTE_KEYS.length - 1}`);
  }
  for (const [name, value] of [
    ['currentLife', state.currentLife],
    ['maximumLife', state.maximumLife],
    ['currentMana', state.currentMana],
    ['maximumMana', state.maximumMana],
    ['gold', state.gold],
    ['potions.healing', state.potions.healing],
    ['potions.fullHealing', state.potions.fullHealing],
    ['potions.mana', state.potions.mana],
    ['potions.fullMana', state.potions.fullMana],
  ] as const) finiteNonNegative(value, `initialState.${name}`);
  if (state.currentLife > state.maximumLife) throw new Error('initialState.currentLife exceeds maximumLife');
  if (state.currentMana > state.maximumMana) throw new Error('initialState.currentMana exceeds maximumMana');
  if (!Number.isInteger(state.diabloKillRank) || state.diabloKillRank < 0) {
    throw new Error(`initialState.diabloKillRank must be a non-negative integer (got ${state.diabloKillRank})`);
  }
  if (state.expectedGear && (!Number.isInteger(state.expectedGear.killsSoFar) || state.expectedGear.killsSoFar < 0)) {
    throw new Error('initialState.expectedGear.killsSoFar must be a non-negative integer');
  }
  for (const spell of state.learnedSpells) {
    if (!spell.spell || !Number.isInteger(spell.spellLevel) || spell.spellLevel < 1) {
      throw new Error('initialState.learnedSpells must contain named positive integer spell levels');
    }
  }
  for (const difficulty of state.completedDifficulties) {
    if (!(['normal', 'nightmare', 'hell'] as const).includes(difficulty)) {
      throw new Error(`initialState.completedDifficulties contains unknown difficulty ${difficulty}`);
    }
  }
  return {
    ...state,
    learnedSpells: state.learnedSpells.map((spell) => ({ ...spell })),
    ...(state.expectedGear ? {
      expectedGear: {
        ...state.expectedGear,
        dropHistory: state.expectedGear.dropHistory.map(cloneLootProfile),
      },
    } : {}),
    potions: { ...state.potions },
    ...(state.purchasedDefence ? {
      purchasedDefence: {
        slots: Object.fromEntries(Object.entries(state.purchasedDefence.slots)
          .map(([slot, item]) => [slot, item == null ? item : {
            ...item,
            resistances: { ...item.resistances },
            expectedResistances: item.expectedResistances == null
              ? { ...item.resistances }
              : { ...item.expectedResistances },
          }])),
      },
    } : {}),
    completedDifficulties: [...state.completedDifficulties],
  };
}

function levelAt(totalExperience: number, currentLevel: number, curve: ExperienceCurveLaw): number {
  let level = currentLevel;
  while (level < curve.maxLevel && totalExperience >= (curve.threshold(level) ?? Number.MAX_SAFE_INTEGER)) level++;
  return level;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function hitRecoveryTierFor(skippedFrames: number): HitRecoveryTier {
  if (skippedFrames >= 3) return 'fastest';
  if (skippedFrames >= 2) return 'faster';
  if (skippedFrames >= 1) return 'fast';
  return 'none';
}

function clonePurchasedDefenceState(state: DescentPurchasedDefenceState | undefined): DescentPurchasedDefenceState {
  return {
    slots: Object.fromEntries(Object.entries(state?.slots ?? {}).map(([slot, item]) => [slot, item == null ? item : {
      ...item,
      resistances: { ...item.resistances },
      expectedResistances: item.expectedResistances == null
        ? { ...item.resistances }
        : { ...item.expectedResistances },
    }])),
  };
}

interface EffectiveDefence {
  build: PlayerBuild;
  hitRecoveryTier: HitRecoveryTier;
  resistances: Resistances;
  armourClass: number;
}

function effectiveDefence(
  build: PlayerBuild,
  armour: BestArmourExpectation | undefined,
  affixes: BestDefensiveAffixExpectation | undefined,
  purchased: DescentPurchasedDefenceState,
  shieldAllowed: boolean,
): EffectiveDefence {
  const resistances: Resistances = { magic: 0, fire: 0, lightning: 0 };
  let armourClass = 0;
  let purchasedRecovery = 0;
  for (const slot of ['body', 'helm', 'shield', 'ring1', 'ring2', 'amulet'] as const) {
    const item = purchased.slots[slot];
    const droppedResistance = affixes?.slotResistances[slot] ?? { magic: 0, fire: 0, lightning: 0 };
    for (const element of ['magic', 'fire', 'lightning'] as const) {
      resistances[element] += Math.max(
        droppedResistance[element],
        item?.expectedResistances?.[element] ?? item?.resistances[element] ?? 0,
      );
    }
    if (slot === 'body' || slot === 'helm' || slot === 'shield') {
      if (slot !== 'shield' || shieldAllowed) {
        armourClass += Math.max(
          armour?.slots[slot].armourClass ?? 0,
          item?.expectedArmourClass ?? item?.armourClass ?? 0,
        );
      }
    }
    purchasedRecovery = Math.max(
      purchasedRecovery,
      item?.expectedHitRecoverySkippedFrames ?? item?.hitRecoverySkippedFrames ?? 0,
    );
  }
  for (const element of ['magic', 'fire', 'lightning'] as const) {
    resistances[element] = Math.min(75, resistances[element]);
  }
  const skippedFrames = Math.max(affixes?.expectedHitRecoverySkippedFrames ?? 0, purchasedRecovery);
  const hasShield = shieldAllowed && Math.max(
    armour?.slots.shield.armourClass ?? 0,
    purchased.slots.shield?.expectedArmourClass ?? purchased.slots.shield?.armourClass ?? 0,
  ) > 0;
  return {
    build: {
      ...build,
      armourClass,
      resistances,
      hasShield,
      blockEnabled: hasShield,
    },
    hitRecoveryTier: hitRecoveryTierFor(skippedFrames),
    resistances,
    armourClass,
  };
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

function sorcererSpellAttacks(
  wrappers: readonly ReferenceWrapper[],
  depth: number,
  carried: readonly DescentLearnedSpell[] = [],
): DuelSpellAttack[] {
  const learnedById = new Map(carried.map((entry) => [entry.spell.toLowerCase(), entry]));
  for (const entry of SORCERER_SPELL_PROGRESSION.filter((candidate) => depth >= candidate.learnedAtDepth)) {
    const id = entry.spell.toLowerCase();
    const previous = learnedById.get(id);
    if (!previous || previous.spellLevel < entry.spellLevel) learnedById.set(id, entry);
  }
  const learned = [...learnedById.values()];
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
  monsterElement?: Element;
  monsterDamage?: DamageDistribution;
  monsterProjectilesPerAttack?: number;
  monsterDamageAlreadyShifted?: boolean;
  approachTilesPerSecond?: number;
  speed: DescentMonsterApproachSpeed;
}

function monsterRoutine(wrapper: ReferenceWrapper): string | undefined {
  return wrapper.file === 'monsters/unique_monstdat.tsv'
    ? wrapper.raw.ai
    : wrapper.entity.tags?.[0];
}

function monsterIntelligence(wrapper: ReferenceWrapper): number {
  const value = Number(wrapper.entity.data.intelligence ?? wrapper.raw.intelligence);
  return Number.isInteger(value) ? value : 0;
}

function monsterType(wrapper: ReferenceWrapper): string | undefined {
  return wrapper.file === 'monsters/unique_monstdat.tsv'
    ? wrapper.raw.type
    : wrapper.raw._monster_id;
}

function monsterUsesMissileWhenAdjacent(wrapper: ReferenceWrapper): boolean {
  const ai = monsterRoutine(wrapper);
  if (ai === undefined || !isD1AiRoutineId(ai)) return false;
  const hasMeleeAttack = D1_AI_ROUTINES[ai].attacks.some((attack) => attack.kind === 'melee');
  return !hasMeleeAttack
    && selectMonsterMissileAttack(ai, monsterIntelligence(wrapper), monsterType(wrapper))?.kind === 'missile';
}

function monsterExchangeModel(
  wrapper: ReferenceWrapper,
  monster: ReturnType<typeof monsterProfile>,
  base: ReferenceWrapper | undefined,
  wrappers: readonly ReferenceWrapper[],
): MonsterExchangeModel {
  const rawDerived = wrapper.entity.data.derived;
  const derived = rawDerived && typeof rawDerived === 'object' && !Array.isArray(rawDerived)
    ? rawDerived as Record<string, unknown>
    : {};
  const ai = monsterRoutine(wrapper);
  const selected = ai && isD1AiRoutineId(ai)
    ? selectMonsterMissileAttack(ai, monsterIntelligence(wrapper), monsterType(wrapper))
    : undefined;
  const source = selected ? monsterMissileDamageSource(selected.missile, selected.routine) : undefined;
  const metadata = selected ? monsterMissileMetadata(selected.missile, wrappers) : undefined;
  const resolved = source ? resolveMonsterMissileDamage(source, monster, wrapper, base) : undefined;
  if (selected?.kind === 'missile') {
    return {
      monsterAttack: metadata!.arrow ? 'ranged-arrow' : 'ranged-magic',
      monsterElement: metadata!.element,
      monsterDamage: resolved!.damage,
      monsterProjectilesPerAttack: resolved!.projectilesPerAttack,
      monsterDamageAlreadyShifted: resolved!.alreadyShifted,
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
      ...(metadata && resolved ? {
        monsterElement: metadata.element,
        monsterDamage: resolved.damage,
        monsterProjectilesPerAttack: resolved.projectilesPerAttack,
        monsterDamageAlreadyShifted: resolved.alreadyShifted,
      } : {}),
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
      ...(metadata && resolved ? {
        monsterElement: metadata.element,
        monsterDamage: resolved.damage,
        monsterProjectilesPerAttack: resolved.projectilesPerAttack,
        monsterDamageAlreadyShifted: resolved.alreadyShifted,
      } : {}),
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
  sustainIncome: SustainIncome,
  saleItemsPerTrip: number,
  saleIdentify: SaleIdentify,
  encounter: DescentEncounter,
  adjacentSlots: number,
  defensiveAffixes: DefensiveAffixes,
  purchases: DescentPurchases,
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
    ...(encounter === 'duel' ? [{
      id: 'duel-exchange',
      value: className === 'warrior'
        ? 'hero attacks first; one adjacent counterattack between hero swings'
        : 'hero attacks first; one melee counterattack between hero actions',
      source: 'combatDuel.duel expectations',
      detail: className === 'warrior'
        ? 'Expected damage per kill is (expected hero swings - 1) × expected monster damage per swing. At distance 1, routines without a melee attack use their selected missile and monster ranged to-hit law; other routines use melee. Monster travel, AI delays, healing, and simultaneous packs are outside this duel model.'
        : 'Melee monsters do no damage during their approach, then counter between adjacent hero actions. Missile-capable routines counter at the engagement distance. Healing and simultaneous packs are outside this duel model.',
    }] : [{
      id: 'pack-exchange',
      value: 'simultaneous homogeneous placement groups; hero focuses one target at a time',
      source: '.reference/devilutionX/Source/monster.cpp PlaceGroup and combatDuel.duel expectations',
      detail: 'Each exact integer pack-size branch is evaluated before probability averaging. Per-kill duel time and hero-first damage are time-normalized; all living ranged attackers contribute, while living melee attackers are capped by adjacent slots.',
    }, {
      id: 'adjacent-slots',
      value: adjacentSlots,
      source: 'explicit geometry assumption; eight tiles surround the hero and the corridor scenario uses two',
      detail: 'Monsters occupy tiles and cannot move through another monster. Non-adjacent melee pack members wait for a slot; missile-capable AI routines attack from range. Circling, retreating, and idle routines remain represented only by their existing duel approach/cadence inputs, not by new path geometry.',
    }, {
      id: 'got-hit-interruption',
      value: 'law-derived PM_GOTHIT threshold and class recovery animation',
      source: 'd1-combat-hit-recovery-law, stateGraphSpecsData PM_GOTHIT, and class animation wrappers',
      detail: 'A damaging unblocked hit qualifies when its whole-point damage (fixed-point / 64) reaches hero level (player.cpp StartPlrHit). Qualifying-hit rates are integrated during recovery; load >= 1 is reported as deterministic stun-lock. The model adds lost action time but does not model a partially completed action or projectile cancellation.',
    }, {
      id: 'pack-placement-size',
      value: 'depth 1 singleton; depth 2 singleton or 2..3; later singleton or 3..5',
      source: '.reference/devilutionX/Source/monster.cpp PlaceGroup caller branches',
      detail: 'The expected pack count is ambient population divided by expected requested size. Placement retries, occupied-tile failures, and final population-cap truncation need a dungeon seed and are excluded. Eligible uniques remain outside totals, but their unique-plus-eight-minion requested packs are reported together.',
    }]),
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
    ] : []),
    {
      id: 'ranged-monster-exchange',
      value: 'missile-only routines counter with their selected missile; adjacent hybrids use melee',
      source: 'aiRoutinesData attacks, the W44 decision graph, misdat data.damageType, and d1-combat-monster-ranged-to-hit-law',
      detail: 'A melee hero holds the targeted monster at distance 1. Routines with no melee attack still use their selected missile and monster ranged to-hit law there. The Magma, Bat, Storm, Acid, Mega, and Diablo hybrids declare both melee and missile attacks, so they use melee while adjacent; ranged heroes still model their selected missile before adjacency. The engine intelligence index selects Counselor-family spells and the Bat subtype selects Gloom charge or Familiar Lightning; other mixed routines use their primary ranged attack. Arrow-flagged missiles use arrow to-hit and other missiles use non-arrow projectile to-hit. AI retreat/circle geometry and projectile travel time remain outside the duel.',
    },
    {
      id: 'monster-missile-damage-event',
      value: 'one primary missile impact per exchange, except three independently resolved Charged Bolts',
      source: 'pin-verified monsterMissileDamageData formulas and missile collision call sites',
      detail: 'Generic projectiles use ordinary whole-HP monster damage; Rhino/Snake charges use special columns; fixed and level formulas remain missile-specific. Persistent Familiar/Lightning segments, acid puddles, the Fireball termination blast, repeated Flash areas, and Inferno path segments are omitted after one modeled impact. A stationary player can be checked repeatedly by lightning segments, but this exchange model counts one segment hit.',
    },
    {
      id: 'clear-time',
      value: encounter === 'duel'
        ? 'sum of duel time-to-kill; zero travel time'
        : 'sum of pack kill phases plus expected PM_GOTHIT recovery; zero navigation time',
      source: encounter === 'duel'
        ? 'combatDuel.duel expectedPlayerSecondsToKill'
        : 'combatDuel.duel expectedPlayerSecondsToKill plus packMath.packExchange',
      detail: encounter === 'duel'
        ? 'Every ambient kill is fought sequentially; navigation, doors, loot, recovery, and downtime add no seconds.'
        : 'Navigation, doors, loot, out-of-combat recovery, and downtime add no seconds. Only qualifying hit-recovery interruptions extend action time.',
    },
    ...(sustainIncome === 'gold-and-sales' && gear === 'none' ? [{
      id: 'sustain-income',
      value: 'monster gold plus carried item sales; no sustain purchases under gear:none',
      source: 'd1-loot-drop-outcome and d1-store-pricing-law',
      detail: saleIdentify === 'when-profitable'
        ? 'All eligible non-consumable item drops are sold to Griswold or Adria. A carried Magic or Unique outcome is identified for 100 gold exactly when its identified quarter-value sale price exceeds its unidentified base quarter-value sale price by more than that fee.'
        : 'All eligible non-consumable item drops are sold to Griswold or Adria at max(floor(base value / 4), 1). Magic and Unique items are sold unidentified at base value; Cain is not paid, so identify is a zero sink.',
    }, {
      id: 'sale-carry-capacity',
      value: `${saleItemsPerTrip} items per depth`,
      source: 'explicit caller assumption; inventory item footprints and extra town trips are not simulated',
      detail: 'One return to town follows each depth. Highest-sale-price eligible items fill the abstract item-count capacity first; fractional carried counts remain deterministic expectations.',
    }, {
      id: 'gold-flow-measurement',
      value: 'derived gold and gold per clear-hour',
      source: 'descent faucets and combat-only clear time',
      detail: saleIdentify === 'when-profitable'
        ? 'This is a PoF-derived faucet/sink measurement, not an engine economy or equilibrium. Potion purchases and repair are not modelled under gear:none; profitable Cain identification is reported as a sink.'
        : 'This is a PoF-derived faucet/sink measurement, not an engine economy or equilibrium. Potion purchases and repair are not modelled under gear:none and identify is zero under the unidentified-sale policy.',
    }, ...(saleIdentify === 'when-profitable' ? [{
      id: 'sale-identification',
      value: 'identify Magic and Unique drops only when profitable',
      source: 'CalcItemValue, GetUniqueItem, Griswold/Adria sale pricing, and Cain identify fee',
      detail: 'Magic identified values apply the generated affixes’ engine value additions and multipliers to base value; Unique outcomes use their unique value. Expected fees do not impose a separate within-trip liquidity constraint. Each depth reports the unidentified-policy comparison.',
    }] : [])] : []),
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
      ...(defensiveAffixes === 'expected' ? [{
        id: 'expected-loot-defensive-affixes',
        value: 'conservative expected resistance and hit-recovery affixes before each depth',
        source: 'pinned monster-drop, quality, affix, equipment, player-resistance, and hit-recovery procedures',
        detail: 'Body armour, helm, compatible shield, amulet, and two distinct ring order statistics contribute floored per-slot resistance expectations, summed and capped at 75%. Each element is optimized independently. The floored expected best non-stacking FASTRECOVER value selects Fast, Faster, or Fastest Hit Recovery. Unique powers and cross-stat/loadout correlations are omitted.',
      }] : []),
      ...(purchases === 'defence' ? [{
        id: 'town-defence-purchases',
        value: `greedy expected damage reduction per gold; ${String(DEFENCE_POTION_RESERVE_FRACTION * 100)}% potion reserve`,
        source: 'SpawnSmith, SpawnPremium, SpawnBoy, vendor item/affix value laws, and combatDuel/packMath expectations',
        detail: 'Before each depth, the buyer considers the floored expected-best alternative for each defensive slot and target in Griswold basic/premium stock and Wirt\'s item; Adria has no eligible armour or jewellery base types. Offer stats, benefit, price, and resale credit are conditional on seeing the targeted item, while reported spend and resulting equipped stats are weighted once by stock availability. Affordable positive conditional marginal reductions are bought greedily per net gold after crediting the replaced item at identified value / 4. Half the available gold is reserved for the existing sustain-potion policy; unspent defence-budget gold carries forward. Purchased projections persist across depths and difficulty-chain legs; independently optimized dropped and purchased quantities use the better value in each slot.',
      }] : []),
      {
        id: 'sustain-income',
        value: sustainIncome === 'gold-and-sales'
          ? 'monster gold plus carried non-kept item sales'
          : 'monster gold drops only; no sale value',
        source: sustainIncome === 'gold-and-sales'
          ? 'd1-loot-drop-outcome, d1-loot-gold-consumables, and d1-store-pricing-law'
          : 'd1-loot-drop-outcome and d1-loot-gold-consumables',
        detail: sustainIncome === 'gold-and-sales'
          ? saleIdentify === 'when-profitable'
            ? 'Expected saleable drops not reserved by the expected-gear policy are sold to Griswold or Adria. Carried Magic and Unique outcomes are identified only when their identified sale premium exceeds Cain’s fee. Containers, useful-object drops, quests, and starting inventory are excluded.'
            : 'Expected saleable drops not reserved by the expected-gear policy are sold to Griswold or Adria at max(floor(base value / 4), 1). Magic and Unique items are sold unidentified at base value; Cain is not paid, so identify is a zero sink. Containers, useful-object drops, quests, and starting inventory are excluded.'
          : className === 'sorcerer'
            ? 'Expected gold and Healing, Full Healing, Mana, and Full Mana potion drops come only from the ambient monsters modelled here. Sale value, containers, useful-object drops, quests, and starting inventory are excluded.'
            : 'Expected gold and Healing/Full Healing potion drops come only from the ambient monsters modelled here. Sale value, containers, useful-object drops, quests, and starting inventory are excluded.',
      },
      ...(sustainIncome === 'gold-and-sales' ? [{
        id: 'sale-carry-capacity',
        value: `${saleItemsPerTrip} items per depth`,
        source: 'explicit caller assumption; inventory item footprints and extra town trips are not simulated',
        detail: 'One return to town follows each depth. Highest-sale-price eligible items fill the abstract item-count capacity first; fractional carried counts remain deterministic expectations. Newly selected representative weapon/armour base identities are retained before this cap, and sustain potion drops are consumed rather than sold.',
      }, {
        id: 'gold-flow-measurement',
        value: 'derived gold and gold per clear-hour',
        source: 'descent faucets, purchases, and combat-only clear time',
        detail: saleIdentify === 'when-profitable'
          ? 'This is a PoF-derived faucet/sink measurement, not an engine economy or equilibrium. Repair is not modelled and is reported as zero; profitable Cain identification is a sink. Travel, looting, town, and recovery time are excluded from the denominator.'
          : 'This is a PoF-derived faucet/sink measurement, not an engine economy or equilibrium. Repair is not modelled and is reported as zero; identify is zero under the unidentified-sale policy. Travel, looting, town, and recovery time are excluded from the denominator.',
      }, ...(saleIdentify === 'when-profitable' ? [{
        id: 'sale-identification',
        value: 'identify Magic and Unique drops only when profitable',
        source: 'CalcItemValue, GetUniqueItem, Griswold/Adria sale pricing, and Cain identify fee',
        detail: 'Magic identified values apply the generated affixes’ engine value additions and multipliers to base value; Unique outcomes use their unique value. Expected fees do not impose a separate within-trip liquidity constraint. Per-depth sale reporting includes the unidentified-policy comparison.',
      }] : [])] : []),
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

function summarizeGoldFlow(levels: readonly DescentGoldFlowLevel[], itemsPerTrip: number): DescentGoldFlow {
  const hasDefencePurchases = levels.some((level) => level.sinks.defenceBought !== undefined);
  const faucets = levels.reduce<DescentGoldFaucets>((sum, level) => ({
    monsterGold: sum.monsterGold + level.faucets.monsterGold,
    sales: sum.sales + level.faucets.sales,
    total: sum.total + level.faucets.total,
  }), { monsterGold: 0, sales: 0, total: 0 });
  const sinks = levels.reduce<DescentGoldSinks>((sum, level) => ({
    potionsBought: sum.potionsBought + level.sinks.potionsBought,
    ...(hasDefencePurchases ? { defenceBought: (sum.defenceBought ?? 0) + (level.sinks.defenceBought ?? 0) } : {}),
    repair: sum.repair + level.sinks.repair,
    identify: sum.identify + level.sinks.identify,
    total: sum.total + level.sinks.total,
  }), { potionsBought: 0, repair: 0, identify: 0, total: 0 });
  const clearHours = levels.every((level) => level.clearHours != null)
    ? levels.reduce((sum, level) => sum + level.clearHours!, 0)
    : null;
  const net = faucets.total - sinks.total;
  const perHour = clearHours != null && clearHours > 0 ? {
    faucets: {
      monsterGold: faucets.monsterGold / clearHours,
      sales: faucets.sales / clearHours,
      total: faucets.total / clearHours,
    },
    sinks: {
      potionsBought: sinks.potionsBought / clearHours,
      ...(hasDefencePurchases ? { defenceBought: (sinks.defenceBought ?? 0) / clearHours } : {}),
      repair: sinks.repair / clearHours,
      identify: sinks.identify / clearHours,
      total: sinks.total / clearHours,
    },
    net: net / clearHours,
  } : null;
  return {
    measurement: 'derived-faucet-sink-per-clear-hour',
    sustainIncome: 'gold-and-sales',
    itemsPerTrip,
    levels: [...levels],
    cumulative: { clearHours, faucets, sinks, net, perHour },
    equilibrium: {
      status: perHour == null ? 'unbounded-clear-time' : perHour.net > 0 ? 'surplus' : perHour.net < 0 ? 'deficit' : 'balanced',
      netGoldPerHour: perHour?.net ?? null,
      engineEquilibrium: null,
    },
  };
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
  const encounter = input.encounter ?? 'duel';
  if (!(['duel', 'packs'] as const).includes(encounter)) throw new Error(`unknown encounter policy ${input.encounter}`);
  const adjacentSlots = input.adjacentSlots ?? DEFAULT_ADJACENT_SLOTS;
  if (!Number.isInteger(adjacentSlots) || adjacentSlots < 1 || adjacentSlots > DEFAULT_ADJACENT_SLOTS) {
    throw new Error(`adjacentSlots must be an integer from 1 to ${DEFAULT_ADJACENT_SLOTS} (got ${adjacentSlots})`);
  }
  const gear = input.gear ?? (input.className === 'warrior' || input.weapon ? 'none' : 'expected');
  if (!(['none', 'expected'] as const).includes(gear)) throw new Error(`unknown gear policy ${gear}`);
  const defensiveAffixes = input.defensiveAffixes ?? 'none';
  if (!(['none', 'expected'] as const).includes(defensiveAffixes)) {
    throw new Error(`unknown defensive-affix policy ${input.defensiveAffixes}`);
  }
  if (defensiveAffixes === 'expected' && gear !== 'expected') {
    throw new Error('defensiveAffixes:expected requires gear:expected');
  }
  const purchases = input.purchases ?? 'none';
  if (!(['none', 'defence'] as const).includes(purchases)) {
    throw new Error(`unknown purchase policy ${input.purchases}`);
  }
  if (purchases === 'defence' && gear !== 'expected') {
    throw new Error('purchases:defence requires gear:expected');
  }
  if (purchases === 'defence' && input.gameMode !== 'single') {
    throw new Error('purchases:defence models vanilla single-player stores only');
  }
  const sorcererCombatPolicy = input.sorcererCombatPolicy ?? 'mixed';
  if (!(['mixed', 'pure-spell'] as const).includes(sorcererCombatPolicy)) {
    throw new Error(`unknown Sorcerer combat policy ${input.sorcererCombatPolicy}`);
  }
  if (gear === 'expected' && input.weapon) throw new Error('gear:expected cannot be combined with a fixed weapon');
  const sustainIncome = input.sustainIncome ?? 'monster-gold';
  if (!(['monster-gold', 'gold-and-sales'] as const).includes(sustainIncome)) {
    throw new Error(`unknown sustain income policy ${input.sustainIncome}`);
  }
  const saleIdentify = input.saleIdentify ?? 'never';
  if (!(['never', 'when-profitable'] as const).includes(saleIdentify)) {
    throw new Error(`unknown sale identify policy ${input.saleIdentify}`);
  }
  if (saleIdentify === 'when-profitable' && sustainIncome !== 'gold-and-sales') {
    throw new Error('saleIdentify:when-profitable requires sustainIncome:gold-and-sales');
  }
  const saleItemsPerTrip = input.saleItemsPerTrip ?? DEFAULT_SALE_ITEMS_PER_TRIP_ASSUMPTION;
  if (!Number.isInteger(saleItemsPerTrip) || saleItemsPerTrip < 0) {
    throw new Error(`saleItemsPerTrip must be a non-negative integer (got ${saleItemsPerTrip})`);
  }
  const tilesPerLevel = input.tilesPerLevel ?? DEFAULT_TILES_PER_LEVEL_ASSUMPTION;
  if (!Number.isInteger(tilesPerLevel) || tilesPerLevel < 0) throw new Error(`tilesPerLevel must be a non-negative integer (got ${tilesPerLevel})`);

  const classWrapper = classWrapperFrom(input.wrappers, input.className);
  const lootEnabled = gear === 'expected' || sustainIncome === 'gold-and-sales';
  const startingWeapon = input.className === 'sorcerer' && sorcererCombatPolicy === 'mixed' && !input.weapon
    ? startingWeaponFrom(classWrapper, input.wrappers)
    : undefined;
  const coefficients = classCoefficients(classWrapper);
  const animations = classAnimations(classWrapper);
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
  const carriesPersistentState = input.initialState !== undefined;
  const initialState = validatedInitialState(
    input.initialState ?? defaultInitialState(input.className, classWrapper),
    input.className,
    maxima,
    curve.maxLevel,
  );
  const allocationAtLevel = (level: number) => spendStatPoints(
    initialState,
    initialState.unspentStatPoints + Math.max(0, level - initialState.level) * 5,
    input.policy,
    maxima,
    initialState.balancedAllocationCursor,
  );
  const buildAtLevel = (level: number, weapon: ReferenceWrapper | undefined) => {
    const build = referenceBuild(classWrapper, level, weapon);
    return { ...build, ...allocationAtLevel(level).attributes };
  };
  let heroLevel = initialState.level;
  let totalExperience = initialState.totalExperience;
  let killsSoFar = initialState.expectedGear?.killsSoFar ?? 0;
  const lootHistory: WeightedLootMonsterProfile[] = [...(initialState.expectedGear?.dropHistory ?? [])];
  const levels: DescentLevelResult[] = [];
  const goldFlowLevels: DescentGoldFlowLevel[] = [];
  const healingPotionPrice = gear === 'expected' ? consumablePrice(input.wrappers, 'HEAL', 'Healing') : 0;
  const manaPotionPrice = gear === 'expected' && input.className === 'sorcerer'
    ? consumablePrice(input.wrappers, 'MANA', 'Mana')
    : 0;
  const sustainBaseIds = new Set(input.wrappers.filter((wrapper) => wrapper.file === 'items/itemdat.tsv'
    && ['HEAL', 'FULLHEAL', 'MANA', 'FULLMANA'].includes(String(wrapper.raw.miscId).toUpperCase()))
    .map((wrapper) => wrapper.entity.id));
  const healingGoldShare = input.className === 'sorcerer' ? 0.5 : 1;
  const manaGoldShare = input.className === 'sorcerer' ? 0.5 : 0;
  let goldForNextDepth = initialState.gold;
  let goldBalance = initialState.gold;
  let carriedHealingPotions = initialState.potions.healing;
  let carriedFullHealingPotions = initialState.potions.fullHealing;
  let currentLife = initialState.currentLife;
  let currentMana: number | null = initialState.currentMana;
  let carriedManaPotions = initialState.potions.mana;
  let carriedFullManaPotions = initialState.potions.fullMana;
  let selectedWeaponId: string | null = initialState.expectedGear?.weapon.weaponId
    ?? startingWeapon?.entity.id
    ?? null;
  let selectedArmourIds = {
    body: initialState.expectedGear?.armour.slots.body.itemId ?? null,
    helm: initialState.expectedGear?.armour.slots.helm.itemId ?? null,
    shield: initialState.expectedGear?.armour.slots.shield.itemId ?? null,
  };
  let purchasedDefence = clonePurchasedDefenceState(initialState.purchasedDefence);

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
    const depthLootProfiles: WeightedLootMonsterProfile[] = lootEnabled
      ? pool.map((wrapper) => {
          const profile = monsterLootProfile(wrapper, {
            dungeonLevel: depth,
            dungeonType,
            gameMode: input.gameMode,
          });
          const row: WeightedLootMonsterProfile = {
            profile,
            difficulty: input.difficulty,
            weight: ambientPopulation / pool.length,
          };
          return Object.defineProperty(row, 'drop', {
            value: expectedDrop(profile, input.wrappers, input.wrappers, input.wrappers, input.difficulty),
            enumerable: false,
            configurable: false,
            writable: false,
          });
        })
      : [];

    const heroLevelBefore = heroLevel;
    const goldAvailableForPurchases = carriesPersistentState ? goldBalance : goldForNextDepth;
    let build = buildAtLevel(heroLevelBefore, input.weapon ?? startingWeapon);
    let weaponAssumed: BestWeaponExpectation | undefined;
    let armourAssumed: BestArmourExpectation | undefined;
    let defensiveAffixesAssumed: BestDefensiveAffixExpectation | undefined;
    let hitRecoveryTier: HitRecoveryTier = 'none';
    let expectedWeaponBase: ReferenceWrapper | undefined;
    let shieldAllowed = true;
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
      shieldAllowed = weaponPermitsShield(build, expectedWeaponBase);
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
      if (defensiveAffixes === 'expected') {
        defensiveAffixesAssumed = bestDefensiveAffixExpectation({
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
        build = { ...build, resistances: defensiveAffixesAssumed.resistances };
        hitRecoveryTier = defensiveAffixesAssumed.hitRecoveryTier;
      }
    }
    const withShieldTiming = (candidate: PlayerBuild): PlayerBuild => {
      if (!candidate.hasShield) return candidate;
      const weaponGraphic = shieldGraphic(candidate);
      return {
        ...candidate,
        weaponGraphic,
        swingSeconds: attackTiming(animations, weaponGraphic).seconds,
      };
    };
    const noPurchaseDefence = effectiveDefence(
      build,
      armourAssumed,
      defensiveAffixesAssumed,
      { slots: {} },
      shieldAllowed,
    );
    let effective = effectiveDefence(
      build,
      armourAssumed,
      defensiveAffixesAssumed,
      purchasedDefence,
      shieldAllowed,
    );
    build = withShieldTiming(effective.build);
    hitRecoveryTier = effective.hitRecoveryTier;
    const loot = lootEnabled ? expectedLootBudget({
      monsterProfiles: depthLootProfiles,
      itemWrappers: input.wrappers,
      affixWrappers: input.wrappers,
      uniqueItemWrappers: input.wrappers,
      difficulty: input.difficulty,
    }) : undefined;
    const mixedSorcerer = input.className === 'sorcerer' && sorcererCombatPolicy === 'mixed';
    const lifePool = lifeAndMana(build, coefficients).maximumLife / FIXED_POINT;
    if (!carriesPersistentState) currentLife = lifePool;
    else currentLife = Math.min(currentLife, lifePool);
    const currentLifeAtStart = currentLife;
    const manaPool = input.className === 'sorcerer'
      ? lifeAndMana(build, coefficients).maximumMana / FIXED_POINT
      : 0;
    if (input.className === 'sorcerer' && currentMana === null) currentMana = manaPool;
    const currentManaAtStart = currentMana ?? 0;
    let expectedGoldAllocated = input.className === 'sorcerer' && gear === 'expected'
      ? goldAvailableForPurchases * manaGoldShare
      : 0;
    let manaPotionsBought = input.className === 'sorcerer' && gear === 'expected'
      ? expectedGoldAllocated / manaPotionPrice
      : 0;
    const currentDepthManaPotions = sorcererCombatPolicy === 'pure-spell' ? loot?.expectedManaPotions ?? 0 : 0;
    const currentDepthFullManaPotions = sorcererCombatPolicy === 'pure-spell' ? loot?.expectedFullManaPotions ?? 0 : 0;
    let manaPotionsAvailable = carriedManaPotions + manaPotionsBought + currentDepthManaPotions;
    const fullManaPotionsAvailable = carriedFullManaPotions + currentDepthFullManaPotions;
    const manaRestoredPerPotion = input.className === 'sorcerer'
      ? expectedManaPotionMana(input.className, manaPool)
      : 0;
    let startManaBudget = currentManaAtStart
      + manaPotionsAvailable * manaRestoredPerPotion
      + fullManaPotionsAvailable * manaPool;
    const playerAttack: PlayerAttackMode = input.className === 'sorcerer'
      ? 'spell'
      : input.className === 'rogue' || build.weaponType === 'bow' ? 'ranged' : 'melee';
    const learnedSpells = playerAttack === 'spell'
      ? sorcererSpellAttacks(input.wrappers, depth, initialState.learnedSpells)
      : [];
    const playerCastSeconds = playerAttack === 'spell' ? castTiming(classAnimations(classWrapper)).seconds : undefined;
    const evaluateRows = (combatBuild: PlayerBuild, recoveryTier: HitRecoveryTier) => {
      const playerHitRecoverySeconds = hitRecoveryTiming(animations, recoveryTier).seconds;
      return pool.map((wrapper) => {
      const unique = wrapper.file === 'monsters/unique_monstdat.tsv';
      const base = unique ? ordinaryByType.get(wrapper.raw.type) : undefined;
      if (unique && !base) throw new Error(`${wrapper.entity.id} has no supplied monstdat base ${wrapper.raw.type}`);
      const monster = monsterProfile(wrapper, input.difficulty, base, input.gameMode);
      const exchange = playerAttack === 'melee'
        ? monsterUsesMissileWhenAdjacent(wrapper)
          ? monsterExchangeModel(wrapper, monster, base, input.wrappers)
          : undefined
        : monsterExchangeModel(wrapper, monster, base, input.wrappers);
      const runDuel = (attack: PlayerAttackMode, spell?: DuelSpellAttack) => duel(combatBuild, coefficients, monster, {
        gameMode: input.gameMode,
        playerAttack: attack,
        engagementDistance: DEFAULT_RANGED_ENGAGEMENT_DISTANCE,
        monsterApproachTilesPerSecond: attack === 'melee' ? undefined : exchange?.approachTilesPerSecond,
        spell,
        playerCastSeconds,
        monsterAttack: exchange?.monsterAttack ?? 'melee',
        monsterElement: exchange?.monsterElement,
        monsterDamage: exchange?.monsterDamage,
        monsterProjectilesPerAttack: exchange?.monsterProjectilesPerAttack,
        monsterDamageAlreadyShifted: exchange?.monsterDamageAlreadyShifted,
        // A hero in melee is adjacent to the monster it fights, whatever that monster's attack kind (W43 overseer: the
        // delivered version put a ranged target at 4 tiles even in duels, silently moving the mixed Sorcerer's default).
        // Only in packs do OTHER ranged members hold range; packMath carries that, not this per-target duel.
        monsterDistance: encounter === 'packs' && attack !== 'melee'
          && (exchange?.monsterAttack === 'ranged-arrow' || exchange?.monsterAttack === 'ranged-magic')
          ? DEFAULT_RANGED_ENGAGEMENT_DISTANCE
          : attack === 'melee' ? 1 : DEFAULT_RANGED_ENGAGEMENT_DISTANCE,
        dungeonLevel: depth,
        playerHitRecoverySeconds: encounter === 'packs' ? playerHitRecoverySeconds : undefined,
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
        throw new Error(`${classWrapper.entity.id} has no ${playerAttack} timing for ${combatBuild.weaponGraphic ?? combatBuild.weaponType}`);
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
        rangedMonster: exchange?.monsterAttack === 'ranged-arrow' || exchange?.monsterAttack === 'ranged-magic',
        expectedGotHitInterruptions: result.gotHit?.expectedInterruptionsBeforeKill ?? 0,
        ...(mixedSorcerer ? { meleeResult: result, spellResult: selected?.result } : {}),
      };
      });
    };
    const estimateDamage = (
      candidateRows: ReturnType<typeof evaluateRows>,
      recoveryTier: HitRecoveryTier,
    ): number => {
      if (ambientPopulation === 0) return 0;
      if (encounter === 'duel') {
        return candidateRows.reduce((sum, row) => sum + row.expectedDamageTaken, 0)
          / candidateRows.length * ambientPopulation;
      }
      const outcomes = ordinaryPackSizeDistribution(depth);
      const packSize = expectedPackSize(outcomes);
      const packsPerType = ambientPopulation / candidateRows.length / packSize;
      const recoverySeconds = hitRecoveryTiming(animations, recoveryTier).seconds;
      return candidateRows.reduce((sum, row) => {
        if (!Number.isFinite(row.seconds) || !Number.isFinite(row.expectedDamageTaken)
          || !Number.isFinite(row.expectedGotHitInterruptions)) return Infinity;
        const exchange = distributedPackExchange(outcomes, {
          secondsToKill: row.seconds,
          expectedDamageTaken: row.expectedDamageTaken,
          expectedGotHitInterruptions: row.expectedGotHitInterruptions,
          hitRecoverySeconds: recoverySeconds,
          ranged: row.rangedMonster,
        }, adjacentSlots);
        return sum + exchange.expectedDamageTakenPerPack * packsPerType;
      }, 0);
    };
    const noPurchaseRows = purchases === 'defence'
      ? evaluateRows(withShieldTiming(noPurchaseDefence.build), noPurchaseDefence.hitRecoveryTier)
      : undefined;
    const expectedDamageTakenWithoutPurchases = noPurchaseRows == null
      ? null
      : estimateDamage(noPurchaseRows, noPurchaseDefence.hitRecoveryTier);
    let evaluatedRows = evaluateRows(build, hitRecoveryTier);
    let defenceGoldSpent = 0;
    const boughtDefence: DescentPurchasedDefence[] = [];
    if (purchases === 'defence' && goldAvailableForPurchases > 0) {
      const storeStock = expectedDefensiveStoreStock({
        heroLevel: heroLevelBefore,
        deepestVisitedDepth: Math.max(0, depth - 1),
        strength: build.strength,
        magic: build.magic,
        dexterity: build.dexterity,
        shieldAllowed,
        wrappers: input.wrappers,
      });
      const candidates = storeStock.stores.flatMap((store) => store.offers.flatMap((offer) => {
        const offerKey = `${offer.store}:${offer.equipmentSlot}:${offer.target}:${offer.stockRank}`;
        if (offer.equipmentSlot !== 'ring1' || offer.stockRank !== 1) return [{ offer, offerKey }];
        return [
          { offer, offerKey },
          { offer: { ...offer, equipmentSlot: 'ring2' as const }, offerKey },
        ];
      }));
      const goldBudget = goldAvailableForPurchases * (1 - DEFENCE_POTION_RESERVE_FRACTION);
      const usedOffers = new Set<string>();
      let currentDamage = estimateDamage(evaluatedRows, hitRecoveryTier);
      while (defenceGoldSpent < goldBudget) {
        let best: {
          offer: ExpectedDefensiveStoreOffer;
          offerKey: string;
          state: DescentPurchasedDefenceState;
          effective: EffectiveDefence;
          build: PlayerBuild;
          rows: ReturnType<typeof evaluateRows>;
          damage: number;
          reduction: number;
          efficiency: number;
          saleCredit: number;
          netPrice: number;
          expectedGoldSpent: number;
        } | undefined;
        for (const candidate of candidates) {
          const offer = candidate.offer;
          if (usedOffers.has(candidate.offerKey)) continue;
          const previous = purchasedDefence.slots[offer.equipmentSlot];
          const saleCredit = previous?.expectedEquippedSaleValue ?? previous?.expectedSaleValue ?? 0;
          const netPrice = Math.max(0, offer.expectedPrice - saleCredit);
          const expectedGoldSpent = offer.availabilityProbability * netPrice;
          if (netPrice <= 0 || defenceGoldSpent + netPrice > goldBudget) continue;
          const conditionalState = clonePurchasedDefenceState(purchasedDefence);
          conditionalState.slots[offer.equipmentSlot] = {
            ...offer,
            resistances: { ...offer.resistances },
            boughtAtDepth: depth,
            saleCredit,
            netPrice,
            expectedGoldSpent,
            expectedDamageReduction: 0,
            expectedDamageReductionPerGold: 0,
            expectedArmourClass: offer.armourClass,
            expectedResistances: { ...offer.resistances },
            expectedHitRecoverySkippedFrames: offer.hitRecoverySkippedFrames,
            expectedEquippedSaleValue: offer.expectedSaleValue,
          };
          const conditionalEffective = effectiveDefence(
            noPurchaseDefence.build,
            armourAssumed,
            defensiveAffixesAssumed,
            conditionalState,
            shieldAllowed,
          );
          const conditionalBuild = withShieldTiming(conditionalEffective.build);
          const conditionalRows = evaluateRows(conditionalBuild, conditionalEffective.hitRecoveryTier);
          const conditionalDamage = estimateDamage(conditionalRows, conditionalEffective.hitRecoveryTier);
          const reduction = Number.isFinite(currentDamage) && Number.isFinite(conditionalDamage)
            ? Math.max(0, currentDamage - conditionalDamage)
            : !Number.isFinite(currentDamage) && Number.isFinite(conditionalDamage)
              ? Number.MAX_VALUE
              : 0;
          const efficiency = reduction / netPrice;
          const availability = offer.availabilityProbability;
          const previousArmour = previous?.expectedArmourClass ?? previous?.armourClass ?? 0;
          const previousResistances = previous?.expectedResistances
            ?? previous?.resistances
            ?? { magic: 0, fire: 0, lightning: 0 };
          const previousRecovery = previous?.expectedHitRecoverySkippedFrames
            ?? previous?.hitRecoverySkippedFrames ?? 0;
          const previousSaleValue = previous?.expectedEquippedSaleValue ?? previous?.expectedSaleValue ?? 0;
          const state = clonePurchasedDefenceState(purchasedDefence);
          state.slots[offer.equipmentSlot] = {
            ...offer,
            resistances: { ...offer.resistances },
            boughtAtDepth: depth,
            saleCredit,
            netPrice,
            expectedGoldSpent,
            expectedDamageReduction: availability * reduction,
            expectedDamageReductionPerGold: efficiency,
            expectedArmourClass: availability * offer.armourClass + (1 - availability) * previousArmour,
            expectedResistances: {
              magic: availability * offer.resistances.magic + (1 - availability) * previousResistances.magic,
              fire: availability * offer.resistances.fire + (1 - availability) * previousResistances.fire,
              lightning: availability * offer.resistances.lightning
                + (1 - availability) * previousResistances.lightning,
            },
            expectedHitRecoverySkippedFrames: availability * offer.hitRecoverySkippedFrames
              + (1 - availability) * previousRecovery,
            expectedEquippedSaleValue: availability * offer.expectedSaleValue
              + (1 - availability) * previousSaleValue,
          };
          const candidateEffective = effectiveDefence(
            noPurchaseDefence.build,
            armourAssumed,
            defensiveAffixesAssumed,
            state,
            shieldAllowed,
          );
          const candidateBuild = withShieldTiming(candidateEffective.build);
          const candidateRows = evaluateRows(candidateBuild, candidateEffective.hitRecoveryTier);
          const candidateDamage = estimateDamage(candidateRows, candidateEffective.hitRecoveryTier);
          const stableId = `${offer.store}:${offer.equipmentSlot}:${offer.target}`;
          const bestStableId = best == null
            ? ''
            : `${best.offer.store}:${best.offer.equipmentSlot}:${best.offer.target}`;
          if (efficiency > 0 && (best == null
            || efficiency > best.efficiency
            || efficiency === best.efficiency && reduction > best.reduction
            || efficiency === best.efficiency && reduction === best.reduction
              && (netPrice < best.netPrice
                || netPrice === best.netPrice && stableId.localeCompare(bestStableId) < 0))) {
            best = {
              offer,
              offerKey: candidate.offerKey,
              state,
              effective: candidateEffective,
              build: candidateBuild,
              rows: candidateRows,
              damage: candidateDamage,
              reduction,
              efficiency,
              saleCredit,
              netPrice,
              expectedGoldSpent,
            };
          }
        }
        if (!best) break;
        const purchase: DescentPurchasedDefence = {
          ...best.offer,
          resistances: { ...best.offer.resistances },
          boughtAtDepth: depth,
          saleCredit: best.saleCredit,
          netPrice: best.netPrice,
          expectedGoldSpent: best.expectedGoldSpent,
          expectedDamageReduction: best.offer.availabilityProbability * best.reduction,
          expectedDamageReductionPerGold: best.efficiency,
          expectedArmourClass: best.state.slots[best.offer.equipmentSlot]!.expectedArmourClass,
          expectedResistances: {
            ...best.state.slots[best.offer.equipmentSlot]!.expectedResistances,
          },
          expectedHitRecoverySkippedFrames:
            best.state.slots[best.offer.equipmentSlot]!.expectedHitRecoverySkippedFrames,
          expectedEquippedSaleValue:
            best.state.slots[best.offer.equipmentSlot]!.expectedEquippedSaleValue,
        };
        best.state.slots[best.offer.equipmentSlot] = purchase;
        purchasedDefence = best.state;
        effective = best.effective;
        build = best.build;
        hitRecoveryTier = best.effective.hitRecoveryTier;
        evaluatedRows = best.rows;
        currentDamage = best.damage;
        defenceGoldSpent += best.expectedGoldSpent;
        boughtDefence.push(purchase);
        usedOffers.add(best.offerKey);
      }
    }
    const goldAvailableForPotions = purchases === 'defence'
      ? goldAvailableForPurchases * DEFENCE_POTION_RESERVE_FRACTION
      : goldAvailableForPurchases;
    expectedGoldAllocated = input.className === 'sorcerer' && gear === 'expected'
      ? goldAvailableForPotions * manaGoldShare
      : 0;
    manaPotionsBought = input.className === 'sorcerer' && gear === 'expected'
      ? expectedGoldAllocated / manaPotionPrice
      : 0;
    manaPotionsAvailable = carriedManaPotions + manaPotionsBought + currentDepthManaPotions;
    startManaBudget = currentManaAtStart
      + manaPotionsAvailable * manaRestoredPerPotion
      + fullManaPotionsAvailable * manaPool;
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
        expectedGotHitInterruptions: spellResult
          ? blend(
              meleeResult.gotHit?.expectedInterruptionsBeforeKill ?? 0,
              spellResult.gotHit?.expectedInterruptionsBeforeKill ?? 0,
            )
          : row.expectedGotHitInterruptions,
        spellExpectedKills: spellKills,
      };
    });
    const meanXp = rows.reduce((sum, row) => sum + row.xp, 0) / divisor;
    const uncappedXp = meanXp * ambientPopulation;
    const expectedXpGained = Math.min(uncappedXp, Math.max(0, maximumExperience - totalExperience));
    const duelExpectedSeconds = ambientPopulation === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.seconds, 0) / divisor * ambientPopulation;
    const duelExpectedDamage = ambientPopulation === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.expectedDamageTaken, 0) / divisor * ambientPopulation;
    const playerHitRecoverySeconds = hitRecoveryTiming(animations, hitRecoveryTier).seconds;
    const packSizeOutcomes = ordinaryPackSizeDistribution(depth);
    const placementPackSize = expectedPackSize(packSizeOutcomes);
    const packRows = encounter === 'packs' ? rows.map((row) => {
      if (!Number.isFinite(row.seconds) || !Number.isFinite(row.expectedDamageTaken)
        || !Number.isFinite(row.expectedGotHitInterruptions)) {
        return {
          wrapper: row.wrapper,
          secondsPerPack: Infinity,
          expectedDamageTakenPerPack: Infinity,
          expectedGotHitInterruptionsPerPack: Infinity,
        };
      }
      return {
        wrapper: row.wrapper,
        ...distributedPackExchange(packSizeOutcomes, {
          secondsToKill: row.seconds,
          expectedDamageTaken: row.expectedDamageTaken,
          expectedGotHitInterruptions: row.expectedGotHitInterruptions,
          hitRecoverySeconds: playerHitRecoverySeconds,
          ranged: row.rangedMonster,
        }, adjacentSlots),
      };
    }) : [];
    const packsPerType = expectedKillsPerType / placementPackSize;
    const expectedSeconds = encounter === 'packs'
      ? ambientPopulation === 0 ? 0 : packRows.reduce((sum, row) => sum + row.secondsPerPack * packsPerType, 0)
      : duelExpectedSeconds;
    const expectedDamage = encounter === 'packs'
      ? ambientPopulation === 0 ? 0 : packRows.reduce((sum, row) => sum + row.expectedDamageTakenPerPack * packsPerType, 0)
      : duelExpectedDamage;
    const expectedGotHitInterruptions = encounter === 'packs'
      ? ambientPopulation === 0 ? 0 : packRows.reduce((sum, row) => sum + row.expectedGotHitInterruptionsPerPack * packsPerType, 0)
      : 0;
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
    if (loot && gear === 'expected') {
      const healingPotionsBought = goldAvailableForPotions * healingGoldShare / healingPotionPrice;
      const healingPotionsAvailable = carriedHealingPotions + healingPotionsBought + loot.expectedHealingPotions;
      const fullHealingPotionsAvailable = carriedFullHealingPotions + loot.expectedFullHealingPotions;
      const lifeRestoredPerHealingPotion = expectedHealingPotionLife(input.className, lifePool);
      const healingSupply = healingPotionsAvailable * lifeRestoredPerHealingPotion
        + fullHealingPotionsAvailable * lifePool;
      const lifeAvailable = carriesPersistentState ? currentLifeAtStart : lifePool;
      const arithmetic = Number.isFinite(expectedDamage)
        ? sustainArithmetic({
            expectedDamageTaken: expectedDamage,
            lifePool: lifeAvailable,
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
        Math.max(0, expectedDamage - lifeAvailable),
        lifeRestoredPerHealingPotion,
        lifePool,
      );
      const restored = (healingPotionsAvailable - remaining.healingPotions) * lifeRestoredPerHealingPotion
        + (fullHealingPotionsAvailable - remaining.fullHealingPotions) * lifePool;
      currentLife = Number.isFinite(expectedDamage)
        ? Math.max(0, Math.min(lifePool, lifeAvailable + restored - expectedDamage))
        : 0;
      carriedHealingPotions = remaining.healingPotions;
      carriedFullHealingPotions = remaining.fullHealingPotions;
    } else {
      currentLife = Number.isFinite(expectedDamage)
        ? Math.max(0, currentLifeAtStart - expectedDamage)
        : 0;
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
    } else if (loot) {
      carriedManaPotions += loot.expectedManaPotions;
      carriedFullManaPotions += loot.expectedFullManaPotions;
    }
    totalExperience += expectedXpGained;
    heroLevel = levelAt(totalExperience, heroLevelBefore, curve);
    if (heroLevel > heroLevelBefore) {
      currentLife = lifeAndMana(buildAtLevel(heroLevel, input.weapon ?? startingWeapon), coefficients).maximumLife
        / FIXED_POINT;
      currentMana = null;
    }
    let sale: ExpectedSaleValue | undefined;
    if (loot && sustainIncome === 'gold-and-sales') {
      const keptBaseCounts = new Map<string, number>();
      if (gear === 'expected') {
        const prospectiveHistory = [...lootHistory, ...depthLootProfiles];
        const prospectiveKills = killsSoFar + ambientPopulation;
        let nextBuild = buildAtLevel(heroLevel, startingWeapon);
        const nextWeapon = bestWeaponExpectation({
          class: nextBuild.class,
          depth: depth + 1,
          killsSoFar: prospectiveKills,
          monsterProfiles: prospectiveHistory,
          itemWrappers: input.wrappers,
          affixWrappers: input.wrappers,
          uniqueItemWrappers: input.wrappers,
          difficulty: input.difficulty,
          strength: nextBuild.strength,
          magic: nextBuild.magic,
          dexterity: nextBuild.dexterity,
          fallbackWeapon: startingWeapon,
        });
        const nextWeaponBase = nextWeapon.weaponId == null
          ? undefined
          : input.wrappers.find((wrapper) => wrapper.file === 'items/itemdat.tsv' && wrapper.entity.id === nextWeapon.weaponId);
        if (nextWeapon.weaponId != null && !nextWeaponBase) {
          throw new Error(`expected weapon base ${nextWeapon.weaponId} is not supplied`);
        }
        if (nextWeaponBase) {
          const equipped = referenceBuild(classWrapper, heroLevel, nextWeaponBase);
          nextBuild = { ...nextBuild, weaponType: equipped.weaponType };
        }
        const nextArmour = bestArmourExpectation({
          className: nextBuild.class,
          depth: depth + 1,
          killsSoFar: prospectiveKills,
          monsterProfiles: prospectiveHistory,
          itemWrappers: input.wrappers,
          affixWrappers: input.wrappers,
          uniqueItemWrappers: input.wrappers,
          difficulty: input.difficulty,
          strength: nextBuild.strength,
          magic: nextBuild.magic,
          dexterity: nextBuild.dexterity,
          shieldAllowed: weaponPermitsShield(nextBuild, nextWeaponBase),
        });
        const keepIfChanged = (previousId: string | null, nextId: string | null) => {
          if (nextId != null && nextId !== previousId) {
            keptBaseCounts.set(nextId, (keptBaseCounts.get(nextId) ?? 0) + 1);
          }
        };
        keepIfChanged(selectedWeaponId, nextWeapon.weaponId);
        keepIfChanged(selectedArmourIds.body, nextArmour.slots.body.itemId);
        keepIfChanged(selectedArmourIds.helm, nextArmour.slots.helm.itemId);
        keepIfChanged(selectedArmourIds.shield, nextArmour.slots.shield.itemId);
        selectedWeaponId = nextWeapon.weaponId;
        selectedArmourIds = {
          body: nextArmour.slots.body.itemId,
          helm: nextArmour.slots.helm.itemId,
          shield: nextArmour.slots.shield.itemId,
        };
      }
      sale = expectedSaleIncome({
        monsterProfiles: depthLootProfiles,
        itemWrappers: input.wrappers,
        affixWrappers: input.wrappers,
        uniqueItemWrappers: input.wrappers,
        difficulty: input.difficulty,
        itemsPerTrip: saleItemsPerTrip,
        keptBaseCounts,
        excludedBaseIds: sustainBaseIds,
        saleIdentify,
      });
      if (sustain) {
        sustain.expectedGoldFromSales = sale.expectedGold;
        sustain.expectedGoldIncome = loot.expectedGold + sale.expectedGold - (sale.expectedIdentifyFees ?? 0);
      }
    }
    const goldIncome = loot ? loot.expectedGold + (sale?.expectedGold ?? 0) : 0;
    const identifyGoldSpent = sale?.expectedIdentifyFees ?? 0;
    const potionGoldSpent = (sustain?.healingPotionsBought ?? 0) * healingPotionPrice
      + (mana?.manaPotionsBought ?? 0) * manaPotionPrice;
    goldBalance = Math.max(0, goldBalance + goldIncome - potionGoldSpent - defenceGoldSpent - identifyGoldSpent);
    if (loot) goldForNextDepth = purchases === 'defence' ? goldBalance : goldIncome - identifyGoldSpent;
    if (loot && sale) {
      const faucets: DescentGoldFaucets = {
        monsterGold: loot.expectedGold,
        sales: sale.expectedGold,
        total: loot.expectedGold + sale.expectedGold,
      };
      const sinks: DescentGoldSinks = {
        potionsBought: potionGoldSpent,
        ...(purchases === 'defence' ? { defenceBought: defenceGoldSpent } : {}),
        repair: 0,
        identify: identifyGoldSpent,
        total: potionGoldSpent + defenceGoldSpent + identifyGoldSpent,
      };
      const clearHours = Number.isFinite(expectedSeconds) ? expectedSeconds / 3_600 : null;
      const perHour = clearHours != null && clearHours > 0 ? {
        faucets: {
          monsterGold: faucets.monsterGold / clearHours,
          sales: faucets.sales / clearHours,
          total: faucets.total / clearHours,
        },
        sinks: {
          potionsBought: sinks.potionsBought / clearHours,
          ...(purchases === 'defence' ? { defenceBought: defenceGoldSpent / clearHours } : {}),
          repair: 0,
          identify: identifyGoldSpent / clearHours,
          total: sinks.total / clearHours,
        },
        net: (faucets.total - sinks.total) / clearHours,
      } : null;
      goldFlowLevels.push({
        depth,
        clearHours,
        faucets,
        sinks,
        net: faucets.total - sinks.total,
        perHour,
        sales: sale,
      });
    }
    const damageMultiplier = duelExpectedDamage === 0
      ? expectedDamage === 0 ? 1 : Infinity
      : expectedDamage / duelExpectedDamage;
    const packExpectation: DescentPackExpectation | undefined = encounter === 'packs' ? {
      adjacentSlots,
      expectedPackSize: placementPackSize,
      expectedPacks: ambientPopulation / placementPackSize,
      damageMultiplierVsDuel: finiteOrNull(damageMultiplier),
      expectedGotHitInterruptions: finiteOrNull(expectedGotHitInterruptions),
      sustainable: (sustain?.sustainable
        ?? (Number.isFinite(expectedDamage)
          && expectedDamage <= lifeAndMana(build, coefficients).maximumLife / FIXED_POINT))
        && (mana?.sustainable ?? true),
      typePackSizes: pool.map((wrapper) => ({
        monsterId: wrapper.entity.id,
        monster: wrapper.entity.name,
        expectedPackSize: placementPackSize,
      })),
      eligibleUniquePacks: uniqueIds.map((monsterId) => {
        const wrapper = bestiaryById.get(monsterId);
        const pack = wrapper?.raw.monsterPack ?? wrapper?.entity.data.pack;
        return {
          monsterId,
          monster: wrapper?.entity.name ?? monsterId,
          pack: pack == null ? 'unresolved' : String(pack),
          requestedPackSize: pack == null ? null : requestedUniquePackSize(pack),
        };
      }),
    } : undefined;
    const difficultyRows = encounter === 'packs'
      ? rows.map((row, index) => ({
          ...row,
          expectedDamageTaken: packRows[index].expectedDamageTakenPerPack / placementPackSize,
        }))
      : rows;
    const notes = [
      encounter === 'duel'
        ? `Uniform expectation across ${pool.length} eligible ordinary type${pool.length === 1 ? '' : 's'}; ${ambientPopulation} sequential ambient kills.`
        : `Uniform expectation across ${pool.length} eligible ordinary type${pool.length === 1 ? '' : 's'}; ${ambientPopulation} ambient kills in ${String(ambientPopulation / placementPackSize)} expected simultaneous packs.`,
      `${uniqueIds.length} eligible unique row${uniqueIds.length === 1 ? '' : 's'} excluded because actual roster and quest conditions are unresolved.`,
      ...(depth === 16 ? ['Depth 16 uses the range-eligible pool as an explicit proxy; d1-monster-type-selection says the engine skips its random draw for the authored fixed roster.'] : []),
    ];
    const noPurchaseDamage = expectedDamageTakenWithoutPurchases ?? expectedDamage;
    const noPurchaseHealingSupply = (sustain?.healingSupply ?? 0)
      + defenceGoldSpent * healingGoldShare / healingPotionPrice
        * expectedHealingPotionLife(input.className, lifePool);
    const defencePurchaseReport: DescentDefencePurchaseReport | undefined = purchases === 'defence' ? {
      potionReserveFraction: DEFENCE_POTION_RESERVE_FRACTION,
      goldAvailable: goldAvailableForPurchases,
      goldBudget: goldAvailableForPurchases * (1 - DEFENCE_POTION_RESERVE_FRACTION),
      goldSpent: defenceGoldSpent,
      bought: boughtDefence,
      resultingArmourClass: effective.armourClass,
      resultingResistances: { ...effective.resistances },
      resultingHitRecoveryTier: effective.hitRecoveryTier,
      expectedDamageTakenWithoutPurchases: finiteOrNull(noPurchaseDamage),
      expectedDamageReduction: Number.isFinite(noPurchaseDamage) && Number.isFinite(expectedDamage)
        ? Math.max(0, noPurchaseDamage - expectedDamage)
        : null,
      sustainableWithoutPurchases: Number.isFinite(noPurchaseDamage)
        && noPurchaseDamage <= currentLifeAtStart + noPurchaseHealingSupply
        && (mana?.sustainable ?? true),
    } : undefined;
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
      hardestMonster: hardest(difficultyRows),
      note: notes.join(' '),
      ...(playerAttack !== 'melee' ? { attackMode: playerAttack } : {}),
      ...(spellAssumed ? { spellAssumed } : {}),
      ...(playerAttack === 'spell' ? { spellsUsed, unboundedMonsters } : {}),
      ...(approach ? { approach } : {}),
      ...(mana ? { mana } : {}),
      ...(weaponAssumed ? { weaponAssumed } : {}),
      ...(armourAssumed && sustain ? { armourAssumed, expectedBlockChance, sustain } : {}),
      ...(defensiveAffixesAssumed ? { defensiveAffixesAssumed } : {}),
      ...(packExpectation ? { pack: packExpectation } : {}),
      ...(defencePurchaseReport ? { defencePurchases: defencePurchaseReport } : {}),
    });
    if (gear === 'expected' && ambientPopulation > 0) {
      lootHistory.push(...depthLootProfiles);
      killsSoFar += ambientPopulation;
    }
  }

  const finalAllocation = allocationAtLevel(heroLevel);
  let finalBuild = buildAtLevel(heroLevel, input.weapon ?? startingWeapon);
  let expectedGear: DescentExpectedGearState | undefined;
  if (gear === 'expected') {
    const weapon = bestWeaponExpectation({
      class: finalBuild.class,
      depth: 16,
      killsSoFar,
      monsterProfiles: lootHistory,
      itemWrappers: input.wrappers,
      affixWrappers: input.wrappers,
      uniqueItemWrappers: input.wrappers,
      difficulty: input.difficulty,
      strength: finalBuild.strength,
      magic: finalBuild.magic,
      dexterity: finalBuild.dexterity,
      fallbackWeapon: startingWeapon,
    });
    const weaponBase = weapon.weaponId == null
      ? undefined
      : input.wrappers.find((wrapper) => wrapper.file === 'items/itemdat.tsv' && wrapper.entity.id === weapon.weaponId);
    if (weapon.weaponId != null && !weaponBase) throw new Error(`expected weapon base ${weapon.weaponId} is not supplied`);
    if (weaponBase) {
      const equipped = referenceBuild(classWrapper, heroLevel, weaponBase);
      finalBuild = { ...finalBuild, weaponType: equipped.weaponType };
    }
    const shieldAllowed = weaponPermitsShield(finalBuild, weaponBase);
    const armour = bestArmourExpectation({
      className: finalBuild.class,
      depth: 16,
      killsSoFar,
      monsterProfiles: lootHistory,
      itemWrappers: input.wrappers,
      affixWrappers: input.wrappers,
      uniqueItemWrappers: input.wrappers,
      difficulty: input.difficulty,
      strength: finalBuild.strength,
      magic: finalBuild.magic,
      dexterity: finalBuild.dexterity,
      shieldAllowed,
    });
    const finalDefensiveAffixes = defensiveAffixes === 'expected'
      ? bestDefensiveAffixExpectation({
          depth: 16,
          killsSoFar,
          monsterProfiles: lootHistory,
          itemWrappers: input.wrappers,
          affixWrappers: input.wrappers,
          uniqueItemWrappers: input.wrappers,
          difficulty: input.difficulty,
          strength: finalBuild.strength,
          magic: finalBuild.magic,
          dexterity: finalBuild.dexterity,
          shieldAllowed,
        })
      : undefined;
    expectedGear = {
      killsSoFar,
      dropHistory: lootHistory.map(cloneLootProfile),
      weapon,
      armour,
      ...(finalDefensiveAffixes ? { defensiveAffixes: finalDefensiveAffixes } : {}),
    };
  }
  const finalPools = lifeAndMana(finalBuild, coefficients);
  const maximumLife = finalPools.maximumLife / FIXED_POINT;
  const maximumMana = finalPools.maximumMana / FIXED_POINT;
  const learnedSpells = new Map(initialState.learnedSpells.map((spell) => [spell.spell.toLowerCase(), { ...spell }]));
  if (input.className === 'sorcerer') {
    for (const spell of SORCERER_SPELL_PROGRESSION) {
      const id = spell.spell.toLowerCase();
      const previous = learnedSpells.get(id);
      if (!previous || previous.spellLevel < spell.spellLevel) {
        learnedSpells.set(id, { spell: spell.spell, spellLevel: spell.spellLevel });
      }
    }
  }
  const finalState: DescentFinalState = {
    className: input.className,
    level: heroLevel,
    totalExperience,
    ...finalAllocation.attributes,
    unspentStatPoints: finalAllocation.unspentStatPoints,
    balancedAllocationCursor: finalAllocation.balancedAllocationCursor,
    currentLife: Math.min(currentLife, maximumLife),
    maximumLife,
    currentMana: Math.min(currentMana ?? maximumMana, maximumMana),
    maximumMana,
    learnedSpells: [...learnedSpells.values()],
    ...(expectedGear ? { expectedGear } : {}),
    gold: goldBalance,
    potions: {
      healing: carriedHealingPotions,
      fullHealing: carriedFullHealingPotions,
      mana: carriedManaPotions,
      fullMana: carriedFullManaPotions,
    },
    ...(purchases === 'defence' ? { purchasedDefence: clonePurchasedDefenceState(purchasedDefence) } : {}),
    diabloKillRank: initialState.diabloKillRank + 1,
    completedDifficulties: [...initialState.completedDifficulties, input.difficulty],
    completedDifficulty: input.difficulty,
  };
  const simulation = {
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
    ...(defensiveAffixes === 'expected' ? { defensiveAffixes } : {}),
    ...(encounter === 'packs' ? { encounter, adjacentSlots } : {}),
    ...(purchases === 'defence' ? { purchases } : {}),
    ...(saleIdentify === 'when-profitable' ? { saleIdentify } : {}),
    assumptions: assumptions(
      tilesPerLevel,
      input.policy,
      gear,
      input.className,
      sorcererCombatPolicy,
      sustainIncome,
      saleItemsPerTrip,
      saleIdentify,
      encounter,
      adjacentSlots,
      defensiveAffixes,
      purchases,
    ),
    levels,
    ...(sustainIncome === 'gold-and-sales' ? { goldFlow: summarizeGoldFlow(goldFlowLevels, saleItemsPerTrip) } : {}),
  } as Omit<DescentSimulation, 'finalState'>;
  return Object.defineProperty(simulation, 'finalState', {
    value: finalState,
    enumerable: false,
    configurable: false,
    writable: false,
  }) as DescentSimulation;
}

/** Simulate fresh single-player games while carrying only the deterministic hero expectation. */
export function simulateDifficultyChain(input: SimulateDifficultyChainInput): DescentDifficultyChain {
  if (input.gameMode !== 'single') throw new Error('difficulty chaining models single-player only');
  const difficulties = [...(input.difficulties ?? ['normal', 'nightmare', 'hell'])];
  if (difficulties.length === 0) throw new Error('difficulty chaining requires at least one leg');
  for (const difficulty of difficulties) {
    if (!(['normal', 'nightmare', 'hell'] as const).includes(difficulty)) {
      throw new Error(`unknown difficulty ${difficulty}`);
    }
  }
  const { difficulties: _difficulties, initialHeroState, ...oneLegInput } = input;
  void _difficulties;
  let carried: DescentInitialState = initialHeroState
    ?? defaultInitialState(input.className, classWrapperFrom(input.wrappers, input.className));
  const legs: DescentDifficultyChainLeg[] = [];
  const summaries: DescentDifficultyChainLegSummary[] = [];
  for (const [index, difficulty] of difficulties.entries()) {
    const simulation = simulateDescent({
      ...oneLegInput,
      difficulty,
      initialState: carried,
    });
    const initialState = carried;
    const finalState = simulation.finalState;
    legs.push({
      ...simulation,
      initialState,
      finalState,
      precedingLegCompleted: index > 0,
    });
    const firstUnsustainableDepth = simulation.levels.find((level) =>
      level.sustain?.sustainable === false || level.pack?.sustainable === false)?.depth ?? null;
    summaries.push({
      difficulty,
      levelAtEnd: finalState.level,
      firstUnsustainableDepth,
      ...(simulation.encounter === 'packs' ? {
        stunLockDepths: simulation.levels.filter((level) =>
          level.pack !== undefined
          && level.expectedSecondsToClear === null
          && (level.unboundedMonsters?.length ?? 0) === 0).map((level) => level.depth),
      } : {}),
    });
    carried = finalState;
  }
  return {
    model: 'deterministic-expectation-chain',
    className: input.className,
    policy: input.policy,
    gameMode: 'single',
    difficulties,
    legs,
    summary: { legs: summaries },
    finalState: legs[legs.length - 1].finalState,
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
    ...(simulation.defensiveAffixes === 'expected' ? ['expected-defensive-affixes'] : []),
    ...(simulation.purchases === 'defence' ? ['expected-defensive-store-purchases'] : []),
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
        ...(simulation.defensiveAffixes === 'expected'
          ? { defensiveAffixes: simulation.defensiveAffixes }
          : {}),
        ...(simulation.purchases === 'defence' ? { purchases: simulation.purchases } : {}),
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
