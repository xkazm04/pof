/** Pure Diablo I loot expectations over caller-supplied reference wrappers. */
import type {
  Difficulty,
  HitRecoveryTier,
  PlayerClass,
  Resistances,
  WeaponType,
} from '@/lib/catalog/reference/combatMath';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const ORDINARY_NOTHING = 0.59;
const ORDINARY_DIRECT_GOLD = 0.3034;
const ORDINARY_POOL = 0.1066;

export const CAIN_IDENTIFY_FEE = 100;
export type SaleIdentifyPolicy = 'never' | 'when-profitable';

export const MAGIC_AFFIX_ALLOCATION = {
  prefixOnly: 5 / 24,
  suffixOnly: 5 / 8,
  both: 1 / 6,
} as const;

export interface LootMonsterProfile {
  monsterId: string;
  /** Normal-difficulty level used by base selection; expectedDrop adds the selected difficulty bonus. */
  baseSelectionLevel: number;
  /** Raw base-archetype level used by quality and affix generation on every difficulty. */
  generationLevel: number;
  dungeonLevel: number;
  dungeonType?: string;
  unique?: boolean;
  noDrop?: boolean;
  gameMode?: 'single' | 'multi';
  hellfire?: boolean;
  /** False models the global active-item limit suppressing this kill's item. */
  itemCapacityAvailable?: boolean;
  /** Single-player identities already obtained; multiplayer permits repeats and ignores this set. */
  obtainedUniqueIds?: readonly string[];
}

export interface MonsterLootProfileOptions {
  dungeonLevel: number;
  dungeonType?: string;
  /** Required when wrapper is a unique-monster row. */
  baseWrapper?: ReferenceWrapper;
  gameMode?: 'single' | 'multi';
  hellfire?: boolean;
  itemCapacityAvailable?: boolean;
  obtainedUniqueIds?: readonly string[];
}

export interface AffixOutcomeProbabilities {
  none: number;
  prefixOnly: number;
  suffixOnly: number;
  both: number;
  expectedCount: number;
}

export interface BaseQualityExpectation {
  baseId: string;
  generationLevel: number;
  bonusLevel: number;
  pSelected: number;
  pBonus: number;
  pNormal: number;
  pMagic: number;
  pUnique: number;
  pPositiveDamageAffix: number;
  expectedPositiveDamagePercent: number;
  affixes: AffixOutcomeProbabilities;
}

export interface DropExpectation {
  /** All probabilities are unconditional per kill. */
  pNothing: number;
  pGold: number;
  /** Unconditional gold per kill, including the chance that no gold drops. */
  expectedGold: number;
  /** Unconditional probability of each non-gold base per kill. */
  basePool: { baseId: string; p: number }[];
  /** Aggregate unconditional probability of a Magic item per kill. */
  pMagic: number;
  /** Aggregate unconditional probability of a Unique item per kill. */
  pUnique: number;
  baseQuality: BaseQualityExpectation[];
  affixes: {
    /** Request allocation before eligibility can turn a requested slot into no affix. */
    allocation: typeof MAGIC_AFFIX_ALLOCATION;
    /** Applied-affix outcome per kill, so `none` also includes no item, gold, Normal, and Unique. */
    perKill: AffixOutcomeProbabilities;
  };
  notes: string[];
}

interface AffixRow {
  id: string;
  side: 'prefix' | 'suffix';
  power: string;
  minLevel: number;
  itemTypes: string[];
  alignment: 'any' | 'good' | 'evil';
  chance: number;
  useful: boolean;
  valueMin: number;
  valueMax: number;
  priceMin: number;
  priceMax: number;
  priceMultiplier: number;
}

interface InternalAffixOutcome extends AffixOutcomeProbabilities {
  pPositiveDamage: number;
  expectedPositiveDamagePercent: number;
  pPositiveArmour: number;
  expectedPositiveArmourPercent: number;
}

interface AffixChoice {
  row: AffixRow | null;
  p: number;
}

interface AffixPairChoice {
  prefix: AffixRow | null;
  suffix: AffixRow | null;
  p: number;
}

const difficultyLevelBonus = (difficulty: Difficulty) => difficulty === 'nightmare' ? 15 : difficulty === 'hell' ? 30 : 0;
const difficultyGoldOffset = (difficulty: Difficulty) => difficulty === 'nightmare' ? 16 : difficulty === 'hell' ? 32 : 0;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function finiteNumber(value: unknown, owner: string): number {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`${owner} is not numeric`);
  return result;
}

function optionalNumber(value: unknown): number | null {
  if (value == null || String(value).trim() === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function stat(wrapper: ReferenceWrapper, label: string): number | null {
  const stats = wrapper.entity.data.stats;
  if (!Array.isArray(stats)) return null;
  const entry = stats.find((candidate) => candidate != null && typeof candidate === 'object'
    && (candidate as { label?: unknown }).label === label) as { value?: unknown } | undefined;
  return optionalNumber(entry?.value);
}

function monsterLevel(wrapper: ReferenceWrapper): number {
  return finiteNumber(wrapper.raw.level ?? stat(wrapper, 'Level'), `${wrapper.entity.id}.level`);
}

/** Translate an ordinary or named monster wrapper into the two-level loot profile. */
export function monsterLootProfile(
  wrapper: ReferenceWrapper,
  options: MonsterLootProfileOptions,
): LootMonsterProfile {
  if (wrapper.catalogId !== 'bestiary') throw new Error(`${wrapper.entity.id} is not a bestiary wrapper`);
  if (!Number.isInteger(options.dungeonLevel) || options.dungeonLevel < 1) {
    throw new Error(`dungeonLevel must be a positive integer (got ${options.dungeonLevel})`);
  }
  const unique = wrapper.file === 'monsters/unique_monstdat.tsv';
  if (unique) {
    const base = options.baseWrapper;
    if (!base || base.file !== 'monsters/monstdat.tsv' || base.raw._monster_id !== wrapper.raw.type) {
      throw new Error(`${wrapper.entity.id} requires its monstdat base wrapper`);
    }
    const declared = monsterLevel(wrapper);
    const baseLevel = monsterLevel(base);
    return {
      monsterId: wrapper.entity.id,
      baseSelectionLevel: declared === 0 ? baseLevel + 5 : declared * 2,
      generationLevel: baseLevel,
      dungeonLevel: options.dungeonLevel,
      dungeonType: options.dungeonType,
      unique: true,
      gameMode: options.gameMode ?? 'single',
      hellfire: options.hellfire,
      itemCapacityAvailable: options.itemCapacityAvailable,
      obtainedUniqueIds: options.obtainedUniqueIds,
    };
  }
  if (wrapper.file !== 'monsters/monstdat.tsv') throw new Error(`${wrapper.entity.id} is not a Diablo monster table wrapper`);
  const level = monsterLevel(wrapper);
  return {
    monsterId: wrapper.entity.id,
    baseSelectionLevel: level,
    generationLevel: level,
    dungeonLevel: options.dungeonLevel,
    dungeonType: options.dungeonType,
    noDrop: /(?:^|[_ ,])(?:t_)?nodrop(?:$|[_ ,])/i.test(wrapper.raw.treasure ?? ''),
    gameMode: options.gameMode ?? 'single',
    hellfire: options.hellfire,
    itemCapacityAvailable: options.itemCapacityAvailable,
    obtainedUniqueIds: options.obtainedUniqueIds,
  };
}

function itemType(wrapper: ReferenceWrapper): string {
  return String(wrapper.raw.itemType ?? wrapper.entity.data.subtype ?? '').trim();
}

function miscId(wrapper: ReferenceWrapper): string {
  return String(wrapper.raw.miscId ?? '').trim().toUpperCase();
}

function isGold(wrapper: ReferenceWrapper): boolean {
  return itemType(wrapper).toLowerCase() === 'gold';
}

function isMisc(wrapper: ReferenceWrapper): boolean {
  return itemType(wrapper).toLowerCase() === 'misc';
}

function baseRows(wrappers: readonly ReferenceWrapper[], profile: LootMonsterProfile): ReferenceWrapper[] {
  return wrappers.filter((wrapper) => {
    if (wrapper.file !== 'items/itemdat.tsv') return false;
    const dropRate = optionalNumber(wrapper.raw.dropRate);
    if (dropRate == null || dropRate <= 0) return false;
    if (profile.gameMode !== 'multi' && ['resurrect', 'healother'].includes((wrapper.raw.spell ?? '').toLowerCase())) return false;
    return true;
  });
}

function affixSide(wrapper: ReferenceWrapper): 'prefix' | 'suffix' | null {
  if (wrapper.file === 'items/item_prefixes.tsv') return 'prefix';
  if (wrapper.file === 'items/item_suffixes.tsv') return 'suffix';
  return null;
}

function affixRows(wrappers: readonly ReferenceWrapper[]): AffixRow[] {
  return wrappers.flatMap((wrapper) => {
    const side = affixSide(wrapper);
    if (!side) return [];
    const data = wrapper.entity.data;
    const itemTypes = (wrapper.raw.itemTypes ?? '').trim()
      ? wrapper.raw.itemTypes.split(',').map((value) => value.trim()).filter(Boolean)
      : Array.isArray(data.itemTypes) ? data.itemTypes.filter((value): value is string => typeof value === 'string') : [];
    const alignment = String(wrapper.raw.alignment ?? data.alignment ?? 'Any').toLowerCase();
    return [{
      id: wrapper.entity.id,
      side,
      power: String(wrapper.raw.power ?? data.power ?? ''),
      minLevel: finiteNumber(wrapper.raw.minLevel ?? data.minItemLevel, `${wrapper.entity.id}.minLevel`),
      itemTypes,
      alignment: alignment === 'good' || alignment === 'evil' ? alignment : 'any',
      chance: finiteNumber(wrapper.raw.chance ?? data.weight, `${wrapper.entity.id}.chance`),
      useful: String(wrapper.raw.useful ?? 'true').toLowerCase() === 'true',
      valueMin: finiteNumber(wrapper.raw['power.value1'] ?? data.valueMin ?? 0, `${wrapper.entity.id}.valueMin`),
      valueMax: finiteNumber(wrapper.raw['power.value2'] ?? data.valueMax ?? 0, `${wrapper.entity.id}.valueMax`),
      priceMin: finiteNumber(wrapper.raw.minVal ?? 0, `${wrapper.entity.id}.minVal`),
      priceMax: finiteNumber(wrapper.raw.maxVal ?? 0, `${wrapper.entity.id}.maxVal`),
      priceMultiplier: finiteNumber(wrapper.raw.multVal ?? 0, `${wrapper.entity.id}.multVal`),
    }];
  });
}

export interface VendorDefensiveAffixOutcome {
  probability: number;
  resistances: Resistances;
  hitRecoverySkippedFrames: number;
  armourBonusPercent: number;
  affixCount: number;
  priceAddition: number;
  priceMultiplier: number;
}

export interface VendorDefensiveAffixInput {
  base: ReferenceWrapper;
  minLevel: number;
  maxLevel: number;
  onlyGood: boolean;
  affixWrappers: readonly ReferenceWrapper[];
}

function affixPriceValue(row: AffixRow, rolledValue: number): number {
  if (row.valueMin === row.valueMax || row.priceMin === row.priceMax) return row.priceMin;
  return row.priceMin
    + Math.trunc((row.priceMax - row.priceMin)
      * Math.trunc(100 * (rolledValue - row.valueMin) / (row.valueMax - row.valueMin)) / 100);
}

function vendorAffixRolls(row: AffixRow): { value: number; probability: number; price: number }[] {
  const rolls = rolledValues(row);
  return [{
    value: rolls.reduce((sum, roll) => sum + roll.p * roll.value, 0),
    probability: 1,
    price: rolls.reduce((sum, roll) => sum + roll.p * affixPriceValue(row, roll.value), 0),
  }];
}

/**
 * Exact good/evil and prefix/suffix allocation for a vendor magic item, projected to the defensive
 * powers used by the descent buyer. Integer power rolls are collapsed to their expectation before
 * the expected-best stock order statistic; the store layer floors only the final per-slot result.
 * Non-defensive effects retain only their expected price contribution.
 */
export function vendorDefensiveAffixOutcomes(input: VendorDefensiveAffixInput): VendorDefensiveAffixOutcome[] {
  const type = affixItemType(input.base);
  if (!type) {
    return [{
      probability: 1,
      resistances: { magic: 0, fire: 0, lightning: 0 },
      hitRecoverySkippedFrames: 0,
      armourBonusPercent: 0,
      affixCount: 0,
      priceAddition: 0,
      priceMultiplier: 0,
    }];
  }
  const rows = affixRows(input.affixWrappers);
  const pairs = [
    { prefix: true, suffix: false, p: MAGIC_AFFIX_ALLOCATION.prefixOnly },
    { prefix: false, suffix: true, p: MAGIC_AFFIX_ALLOCATION.suffixOnly },
    { prefix: true, suffix: true, p: MAGIC_AFFIX_ALLOCATION.both },
  ].flatMap((request) => allocationChoices(
    rows,
    type,
    Math.min(Math.trunc(input.minLevel), 25),
    Math.trunc(input.maxLevel),
    input.onlyGood,
    request.prefix,
    request.suffix,
  ).map((pair) => ({ ...pair, p: pair.p * request.p })));

  return pairs.flatMap((pair) => {
    const selected = [pair.prefix, pair.suffix].filter((row): row is AffixRow => row != null);
    let outcomes: VendorDefensiveAffixOutcome[] = [{
      probability: pair.p,
      resistances: { magic: 0, fire: 0, lightning: 0 },
      hitRecoverySkippedFrames: 0,
      armourBonusPercent: 0,
      affixCount: selected.length,
      priceAddition: 0,
      priceMultiplier: selected.reduce((sum, row) => sum + row.priceMultiplier, 0),
    }];
    for (const row of selected) {
      outcomes = outcomes.flatMap((outcome) => vendorAffixRolls(row).map((roll) => {
        const resistances = { ...outcome.resistances };
        const power = row.power.toUpperCase();
        if (power === 'MAGICRES' || power === 'ALLRES') resistances.magic += roll.value;
        if (power === 'FIRERES' || power === 'ALLRES') resistances.fire += roll.value;
        if (power === 'LIGHTRES' || power === 'ALLRES') resistances.lightning += roll.value;
        return {
          ...outcome,
          probability: outcome.probability * roll.probability,
          resistances,
          hitRecoverySkippedFrames: power === 'FASTRECOVER'
            ? Math.max(outcome.hitRecoverySkippedFrames, roll.value)
            : outcome.hitRecoverySkippedFrames,
          armourBonusPercent: power === 'ACP'
            ? outcome.armourBonusPercent + roll.value
            : outcome.armourBonusPercent,
          priceAddition: outcome.priceAddition + roll.price,
        };
      }));
    }
    return outcomes;
  });
}

function affixItemType(base: ReferenceWrapper): string | null {
  const type = itemType(base).toLowerCase();
  if (['sword', 'axe', 'mace'].includes(type)) return 'Weapon';
  if (type === 'bow') return 'Bow';
  if (type === 'shield') return 'Shield';
  if (['lightarmor', 'mediumarmor', 'heavyarmor', 'armor', 'helm'].includes(type)) return 'Armor';
  if (type === 'staff') return 'Staff';
  if (type === 'ring' || type === 'amulet') return 'Misc';
  return null;
}

function eligibleAffixes(
  rows: readonly AffixRow[],
  side: AffixRow['side'],
  type: string,
  minLevel: number,
  maxLevel: number,
  onlyGood: boolean,
  alignment: AffixRow['alignment'],
  excludeCharges: boolean,
): AffixRow[] {
  return rows.filter((row) => row.side === side
    && row.chance > 0
    && row.itemTypes.some((candidate) => candidate.toLowerCase() === type.toLowerCase())
    && row.minLevel >= minLevel
    && row.minLevel <= maxLevel
    && (!onlyGood || row.useful)
    && !(alignment === 'good' && row.alignment === 'evil')
    && !(alignment === 'evil' && row.alignment === 'good')
    && !(excludeCharges && type === 'Staff' && row.power.toUpperCase() === 'CHARGES'));
}

function choices(rows: readonly AffixRow[]): AffixChoice[] {
  const total = rows.reduce((sum, row) => sum + row.chance, 0);
  if (total <= 0) return [{ row: null, p: 1 }];
  return rows.map((row) => ({ row, p: row.chance / total }));
}

function isPositiveDamagePercent(row: AffixRow | null): boolean {
  return row != null
    && ['DAMP', 'TOHIT_DAMP'].includes(row.power.toUpperCase())
    && row.valueMax > 0;
}

function positiveDamageMean(row: AffixRow | null): number {
  if (!isPositiveDamagePercent(row)) return 0;
  const mean = row!.valueMax >= row!.valueMin ? (row!.valueMin + row!.valueMax) / 2 : row!.valueMin;
  return Math.max(0, mean);
}

function isPositiveArmourPercent(row: AffixRow | null): boolean {
  return row != null && row.power.toUpperCase() === 'ACP' && row.valueMax > 0;
}

function positiveArmourMean(row: AffixRow | null): number {
  if (!isPositiveArmourPercent(row)) return 0;
  const mean = row!.valueMax >= row!.valueMin ? (row!.valueMin + row!.valueMax) / 2 : row!.valueMin;
  return Math.max(0, mean);
}

function emptyAffixOutcome(): InternalAffixOutcome {
  return {
    none: 0,
    prefixOnly: 0,
    suffixOnly: 0,
    both: 0,
    expectedCount: 0,
    pPositiveDamage: 0,
    expectedPositiveDamagePercent: 0,
    pPositiveArmour: 0,
    expectedPositiveArmourPercent: 0,
  };
}

function addOutcome(target: InternalAffixOutcome, prefix: AffixRow | null, suffix: AffixRow | null, p: number): void {
  if (prefix && suffix) target.both += p;
  else if (prefix) target.prefixOnly += p;
  else if (suffix) target.suffixOnly += p;
  else target.none += p;
  const count = Number(prefix != null) + Number(suffix != null);
  target.expectedCount += p * count;
  const damage = positiveDamageMean(prefix) + positiveDamageMean(suffix);
  if (damage > 0) {
    target.pPositiveDamage += p;
    target.expectedPositiveDamagePercent += p * damage;
  }
  const armour = positiveArmourMean(prefix) + positiveArmourMean(suffix);
  if (armour > 0) {
    target.pPositiveArmour += p;
    target.expectedPositiveArmourPercent += p * armour;
  }
}

function allocationOutcome(
  rows: readonly AffixRow[],
  type: string,
  minLevel: number,
  maxLevel: number,
  onlyGood: boolean,
  requestPrefix: boolean,
  requestSuffix: boolean,
): InternalAffixOutcome {
  const result = emptyAffixOutcome();
  const prefixes = requestPrefix
    ? choices(eligibleAffixes(rows, 'prefix', type, minLevel, maxLevel, onlyGood, 'any', true))
    : [{ row: null, p: 1 }];
  for (const prefix of prefixes) {
    const suffixes = requestSuffix
      ? choices(eligibleAffixes(rows, 'suffix', type, minLevel, maxLevel, onlyGood, prefix.row?.alignment ?? 'any', true))
      : [{ row: null, p: 1 }];
    for (const suffix of suffixes) addOutcome(result, prefix.row, suffix.row, prefix.p * suffix.p);
  }
  return result;
}

function allocationChoices(
  rows: readonly AffixRow[],
  type: string,
  minLevel: number,
  maxLevel: number,
  onlyGood: boolean,
  requestPrefix: boolean,
  requestSuffix: boolean,
): AffixPairChoice[] {
  const result: AffixPairChoice[] = [];
  const prefixes = requestPrefix
    ? choices(eligibleAffixes(rows, 'prefix', type, minLevel, maxLevel, onlyGood, 'any', true))
    : [{ row: null, p: 1 }];
  for (const prefix of prefixes) {
    const suffixes = requestSuffix
      ? choices(eligibleAffixes(rows, 'suffix', type, minLevel, maxLevel, onlyGood, prefix.row?.alignment ?? 'any', true))
      : [{ row: null, p: 1 }];
    for (const suffix of suffixes) {
      result.push({ prefix: prefix.row, suffix: suffix.row, p: prefix.p * suffix.p });
    }
  }
  return result;
}

function genericAffixChoices(
  base: ReferenceWrapper,
  level: number,
  onlyGood: boolean,
  rows: readonly AffixRow[],
): AffixPairChoice[] {
  const type = affixItemType(base);
  if (!type) return [{ prefix: null, suffix: null, p: 1 }];
  const result: AffixPairChoice[] = [];
  const minLevel = Math.min(Math.trunc(level / 2), 25);
  const usefulness = onlyGood ? [{ onlyGood: true, p: 1 }] : [
    { onlyGood: true, p: 2 / 3 },
    { onlyGood: false, p: 1 / 3 },
  ];
  const allocation = [
    { prefix: true, suffix: false, p: MAGIC_AFFIX_ALLOCATION.prefixOnly },
    { prefix: false, suffix: true, p: MAGIC_AFFIX_ALLOCATION.suffixOnly },
    { prefix: true, suffix: true, p: MAGIC_AFFIX_ALLOCATION.both },
  ];
  for (const useful of usefulness) {
    for (const request of allocation) {
      for (const pair of allocationChoices(
        rows,
        type,
        minLevel,
        level,
        useful.onlyGood,
        request.prefix,
        request.suffix,
      )) {
        result.push({ ...pair, p: pair.p * useful.p * request.p });
      }
    }
  }
  return result;
}

function scaledOutcome(target: InternalAffixOutcome, source: InternalAffixOutcome, scale: number): void {
  target.none += source.none * scale;
  target.prefixOnly += source.prefixOnly * scale;
  target.suffixOnly += source.suffixOnly * scale;
  target.both += source.both * scale;
  target.expectedCount += source.expectedCount * scale;
  target.pPositiveDamage += source.pPositiveDamage * scale;
  target.expectedPositiveDamagePercent += source.expectedPositiveDamagePercent * scale;
  target.pPositiveArmour += source.pPositiveArmour * scale;
  target.expectedPositiveArmourPercent += source.expectedPositiveArmourPercent * scale;
}

function genericAffixOutcome(
  base: ReferenceWrapper,
  level: number,
  onlyGood: boolean,
  rows: readonly AffixRow[],
): InternalAffixOutcome {
  const type = affixItemType(base);
  if (!type) return { ...emptyAffixOutcome(), none: 1 };
  const result = emptyAffixOutcome();
  const minLevel = Math.min(Math.trunc(level / 2), 25);
  const usefulness = onlyGood ? [{ onlyGood: true, p: 1 }] : [
    { onlyGood: true, p: 2 / 3 },
    { onlyGood: false, p: 1 / 3 },
  ];
  const allocation = [
    { prefix: true, suffix: false, p: MAGIC_AFFIX_ALLOCATION.prefixOnly },
    { prefix: false, suffix: true, p: MAGIC_AFFIX_ALLOCATION.suffixOnly },
    { prefix: true, suffix: true, p: MAGIC_AFFIX_ALLOCATION.both },
  ];
  for (const useful of usefulness) {
    for (const request of allocation) {
      scaledOutcome(result, allocationOutcome(rows, type, minLevel, level, useful.onlyGood, request.prefix, request.suffix), useful.p * request.p);
    }
  }
  return result;
}

function staffAffixOutcome(
  base: ReferenceWrapper,
  level: number,
  onlyGood: boolean,
  rows: readonly AffixRow[],
  hellfire: boolean,
): InternalAffixOutcome {
  const result = emptyAffixOutcome();
  if (!hellfire) scaledOutcome(result, genericAffixOutcome(base, level, onlyGood, rows), 1 / 4);
  const chargedScale = hellfire ? 1 : 3 / 4;
  const attempt = onlyGood ? 1 : 1 / 10;
  const prefixPool = eligibleAffixes(rows, 'prefix', 'Staff', 0, level, onlyGood, 'any', false);
  const charged = emptyAffixOutcome();
  if (prefixPool.length > 0) {
    for (const choice of choices(prefixPool)) addOutcome(charged, choice.row, null, choice.p * attempt);
    addOutcome(charged, null, null, 1 - attempt);
  } else {
    addOutcome(charged, null, null, 1);
  }
  scaledOutcome(result, charged, chargedScale);
  return result;
}

function itemAffixOutcome(
  base: ReferenceWrapper,
  level: number,
  onlyGood: boolean,
  rows: readonly AffixRow[],
  hellfire: boolean,
): InternalAffixOutcome {
  return itemType(base).toLowerCase() === 'staff'
    ? staffAffixOutcome(base, level, onlyGood, rows, hellfire)
    : genericAffixOutcome(base, level, onlyGood, rows);
}

function qualityGate(level: number, base: ReferenceWrapper, onlyGood: boolean): number {
  if (onlyGood || ['STAFF', 'RING', 'AMULET'].includes(miscId(base))) return 1;
  return 0.11 + 0.89 * clamp01((level + 1) / 100);
}

function eligibleUniqueIds(
  base: ReferenceWrapper,
  level: number,
  uniques: readonly ReferenceWrapper[],
): string[] {
  const uniqueBase = String(base.raw.uniqueBaseItem ?? base.entity.data.uniqueBase ?? '');
  return uniques.filter((wrapper) => wrapper.file === 'items/unique_itemdat.tsv'
    && String(wrapper.raw.uniqueBaseItem ?? wrapper.entity.data.uniqueBase ?? '') === uniqueBase
    && finiteNumber(wrapper.raw.minLevel ?? wrapper.entity.data.dropLevel, `${wrapper.entity.id}.minLevel`) <= level)
    .map((wrapper) => wrapper.entity.id);
}

function meanGold(profile: LootMonsterProfile, difficulty: Difficulty): number {
  const q = profile.dungeonLevel + difficultyGoldOffset(difficulty);
  if (q <= 0) return 0;
  const outcomes = 10 * q;
  let total = 0;
  for (let roll = 0; roll < outcomes; roll++) {
    const initial = 5 * q + roll;
    const withTileset = /(?:^|_)hell$/i.test(profile.dungeonType ?? '') ? initial + Math.trunc(initial / 8) : initial;
    total += Math.min(withTileset, 5_000);
  }
  return total / outcomes;
}

function noDropExpectation(note: string): DropExpectation {
  return {
    pNothing: 1,
    pGold: 0,
    expectedGold: 0,
    basePool: [],
    pMagic: 0,
    pUnique: 0,
    baseQuality: [],
    affixes: {
      allocation: MAGIC_AFFIX_ALLOCATION,
      perKill: { none: 1, prefixOnly: 0, suffixOnly: 0, both: 0, expectedCount: 0 },
    },
    notes: [note, 'Random draws use nominal uniform bins; linear-congruential modulo bias and the rare minimum-integer anomaly are not modelled.'],
  };
}

/**
 * Exact nominal-bin expectation for the ordinary and named-monster item procedures.
 * The pinned generator's modulo bias and rare negative minimum-integer result are deliberately
 * excluded: every bounded random draw is treated as uniform over its documented integer bins.
 */
export function expectedDrop(
  profile: LootMonsterProfile,
  itemWrappers: readonly ReferenceWrapper[],
  affixWrappers: readonly ReferenceWrapper[],
  uniqueItemWrappers: readonly ReferenceWrapper[],
  difficulty: Difficulty,
): DropExpectation {
  if (!(['normal', 'nightmare', 'hell'] as const).includes(difficulty)) throw new Error(`unknown difficulty ${difficulty}`);
  if (profile.itemCapacityAvailable === false) return noDropExpectation('The global active-item limit suppresses this drop.');
  if (profile.noDrop && !profile.unique) return noDropExpectation('The ordinary no-drop treasure flag suppresses loot.');
  const rows = baseRows(itemWrappers, profile);
  const effectiveLevel = profile.baseSelectionLevel + difficultyLevelBonus(difficulty);
  const eligible = profile.unique
    ? rows.filter((row) => {
        if (isMisc(row) && miscId(row) === 'BOOK') return true;
        return !isGold(row) && !isMisc(row)
          && finiteNumber(row.raw.minMonsterLevel ?? row.entity.data.dropLevel, `${row.entity.id}.minMonsterLevel`) <= effectiveLevel;
      })
    : rows.filter((row) => finiteNumber(
        row.raw.minMonsterLevel ?? row.entity.data.dropLevel,
        `${row.entity.id}.minMonsterLevel`,
      ) <= effectiveLevel);
  if (eligible.length === 0) throw new Error(`${profile.monsterId} has no eligible item base rows`);

  const weighted = profile.unique
    ? eligible.map((base) => ({ base, weight: 1 }))
    : eligible.map((base) => ({ base, weight: finiteNumber(base.raw.dropRate, `${base.entity.id}.dropRate`) }));
  const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) throw new Error(`${profile.monsterId} has no positive eligible item weight`);
  const selected = weighted.map(({ base, weight }) => ({
    base,
    p: (profile.unique ? 1 : ORDINARY_POOL) * weight / totalWeight,
  }));
  const goldFromPool = selected.filter(({ base }) => isGold(base)).reduce((sum, row) => sum + row.p, 0);
  const pGold = (profile.unique ? 0 : ORDINARY_DIRECT_GOLD) + goldFromPool;
  const basePool = selected.filter(({ base }) => !isGold(base)).map(({ base, p }) => ({ baseId: base.entity.id, p }));
  const affixes = affixRows(affixWrappers);
  const onlyGood = profile.unique === true;
  const generationLevel = profile.generationLevel;
  const bonusLevel = profile.unique ? generationLevel + 4 : generationLevel;
  const obtainedUniqueIds = new Set(profile.obtainedUniqueIds ?? []);
  const perKillInternal = emptyAffixOutcome();
  const baseQuality: BaseQualityExpectation[] = selected.filter(({ base }) => !isGold(base)).map(({ base, p }) => {
    const pBonus = qualityGate(generationLevel, base, onlyGood);
    const candidates = eligibleUniqueIds(base, bonusLevel, uniqueItemWrappers);
    const availableCandidates = profile.gameMode === 'multi'
      ? candidates
      : candidates.filter((id) => !obtainedUniqueIds.has(id));
    const uniqueRoll = profile.unique ? 0.16 : 0.02;
    const pInitialUnique = pBonus * (candidates.length > 0 ? uniqueRoll : 0);
    const pUnique = availableCandidates.length > 0 ? pInitialUnique : 0;
    const outcome = itemAffixOutcome(base, bonusLevel, onlyGood, affixes, profile.hellfire === true);
    const ordinaryAffixProcedure = pBonus - pInitialUnique;
    // If every eligible identity has already dropped in single-player, the engine retries until
    // generation is non-Unique. Named-monster retries use the ordinary 2% check; because their
    // bonus gate remains forced, so every eventual non-Unique enters its affix procedure.
    const retryAffixProcedure = profile.unique
      ? 1
      : pInitialUnique < 1 ? ordinaryAffixProcedure / (1 - pInitialUnique) : 0;
    const pAffixProcedure = availableCandidates.length > 0 || candidates.length === 0
      ? ordinaryAffixProcedure
      : ordinaryAffixProcedure + pInitialUnique * retryAffixProcedure;
    const pMagic = pAffixProcedure * (1 - outcome.none);
    const applied: InternalAffixOutcome = {
      none: 1 - pAffixProcedure * (1 - outcome.none),
      prefixOnly: pAffixProcedure * outcome.prefixOnly,
      suffixOnly: pAffixProcedure * outcome.suffixOnly,
      both: pAffixProcedure * outcome.both,
      expectedCount: pAffixProcedure * outcome.expectedCount,
      pPositiveDamage: pAffixProcedure * outcome.pPositiveDamage,
      expectedPositiveDamagePercent: pAffixProcedure * outcome.expectedPositiveDamagePercent,
      pPositiveArmour: pAffixProcedure * outcome.pPositiveArmour,
      expectedPositiveArmourPercent: pAffixProcedure * outcome.expectedPositiveArmourPercent,
    };
    scaledOutcome(perKillInternal, applied, p);
    return {
      baseId: base.entity.id,
      generationLevel,
      bonusLevel,
      pSelected: p,
      pBonus,
      pNormal: 1 - pUnique - pMagic,
      pMagic,
      pUnique,
      pPositiveDamageAffix: applied.pPositiveDamage,
      expectedPositiveDamagePercent: applied.expectedPositiveDamagePercent,
      affixes: {
        none: applied.none,
        prefixOnly: applied.prefixOnly,
        suffixOnly: applied.suffixOnly,
        both: applied.both,
        expectedCount: applied.expectedCount,
      },
    };
  });
  const pMagic = baseQuality.reduce((sum, row) => sum + row.pSelected * row.pMagic, 0);
  const pUnique = baseQuality.reduce((sum, row) => sum + row.pSelected * row.pUnique, 0);
  const perKill = {
    none: 1 - perKillInternal.prefixOnly - perKillInternal.suffixOnly - perKillInternal.both,
    prefixOnly: perKillInternal.prefixOnly,
    suffixOnly: perKillInternal.suffixOnly,
    both: perKillInternal.both,
    expectedCount: perKillInternal.expectedCount,
  };
  return {
    pNothing: profile.unique ? 0 : ORDINARY_NOTHING,
    pGold,
    expectedGold: pGold * meanGold(profile, difficulty),
    basePool,
    pMagic,
    pUnique,
    baseQuality,
    affixes: { allocation: MAGIC_AFFIX_ALLOCATION, perKill },
    notes: [
      'Random draws use nominal uniform bins; linear-congruential modulo bias and the rare minimum-integer anomaly are not modelled.',
      'Base-pool and quality probabilities are unconditional per kill; each base-quality row also reports probabilities conditional on selecting that base.',
      'Callers supply the currently available rows. Capacity exhaustion, quest overrides, scripted boss loot, and unavailable edition rows are outside this expectation.',
    ],
  };
}

export interface WeightedLootMonsterProfile {
  profile: LootMonsterProfile;
  weight: number;
  /** Source difficulty for carried cross-difficulty drop mixtures; omitted by legacy callers. */
  difficulty?: Difficulty;
  /** Optional pure projection cache used by chained simulations. */
  drop?: DropExpectation;
}

export interface ExpectedLootBudgetInput {
  monsterProfiles: readonly WeightedLootMonsterProfile[];
  itemWrappers: readonly ReferenceWrapper[];
  affixWrappers: readonly ReferenceWrapper[];
  uniqueItemWrappers: readonly ReferenceWrapper[];
  difficulty: Difficulty;
}

export interface ExpectedLootBudget {
  /** Direct and pool-selected monster gold only; sale value and object drops are excluded. */
  expectedGold: number;
  expectedHealingPotions: number;
  expectedFullHealingPotions: number;
  expectedManaPotions: number;
  expectedFullManaPotions: number;
}

export interface SaleDropMixItem {
  baseId: string;
  expectedCount: number;
  baseValue: number;
  /** Expected copies retained by the caller's gear/consumable policy before the carry limit. */
  keptCount?: number;
  /** Magic/Unique engine value; omitted for Normal items and legacy aggregate rows. */
  identifiedValue?: number;
}

export interface ExpectedSaleValue {
  expectedItemsDropped: number;
  expectedItemsKept: number;
  expectedItemsCarried: number;
  expectedItemsLeftBehind: number;
  expectedGold: number;
  /** Present only for the opt-in identify-then-sell policy. */
  expectedItemsIdentified?: number;
  /** Present only for the opt-in identify-then-sell policy. */
  expectedIdentifyFees?: number;
  /** Gross sale gold produced by the legacy unidentified policy under the same carry cap. */
  unidentifiedPolicyExpectedGold?: number;
  /** Actual sale gold less Cain fees, minus legacy unidentified sale gold. */
  expectedNetGoldGainVsUnidentified?: number;
}

export interface ExpectedSaleIncomeInput extends ExpectedLootBudgetInput {
  /** One town return is modelled; fractional items remain deterministic expectations. */
  itemsPerTrip: number;
  /** At most this many expected copies of each base are reserved before sale. */
  keptBaseCounts?: ReadonlyMap<string, number>;
  /** Drops consumed by another policy, such as sustain potions, are not sold. */
  excludedBaseIds?: ReadonlySet<string>;
  /** Defaults to the legacy unidentified sale policy. */
  saleIdentify?: SaleIdentifyPolicy;
}

/**
 * Apply the engine's unidentified/base-value quarter-price rule to an invented or projected mix.
 * Highest-price items fill the one-trip item-count capacity first. This is a derived expectation:
 * real inventory uses item footprints, while the descent policy deliberately exposes one scalar
 * items-per-trip assumption.
 */
export function expectedSaleValue(
  dropMix: readonly SaleDropMixItem[],
  itemsPerTrip: number,
  saleIdentify: SaleIdentifyPolicy = 'never',
): ExpectedSaleValue {
  if (!Number.isInteger(itemsPerTrip) || itemsPerTrip < 0) {
    throw new Error(`itemsPerTrip must be a non-negative integer (got ${itemsPerTrip})`);
  }
  if (!(['never', 'when-profitable'] as const).includes(saleIdentify)) {
    throw new Error(`unknown sale identify policy ${saleIdentify}`);
  }
  let expectedItemsDropped = 0;
  let expectedItemsKept = 0;
  const saleable = dropMix.map((item) => {
    if (!Number.isFinite(item.expectedCount) || item.expectedCount < 0) {
      throw new Error(`${item.baseId}.expectedCount must be a non-negative finite number`);
    }
    if (!Number.isFinite(item.baseValue) || item.baseValue < 0) {
      throw new Error(`${item.baseId}.baseValue must be a non-negative finite number`);
    }
    if (item.identifiedValue != null && (!Number.isFinite(item.identifiedValue) || item.identifiedValue < 0)) {
      throw new Error(`${item.baseId}.identifiedValue must be a non-negative finite number`);
    }
    const requestedKeep = item.keptCount ?? 0;
    if (!Number.isFinite(requestedKeep) || requestedKeep < 0) {
      throw new Error(`${item.baseId}.keptCount must be a non-negative finite number`);
    }
    const kept = Math.min(item.expectedCount, requestedKeep);
    expectedItemsDropped += item.expectedCount;
    expectedItemsKept += kept;
    const unidentifiedSaleValue = Math.max(Math.trunc(item.baseValue / 4), 1);
    const identifiedSaleValue = item.identifiedValue == null
      ? unidentifiedSaleValue
      : Math.max(Math.trunc(item.identifiedValue / 4), 1);
    const identify = saleIdentify === 'when-profitable'
      && identifiedSaleValue - unidentifiedSaleValue > CAIN_IDENTIFY_FEE;
    return {
      ...item,
      expectedCount: item.expectedCount - kept,
      saleValue: identify ? identifiedSaleValue : unidentifiedSaleValue,
      identify,
    };
  }).sort((left, right) => right.saleValue - left.saleValue || left.baseId.localeCompare(right.baseId));

  let capacity = itemsPerTrip;
  let expectedItemsCarried = 0;
  let expectedItemsIdentified = 0;
  let expectedGold = 0;
  for (const item of saleable) {
    const carried = Math.min(item.expectedCount, capacity);
    expectedItemsCarried += carried;
    if (item.identify) expectedItemsIdentified += carried;
    expectedGold += carried * item.saleValue;
    capacity -= carried;
    if (capacity <= 0) break;
  }
  const result: ExpectedSaleValue = {
    expectedItemsDropped,
    expectedItemsKept,
    expectedItemsCarried,
    expectedItemsLeftBehind: Math.max(0, expectedItemsDropped - expectedItemsKept - expectedItemsCarried),
    expectedGold,
  };
  if (saleIdentify === 'never') return result;
  const unidentifiedPolicyExpectedGold = expectedSaleValue(dropMix, itemsPerTrip).expectedGold;
  const expectedIdentifyFees = expectedItemsIdentified * CAIN_IDENTIFY_FEE;
  return {
    ...result,
    expectedItemsIdentified,
    expectedIdentifyFees,
    unidentifiedPolicyExpectedGold,
    expectedNetGoldGainVsUnidentified:
      expectedGold - expectedIdentifyFees - unidentifiedPolicyExpectedGold,
  };
}

function magicAffixChoices(
  base: ReferenceWrapper,
  level: number,
  onlyGood: boolean,
  rows: readonly AffixRow[],
  hellfire: boolean,
): AffixPairChoice[] {
  if (itemType(base).toLowerCase() !== 'staff') return genericAffixChoices(base, level, onlyGood, rows);
  const result: AffixPairChoice[] = [];
  if (!hellfire) {
    result.push(...genericAffixChoices(base, level, onlyGood, rows)
      .map((choice) => ({ ...choice, p: choice.p / 4 })));
  }
  const chargedScale = hellfire ? 1 : 3 / 4;
  const attempt = onlyGood ? 1 : 1 / 10;
  const prefixPool = eligibleAffixes(rows, 'prefix', 'Staff', 0, level, onlyGood, 'any', false);
  if (prefixPool.length === 0) {
    result.push({ prefix: null, suffix: null, p: chargedScale });
  } else {
    result.push(...choices(prefixPool).map((choice) => ({
      prefix: choice.row,
      suffix: null,
      p: choice.p * chargedScale * attempt,
    })));
    result.push({ prefix: null, suffix: null, p: chargedScale * (1 - attempt) });
  }
  return result;
}

function identifiedMagicValueOutcomes(
  base: ReferenceWrapper,
  level: number,
  onlyGood: boolean,
  rows: readonly AffixRow[],
  hellfire: boolean,
): { identifiedValue: number; p: number }[] {
  const baseValue = finiteNumber(base.raw.value ?? stat(base, 'Value'), `${base.entity.id}.value`);
  const values = new Map<number, number>();
  for (const pair of magicAffixChoices(base, level, onlyGood, rows, hellfire)) {
    const selected = [pair.prefix, pair.suffix].filter((row): row is AffixRow => row != null);
    if (selected.length === 0) continue;
    let rolls = [{ addition: 0, multiplier: 0, p: pair.p }];
    for (const affix of selected) {
      rolls = rolls.flatMap((outcome) => rolledValues(affix).map((roll) => ({
        addition: outcome.addition + affixPriceValue(affix, roll.value),
        multiplier: outcome.multiplier + affix.priceMultiplier,
        p: outcome.p * roll.p,
      })));
    }
    for (const roll of rolls) {
      let multiplied = roll.multiplier;
      if (multiplied > 0) multiplied *= baseValue;
      else if (multiplied < 0) multiplied = Math.trunc(baseValue / multiplied);
      const identifiedValue = Math.max(1, roll.addition + multiplied);
      values.set(identifiedValue, (values.get(identifiedValue) ?? 0) + roll.p);
    }
  }
  return [...values].map(([identifiedValue, p]) => ({ identifiedValue, p }));
}

/** Project sale income from weighted monster drops under the selected identification policy. */
export function expectedSaleIncome(input: ExpectedSaleIncomeInput): ExpectedSaleValue {
  const saleIdentify = input.saleIdentify ?? 'never';
  if (!(['never', 'when-profitable'] as const).includes(saleIdentify)) {
    throw new Error(`unknown sale identify policy ${input.saleIdentify}`);
  }
  const bases = new Map(input.itemWrappers
    .filter((wrapper) => wrapper.file === 'items/itemdat.tsv')
    .map((wrapper) => [wrapper.entity.id, wrapper]));
  if (saleIdentify === 'when-profitable') {
    const affixes = affixRows(input.affixWrappers);
    const uniques = new Map(input.uniqueItemWrappers
      .filter((wrapper) => wrapper.file === 'items/unique_itemdat.tsv')
      .map((wrapper) => [wrapper.entity.id, wrapper]));
    const mix: SaleDropMixItem[] = [];
    for (const row of input.monsterProfiles) {
      if (!Number.isFinite(row.weight) || row.weight < 0) {
        throw new Error(`loot-profile weight must be non-negative (got ${row.weight})`);
      }
      if (row.weight === 0) continue;
      const drop = row.drop ?? expectedDrop(
        row.profile,
        input.itemWrappers,
        input.affixWrappers,
        input.uniqueItemWrappers,
        row.difficulty ?? input.difficulty,
      );
      for (const quality of drop.baseQuality) {
        if (input.excludedBaseIds?.has(quality.baseId)) continue;
        const base = bases.get(quality.baseId);
        if (!base || String(base.raw.class).toLowerCase() === 'quest') continue;
        const baseValue = finiteNumber(base.raw.value ?? stat(base, 'Value'), `${quality.baseId}.value`);
        const selectedCount = row.weight * quality.pSelected;
        if (quality.pNormal > 0) {
          mix.push({ baseId: quality.baseId, expectedCount: selectedCount * quality.pNormal, baseValue });
        }
        if (quality.pMagic > 0) {
          const magicValues = identifiedMagicValueOutcomes(
            base,
            quality.bonusLevel,
            row.profile.unique === true,
            affixes,
            row.profile.hellfire === true,
          );
          const magicProbability = magicValues.reduce((sum, outcome) => sum + outcome.p, 0);
          if (magicProbability <= 0) throw new Error(`${quality.baseId} has positive magic probability without a magic value outcome`);
          for (const outcome of magicValues) {
            mix.push({
              baseId: quality.baseId,
              expectedCount: selectedCount * quality.pMagic * outcome.p / magicProbability,
              baseValue,
              identifiedValue: outcome.identifiedValue,
            });
          }
        }
        if (quality.pUnique > 0) {
          const obtained = new Set(row.profile.obtainedUniqueIds ?? []);
          const candidates = eligibleUniqueIds(base, quality.bonusLevel, input.uniqueItemWrappers)
            .filter((id) => row.profile.gameMode === 'multi' || !obtained.has(id));
          if (candidates.length === 0) throw new Error(`${quality.baseId} has positive Unique probability without an available identity`);
          for (const id of candidates) {
            const unique = uniques.get(id);
            if (!unique) throw new Error(`missing Unique wrapper ${id}`);
            mix.push({
              baseId: quality.baseId,
              expectedCount: selectedCount * quality.pUnique / candidates.length,
              baseValue,
              identifiedValue: finiteNumber(unique.raw.value ?? stat(unique, 'Value'), `${id}.value`),
            });
          }
        }
      }
    }
    const totals = new Map<string, number>();
    for (const item of mix) totals.set(item.baseId, (totals.get(item.baseId) ?? 0) + item.expectedCount);
    const withKeeps = mix.map((item) => {
      const total = totals.get(item.baseId)!;
      const kept = Math.min(total, input.keptBaseCounts?.get(item.baseId) ?? 0);
      return { ...item, keptCount: total > 0 ? kept * item.expectedCount / total : 0 };
    });
    const result = expectedSaleValue(withKeeps, input.itemsPerTrip, saleIdentify);
    const unidentifiedPolicyExpectedGold = expectedSaleIncome({ ...input, saleIdentify: 'never' }).expectedGold;
    return {
      ...result,
      unidentifiedPolicyExpectedGold,
      expectedNetGoldGainVsUnidentified:
        result.expectedGold - (result.expectedIdentifyFees ?? 0) - unidentifiedPolicyExpectedGold,
    };
  }
  const counts = new Map<string, number>();
  for (const row of input.monsterProfiles) {
    if (!Number.isFinite(row.weight) || row.weight < 0) throw new Error(`loot-profile weight must be non-negative (got ${row.weight})`);
    if (row.weight === 0) continue;
    const drop = row.drop ?? expectedDrop(
      row.profile,
      input.itemWrappers,
      input.affixWrappers,
      input.uniqueItemWrappers,
      row.difficulty ?? input.difficulty,
    );
    for (const outcome of drop.basePool) {
      if (input.excludedBaseIds?.has(outcome.baseId)) continue;
      const base = bases.get(outcome.baseId);
      if (!base || String(base.raw.class).toLowerCase() === 'quest') continue;
      counts.set(outcome.baseId, (counts.get(outcome.baseId) ?? 0) + row.weight * outcome.p);
    }
  }
  return expectedSaleValue([...counts].map(([baseId, expectedCount]) => {
    const base = bases.get(baseId)!;
    return {
      baseId,
      expectedCount,
      baseValue: finiteNumber(base.raw.value ?? stat(base, 'Value'), `${baseId}.value`),
      keptCount: input.keptBaseCounts?.get(baseId) ?? 0,
    };
  }), input.itemsPerTrip);
}

/** Sum monster-drop gold and life/mana consumables over already weighted kill profiles. */
export function expectedLootBudget(input: ExpectedLootBudgetInput): ExpectedLootBudget {
  const bases = new Map(input.itemWrappers
    .filter((wrapper) => wrapper.file === 'items/itemdat.tsv')
    .map((wrapper) => [wrapper.entity.id, wrapper]));
  let expectedGold = 0;
  let expectedHealingPotions = 0;
  let expectedFullHealingPotions = 0;
  let expectedManaPotions = 0;
  let expectedFullManaPotions = 0;
  for (const row of input.monsterProfiles) {
    if (!Number.isFinite(row.weight) || row.weight < 0) throw new Error(`loot-profile weight must be non-negative (got ${row.weight})`);
    if (row.weight === 0) continue;
    const drop = row.drop ?? expectedDrop(
      row.profile,
      input.itemWrappers,
      input.affixWrappers,
      input.uniqueItemWrappers,
      row.difficulty ?? input.difficulty,
    );
    expectedGold += row.weight * drop.expectedGold;
    for (const baseOutcome of drop.basePool) {
      const base = bases.get(baseOutcome.baseId);
      const healingKind = base ? miscId(base) : '';
      if (healingKind === 'HEAL') expectedHealingPotions += row.weight * baseOutcome.p;
      if (healingKind === 'FULLHEAL') expectedFullHealingPotions += row.weight * baseOutcome.p;
      if (healingKind === 'MANA') expectedManaPotions += row.weight * baseOutcome.p;
      if (healingKind === 'FULLMANA') expectedFullManaPotions += row.weight * baseOutcome.p;
    }
  }
  return {
    expectedGold,
    expectedHealingPotions,
    expectedFullHealingPotions,
    expectedManaPotions,
    expectedFullManaPotions,
  };
}

export interface BestWeaponExpectationInput {
  class: PlayerClass | 'warrior' | 'rogue' | 'sorcerer';
  depth: number;
  killsSoFar: number;
  monsterProfiles: readonly WeightedLootMonsterProfile[];
  itemWrappers: readonly ReferenceWrapper[];
  affixWrappers: readonly ReferenceWrapper[];
  uniqueItemWrappers: readonly ReferenceWrapper[];
  difficulty: Difficulty;
  strength?: number;
  magic?: number;
  dexterity?: number;
  /** Owned weapon retained unless the expected prior-drop maximum is better. */
  fallbackWeapon?: ReferenceWrapper;
}

export interface BestWeaponExpectation {
  model: 'conservative-expected-best-melee-base' | 'conservative-expected-best-ranged-base';
  class: BestWeaponExpectationInput['class'];
  depth: number;
  killsSoFar: number;
  weaponId: string | null;
  weaponType: WeaponType;
  damage: { min: number; max: number };
  damageBonusPercent: number;
  pWeaponFound: number;
  pAnyMagicDamageAffix: number;
  maxBaseDamageDistribution: { maxDamage: number; p: number; baseIds: string[] }[];
  approximation: string;
}

function requirement(base: ReferenceWrapper, rawKey: string, dataKey: string): number {
  return finiteNumber(base.raw[rawKey] ?? base.entity.data[dataKey] ?? 0, `${base.entity.id}.${rawKey}`);
}

function weaponTypeForClass(
  base: ReferenceWrapper,
  playerClass: BestWeaponExpectationInput['class'],
): BestWeaponExpectation['weaponType'] | null {
  const type = itemType(base).toLowerCase();
  if (String(playerClass).toLowerCase() === 'rogue') return type === 'bow' ? 'bow' : null;
  return ['sword', 'mace', 'axe', 'staff'].includes(type) ? type as BestWeaponExpectation['weaponType'] : null;
}

function baseDamage(base: ReferenceWrapper): { min: number; max: number } {
  return {
    min: finiteNumber(base.raw.minDamage ?? stat(base, 'Damage Min'), `${base.entity.id}.minDamage`),
    max: finiteNumber(base.raw.maxDamage ?? stat(base, 'Damage Max'), `${base.entity.id}.maxDamage`),
  };
}

/**
 * Conservative expected gear for deterministic descent combat. It computes the maximum base-max-
 * damage distribution over independent kills, floors the expected integer damage range, ignores
 * unique powers and flat-damage affixes, and applies only the floored expectation of a positive
 * percentage-damage affix. The representative base supplies weapon animation/type only.
 */
export function bestWeaponExpectation(input: BestWeaponExpectationInput): BestWeaponExpectation {
  if (!Number.isInteger(input.depth) || input.depth < 1) throw new Error(`depth must be a positive integer (got ${input.depth})`);
  if (!Number.isInteger(input.killsSoFar) || input.killsSoFar < 0) throw new Error(`killsSoFar must be a non-negative integer (got ${input.killsSoFar})`);
  const ranged = String(input.class).toLowerCase() === 'rogue';
  const fallbackType = input.fallbackWeapon ? weaponTypeForClass(input.fallbackWeapon, input.class) : null;
  if (input.fallbackWeapon && !fallbackType) {
    throw new Error(`${input.fallbackWeapon.entity.id} is not a weapon ${String(input.class)} can use in this model`);
  }
  const fallbackDamage = input.fallbackWeapon ? baseDamage(input.fallbackWeapon) : { min: 1, max: 1 };
  const bare = (approximation: string): BestWeaponExpectation => ({
    model: ranged ? 'conservative-expected-best-ranged-base' : 'conservative-expected-best-melee-base',
    class: input.class,
    depth: input.depth,
    killsSoFar: input.killsSoFar,
    weaponId: input.fallbackWeapon?.entity.id ?? null,
    weaponType: fallbackType ?? 'other',
    damage: fallbackDamage,
    damageBonusPercent: 0,
    pWeaponFound: 0,
    pAnyMagicDamageAffix: 0,
    maxBaseDamageDistribution: [],
    approximation,
  });
  if (input.killsSoFar === 0) {
    return bare(input.fallbackWeapon
      ? `No prior kills: the hero retains ${input.fallbackWeapon.entity.name}.`
      : 'No prior kills: the hero uses the one-point unarmed baseline.');
  }
  const positiveProfiles = input.monsterProfiles.filter((row) => row.weight > 0);
  const totalProfileWeight = positiveProfiles.reduce((sum, row) => sum + row.weight, 0);
  if (totalProfileWeight <= 0) throw new Error('positive kills require at least one positive-weight monster loot profile');
  const bases = new Map(input.itemWrappers
    .filter((wrapper) => wrapper.file === 'items/itemdat.tsv')
    .map((wrapper) => [wrapper.entity.id, wrapper]));
  const perKillBase = new Map<string, number>();
  const damageAffixByBase = new Map<string, number>();
  const expectedDamagePercentByBase = new Map<string, number>();
  for (const row of positiveProfiles) {
    const sourceWeight = row.weight / totalProfileWeight;
    const drop = row.drop ?? expectedDrop(
      row.profile,
      input.itemWrappers,
      input.affixWrappers,
      input.uniqueItemWrappers,
      row.difficulty ?? input.difficulty,
    );
    for (const base of drop.basePool) perKillBase.set(base.baseId, (perKillBase.get(base.baseId) ?? 0) + sourceWeight * base.p);
    for (const quality of drop.baseQuality) {
      damageAffixByBase.set(
        quality.baseId,
        (damageAffixByBase.get(quality.baseId) ?? 0) + sourceWeight * quality.pSelected * quality.pPositiveDamageAffix,
      );
      expectedDamagePercentByBase.set(
        quality.baseId,
        (expectedDamagePercentByBase.get(quality.baseId) ?? 0) + sourceWeight * quality.pSelected * quality.expectedPositiveDamagePercent,
      );
    }
  }
  const candidates = [...perKillBase].flatMap(([baseId, p]) => {
    const base = bases.get(baseId);
    if (!base || p <= 0) return [];
    const type = weaponTypeForClass(base, input.class);
    if (!type) return [];
    if (input.strength != null && requirement(base, 'minStrength', 'requiredStrength') > input.strength) return [];
    if (input.magic != null && requirement(base, 'minMagic', 'requiredMagic') > input.magic) return [];
    if (input.dexterity != null && requirement(base, 'minDexterity', 'requiredDexterity') > input.dexterity) return [];
    return [{ base, type, p, damage: baseDamage(base) }];
  });
  const upgrades = input.fallbackWeapon
    ? candidates.filter((candidate) => candidate.damage.max > fallbackDamage.max)
    : candidates;
  if (upgrades.length === 0) {
    return bare(input.fallbackWeapon
      ? `No dropped ${ranged ? 'bow' : 'melee base'} improves on the owned weapon.`
      : `No dropped ${ranged ? 'bow' : 'melee base'} satisfies the supplied attribute requirements; the hero remains unarmed.`);
  }
  const candidateIds = new Set(upgrades.map((candidate) => candidate.base.entity.id));
  const damageAffixPerKill = [...damageAffixByBase]
    .filter(([baseId]) => candidateIds.has(baseId))
    .reduce((sum, [, p]) => sum + p, 0);
  const expectedDamagePercentPerKill = [...expectedDamagePercentByBase]
    .filter(([baseId]) => candidateIds.has(baseId))
    .reduce((sum, [, value]) => sum + value, 0);

  const groups = new Map<number, typeof upgrades>();
  for (const candidate of upgrades) groups.set(candidate.damage.max, [...(groups.get(candidate.damage.max) ?? []), candidate]);
  const ordered = [...groups].sort(([a], [b]) => b - a);
  let higher = 0;
  let expectedMin = 0;
  let expectedMax = 0;
  let representative: typeof upgrades[number] | null = null;
  let representativeContribution = input.fallbackWeapon ? 0 : -1;
  const distribution: BestWeaponExpectation['maxBaseDamageDistribution'] = [];
  for (const [maxDamage, group] of ordered) {
    const groupP = group.reduce((sum, candidate) => sum + candidate.p, 0);
    const pMaximum = (1 - higher) ** input.killsSoFar - (1 - higher - groupP) ** input.killsSoFar;
    const groupMin = group.reduce((sum, candidate) => sum + candidate.damage.min * candidate.p, 0) / groupP;
    expectedMin += pMaximum * groupMin;
    expectedMax += pMaximum * maxDamage;
    distribution.push({ maxDamage, p: pMaximum, baseIds: group.map((candidate) => candidate.base.entity.id) });
    for (const candidate of group) {
      const contribution = pMaximum * candidate.p / groupP;
      if (contribution > representativeContribution) {
        representative = candidate;
        representativeContribution = contribution;
      }
    }
    higher += groupP;
  }
  const pWeaponFound = 1 - (1 - higher) ** input.killsSoFar;
  const pBare = 1 - pWeaponFound;
  expectedMin += pBare * fallbackDamage.min;
  expectedMax += pBare * fallbackDamage.max;
  const pAnyMagicDamageAffix = 1 - (1 - clamp01(damageAffixPerKill)) ** input.killsSoFar;
  const conditionalDamagePercent = damageAffixPerKill > 0 ? expectedDamagePercentPerKill / damageAffixPerKill : 0;
  const damageBonusPercent = Math.floor(pAnyMagicDamageAffix * conditionalDamagePercent);
  return {
    model: ranged ? 'conservative-expected-best-ranged-base' : 'conservative-expected-best-melee-base',
    class: input.class,
    depth: input.depth,
    killsSoFar: input.killsSoFar,
    weaponId: !input.fallbackWeapon || representativeContribution > pBare
      ? representative?.base.entity.id ?? input.fallbackWeapon?.entity.id ?? null
      : input.fallbackWeapon?.entity.id ?? null,
    weaponType: !input.fallbackWeapon || representativeContribution > pBare
      ? representative?.type ?? fallbackType ?? 'other'
      : fallbackType ?? 'other',
    damage: { min: Math.max(1, Math.floor(expectedMin)), max: Math.max(1, Math.floor(expectedMax)) },
    damageBonusPercent,
    pWeaponFound,
    pAnyMagicDamageAffix,
    maxBaseDamageDistribution: distribution,
    approximation: input.fallbackWeapon
      ? 'Independent prior kills are represented by their weighted monster mixture. The weapon range is the floored expectation of the maximum base max-damage distribution (including the owned-weapon baseline); one modal base supplies type and animation. Unique powers, flat damage, requirements not explicitly supplied, and correlations between the best base and a damage affix are omitted. The positive percentage bonus is floored, keeping the combat input conservative.'
      : 'Independent prior kills are represented by their weighted monster mixture. The weapon range is the floored expectation of the maximum base max-damage distribution (including bare hands); one modal base supplies type and animation. Unique powers, flat damage, requirements not explicitly supplied, and correlations between the best base and a damage affix are omitted. The positive percentage bonus is floored, keeping the combat input conservative.',
  };
}

export type ArmourSlot = 'body' | 'helm' | 'shield';

export interface BestArmourExpectationInput {
  className: PlayerClass | 'warrior' | 'rogue' | 'sorcerer';
  depth: number;
  killsSoFar: number;
  monsterProfiles: readonly WeightedLootMonsterProfile[];
  itemWrappers: readonly ReferenceWrapper[];
  affixWrappers: readonly ReferenceWrapper[];
  uniqueItemWrappers: readonly ReferenceWrapper[];
  difficulty: Difficulty;
  strength?: number;
  magic?: number;
  dexterity?: number;
  /** False when the selected weapon occupies both hands. */
  shieldAllowed?: boolean;
}

export interface BestArmourSlotExpectation {
  slot: ArmourSlot;
  itemId: string | null;
  armourRange: { min: number; max: number };
  /** Conservative combat value: the floored expected lower bound plus its floored positive AC bonus. */
  armourClass: number;
  armourBonusPercent: number;
  pArmourFound: number;
  pAnyMagicArmourAffix: number;
  maxBaseArmourDistribution: { maxArmour: number; p: number; baseIds: string[] }[];
}

export interface BestArmourExpectation {
  model: 'conservative-expected-best-armour-bases';
  className: BestArmourExpectationInput['className'];
  depth: number;
  killsSoFar: number;
  slots: Record<ArmourSlot, BestArmourSlotExpectation>;
  totalArmourClass: number;
  hasShield: boolean;
  approximation: string;
}

function armourSlot(base: ReferenceWrapper): ArmourSlot | null {
  const type = itemType(base).toLowerCase();
  if (type === 'helm') return 'helm';
  if (type === 'shield') return 'shield';
  return ['lightarmor', 'mediumarmor', 'heavyarmor', 'armor'].includes(type) ? 'body' : null;
}

function baseArmour(base: ReferenceWrapper): { min: number; max: number } {
  return {
    min: finiteNumber(base.raw.minArmor ?? stat(base, 'Armor Min'), `${base.entity.id}.minArmor`),
    max: finiteNumber(base.raw.maxArmor ?? stat(base, 'Armor Max'), `${base.entity.id}.maxArmor`),
  };
}

function emptyArmourSlot(slot: ArmourSlot): BestArmourSlotExpectation {
  return {
    slot,
    itemId: null,
    armourRange: { min: 0, max: 0 },
    armourClass: 0,
    armourBonusPercent: 0,
    pArmourFound: 0,
    pAnyMagicArmourAffix: 0,
    maxBaseArmourDistribution: [],
  };
}

/**
 * Conservative expected body, helm, and compatible shield loadout. Each slot independently takes
 * the maximum base-max-AC distribution over prior kills, floors its expected range, and contributes
 * the lower bound to combat. Positive percentage-AC affixes are independently expected and floored.
 * Unique powers, flat/set AC, exact AC rolls, and base/affix or cross-slot correlations are omitted.
 */
export function bestArmourExpectation(input: BestArmourExpectationInput): BestArmourExpectation {
  if (!Number.isInteger(input.depth) || input.depth < 1) throw new Error(`depth must be a positive integer (got ${input.depth})`);
  if (!Number.isInteger(input.killsSoFar) || input.killsSoFar < 0) throw new Error(`killsSoFar must be a non-negative integer (got ${input.killsSoFar})`);
  const slots: Record<ArmourSlot, BestArmourSlotExpectation> = {
    body: emptyArmourSlot('body'),
    helm: emptyArmourSlot('helm'),
    shield: emptyArmourSlot('shield'),
  };
  const result = (): BestArmourExpectation => ({
    model: 'conservative-expected-best-armour-bases',
    className: input.className,
    depth: input.depth,
    killsSoFar: input.killsSoFar,
    slots,
    totalArmourClass: slots.body.armourClass + slots.helm.armourClass + slots.shield.armourClass,
    hasShield: input.shieldAllowed !== false && slots.shield.armourClass > 0,
    approximation: input.killsSoFar === 0
      ? 'No prior kills: the hero has no body armour, helm, or shield.'
      : 'Independent prior kills are represented by their weighted monster mixture. Body, helm, and compatible shield independently use the floored expectation of their maximum base max-AC distribution; the floored expected lower bound enters combat. A modal base supplies identity. Positive percentage AC is independently floored. Unique powers, flat or set AC, exact AC rolls, requirements not explicitly supplied, and base/affix or cross-slot correlations are omitted.',
  });
  if (input.killsSoFar === 0) return result();

  const positiveProfiles = input.monsterProfiles.filter((row) => row.weight > 0);
  const totalProfileWeight = positiveProfiles.reduce((sum, row) => sum + row.weight, 0);
  if (totalProfileWeight <= 0) throw new Error('positive kills require at least one positive-weight monster loot profile');
  const bases = new Map(input.itemWrappers
    .filter((wrapper) => wrapper.file === 'items/itemdat.tsv')
    .map((wrapper) => [wrapper.entity.id, wrapper]));
  const armourAffixes = affixRows(input.affixWrappers);
  const perKillBase = new Map<string, number>();
  const armourAffixByBase = new Map<string, number>();
  const expectedArmourPercentByBase = new Map<string, number>();
  for (const row of positiveProfiles) {
    const sourceWeight = row.weight / totalProfileWeight;
    const drop = row.drop ?? expectedDrop(
      row.profile,
      input.itemWrappers,
      input.affixWrappers,
      input.uniqueItemWrappers,
      row.difficulty ?? input.difficulty,
    );
    for (const base of drop.basePool) perKillBase.set(base.baseId, (perKillBase.get(base.baseId) ?? 0) + sourceWeight * base.p);
    for (const quality of drop.baseQuality) {
      const base = bases.get(quality.baseId);
      if (!base) continue;
      const outcome = itemAffixOutcome(
        base,
        quality.bonusLevel,
        row.profile.unique === true,
        armourAffixes,
        row.profile.hellfire === true,
      );
      const appliedScale = outcome.none < 1 ? quality.pMagic / (1 - outcome.none) : 0;
      armourAffixByBase.set(
        quality.baseId,
        (armourAffixByBase.get(quality.baseId) ?? 0)
          + sourceWeight * quality.pSelected * appliedScale * outcome.pPositiveArmour,
      );
      expectedArmourPercentByBase.set(
        quality.baseId,
        (expectedArmourPercentByBase.get(quality.baseId) ?? 0)
          + sourceWeight * quality.pSelected * appliedScale * outcome.expectedPositiveArmourPercent,
      );
    }
  }
  const candidates = [...perKillBase].flatMap(([baseId, p]) => {
    const base = bases.get(baseId);
    if (!base || p <= 0) return [];
    const slot = armourSlot(base);
    if (!slot || (slot === 'shield' && input.shieldAllowed === false)) return [];
    if (input.strength != null && requirement(base, 'minStrength', 'requiredStrength') > input.strength) return [];
    if (input.magic != null && requirement(base, 'minMagic', 'requiredMagic') > input.magic) return [];
    if (input.dexterity != null && requirement(base, 'minDexterity', 'requiredDexterity') > input.dexterity) return [];
    const armour = baseArmour(base);
    if (armour.max <= 0 || armour.min > armour.max) return [];
    return [{ base, slot, p, armour }];
  });

  for (const slot of ['body', 'helm', 'shield'] as const) {
    const slotCandidates = candidates.filter((candidate) => candidate.slot === slot);
    if (slotCandidates.length === 0) continue;
    const candidateIds = new Set(slotCandidates.map((candidate) => candidate.base.entity.id));
    const armourAffixPerKill = [...armourAffixByBase]
      .filter(([baseId]) => candidateIds.has(baseId))
      .reduce((sum, [, p]) => sum + p, 0);
    const expectedArmourPercentPerKill = [...expectedArmourPercentByBase]
      .filter(([baseId]) => candidateIds.has(baseId))
      .reduce((sum, [, value]) => sum + value, 0);
    const groups = new Map<number, typeof slotCandidates>();
    for (const candidate of slotCandidates) {
      groups.set(candidate.armour.max, [...(groups.get(candidate.armour.max) ?? []), candidate]);
    }
    const ordered = [...groups].sort(([a], [b]) => b - a);
    let higher = 0;
    let expectedMin = 0;
    let expectedMax = 0;
    let representative: typeof slotCandidates[number] | null = null;
    let representativeContribution = -1;
    const distribution: BestArmourSlotExpectation['maxBaseArmourDistribution'] = [];
    for (const [maxArmour, group] of ordered) {
      const groupP = group.reduce((sum, candidate) => sum + candidate.p, 0);
      const pMaximum = (1 - higher) ** input.killsSoFar - (1 - higher - groupP) ** input.killsSoFar;
      const groupMin = group.reduce((sum, candidate) => sum + candidate.armour.min * candidate.p, 0) / groupP;
      expectedMin += pMaximum * groupMin;
      expectedMax += pMaximum * maxArmour;
      distribution.push({ maxArmour, p: pMaximum, baseIds: group.map((candidate) => candidate.base.entity.id) });
      for (const candidate of group) {
        const contribution = pMaximum * candidate.p / groupP;
        if (contribution > representativeContribution) {
          representative = candidate;
          representativeContribution = contribution;
        }
      }
      higher += groupP;
    }
    const pArmourFound = 1 - (1 - higher) ** input.killsSoFar;
    const pAnyMagicArmourAffix = 1 - (1 - clamp01(armourAffixPerKill)) ** input.killsSoFar;
    const conditionalArmourPercent = armourAffixPerKill > 0
      ? expectedArmourPercentPerKill / armourAffixPerKill
      : 0;
    const armourBonusPercent = Math.floor(pAnyMagicArmourAffix * conditionalArmourPercent);
    const armourRange = { min: Math.max(0, Math.floor(expectedMin)), max: Math.max(0, Math.floor(expectedMax)) };
    const bonusArmour = armourRange.min > 0 && armourBonusPercent > 0
      ? Math.max(1, Math.trunc(armourRange.min * armourBonusPercent / 100))
      : 0;
    slots[slot] = {
      slot,
      itemId: representative?.base.entity.id ?? null,
      armourRange,
      armourClass: armourRange.min + bonusArmour,
      armourBonusPercent,
      pArmourFound,
      pAnyMagicArmourAffix,
      maxBaseArmourDistribution: distribution,
    };
  }
  return result();
}

export type DefensiveAffixSlot = ArmourSlot | 'ring1' | 'ring2' | 'amulet';

export interface BestDefensiveAffixExpectationInput {
  depth: number;
  killsSoFar: number;
  monsterProfiles: readonly WeightedLootMonsterProfile[];
  itemWrappers: readonly ReferenceWrapper[];
  affixWrappers: readonly ReferenceWrapper[];
  uniqueItemWrappers: readonly ReferenceWrapper[];
  difficulty: Difficulty;
  strength?: number;
  magic?: number;
  dexterity?: number;
  /** False when the selected weapon occupies both hands. */
  shieldAllowed?: boolean;
}

export interface BestDefensiveAffixExpectation {
  model: 'conservative-expected-best-defensive-affixes';
  depth: number;
  killsSoFar: number;
  /** Each value is floored per equipment slot; totals are then clamped to the player-law cap. */
  slotResistances: Record<DefensiveAffixSlot, Resistances>;
  resistances: Resistances;
  /** Floored expectation of the best FASTRECOVER value available to the equipped slot set. */
  expectedHitRecoverySkippedFrames: number;
  hitRecoveryTier: HitRecoveryTier;
  approximation: string;
}

type DefensiveBaseSlot = Exclude<DefensiveAffixSlot, 'ring1' | 'ring2'> | 'ring';
type ElementalResistance = keyof Resistances;

function defensiveBaseSlot(base: ReferenceWrapper): DefensiveBaseSlot | null {
  const type = itemType(base).toLowerCase();
  if (type === 'helm') return 'helm';
  if (type === 'shield') return 'shield';
  if (['lightarmor', 'mediumarmor', 'heavyarmor', 'armor'].includes(type)) return 'body';
  if (type === 'ring') return 'ring';
  if (type === 'amulet') return 'amulet';
  return null;
}

function rolledValues(row: AffixRow): { value: number; p: number }[] {
  const first = Math.trunc(row.valueMin);
  const last = Math.trunc(row.valueMax);
  if (last < first) return [{ value: first, p: 1 }];
  const count = last - first + 1;
  return Array.from({ length: count }, (_, index) => ({ value: first + index, p: 1 / count }));
}

function affixPairScores(
  pair: Pick<AffixPairChoice, 'prefix' | 'suffix'>,
  applies: (row: AffixRow) => boolean,
  combine: (left: number, right: number) => number,
): { value: number; p: number }[] {
  let outcomes = [{ value: 0, p: 1 }];
  for (const row of [pair.prefix, pair.suffix]) {
    if (!row || !applies(row)) continue;
    const rolls = rolledValues(row);
    outcomes = outcomes.flatMap((left) => rolls.map((right) => ({
      value: combine(left.value, right.value),
      p: left.p * right.p,
    })));
  }
  return outcomes;
}

function addScore(target: Map<number, number>, score: number, p: number): void {
  if (score <= 0 || p <= 0) return;
  target.set(score, (target.get(score) ?? 0) + p);
}

function probabilityAtLeastRank(success: number, trials: number, rank: 1 | 2): number {
  const p = clamp01(success);
  if (trials < rank || p === 0) return 0;
  const none = (1 - p) ** trials;
  if (rank === 1) return 1 - none;
  const exactlyOne = trials * p * (1 - p) ** (trials - 1);
  return Math.max(0, 1 - none - exactlyOne);
}

function expectedRankedScore(perKill: ReadonlyMap<number, number>, kills: number, rank: 1 | 2): number {
  const values = [...perKill.keys()].filter((value) => value > 0).sort((left, right) => left - right);
  let previous = 0;
  let result = 0;
  for (const value of values) {
    const pAtLeastValue = [...perKill].reduce(
      (sum, [candidate, p]) => sum + (candidate >= value ? p : 0),
      0,
    );
    result += (value - previous) * probabilityAtLeastRank(pAtLeastValue, kills, rank);
    previous = value;
  }
  return result;
}

const emptyResistances = (): Resistances => ({ magic: 0, fire: 0, lightning: 0 });

function recoveryTier(skippedFrames: number): HitRecoveryTier {
  if (skippedFrames >= 3) return 'fastest';
  if (skippedFrames >= 2) return 'faster';
  if (skippedFrames >= 1) return 'fast';
  return 'none';
}

/**
 * Conservative expected resistance and hit-recovery affixes from prior monster drops. Resistance
 * is optimized independently per element and equipment slot; the two ring slots use first- and
 * second-order statistics rather than duplicating one ring. Each slot expectation is floored before
 * summing and applying the player resistance cap. Hit recovery does not stack, so its best equipped
 * FASTRECOVER value is expected globally, floored, and translated to the combat-law tier.
 */
export function bestDefensiveAffixExpectation(
  input: BestDefensiveAffixExpectationInput,
): BestDefensiveAffixExpectation {
  if (!Number.isInteger(input.depth) || input.depth < 1) throw new Error(`depth must be a positive integer (got ${input.depth})`);
  if (!Number.isInteger(input.killsSoFar) || input.killsSoFar < 0) throw new Error(`killsSoFar must be a non-negative integer (got ${input.killsSoFar})`);
  const slots: DefensiveBaseSlot[] = ['body', 'helm', 'shield', 'ring', 'amulet'];
  const resistanceScores = new Map<DefensiveBaseSlot, Record<ElementalResistance, Map<number, number>>>(slots.map((slot) => [
    slot,
    { magic: new Map(), fire: new Map(), lightning: new Map() },
  ]));
  const recoveryScores = new Map<number, number>();
  const slotResistances: BestDefensiveAffixExpectation['slotResistances'] = {
    body: emptyResistances(),
    helm: emptyResistances(),
    shield: emptyResistances(),
    ring1: emptyResistances(),
    ring2: emptyResistances(),
    amulet: emptyResistances(),
  };
  const finish = (): BestDefensiveAffixExpectation => {
    for (const element of ['magic', 'fire', 'lightning'] as const) {
      for (const slot of ['body', 'helm', 'shield', 'amulet'] as const) {
        slotResistances[slot][element] = Math.floor(expectedRankedScore(
          resistanceScores.get(slot)![element],
          input.killsSoFar,
          1,
        ));
      }
      slotResistances.ring1[element] = Math.floor(expectedRankedScore(
        resistanceScores.get('ring')![element],
        input.killsSoFar,
        1,
      ));
      slotResistances.ring2[element] = Math.floor(expectedRankedScore(
        resistanceScores.get('ring')![element],
        input.killsSoFar,
        2,
      ));
    }
    const resistances = (['magic', 'fire', 'lightning'] as const).reduce<Resistances>((total, element) => {
      total[element] = Math.min(75, Object.values(slotResistances)
        .reduce((sum, resistance) => sum + resistance[element], 0));
      return total;
    }, emptyResistances());
    const expectedHitRecoverySkippedFrames = Math.floor(expectedRankedScore(
      recoveryScores,
      input.killsSoFar,
      1,
    ));
    return {
      model: 'conservative-expected-best-defensive-affixes',
      depth: input.depth,
      killsSoFar: input.killsSoFar,
      slotResistances,
      resistances,
      expectedHitRecoverySkippedFrames,
      hitRecoveryTier: recoveryTier(expectedHitRecoverySkippedFrames),
      approximation: input.killsSoFar === 0
        ? 'No prior kills: the hero has no resistance or hit-recovery affixes.'
        : 'Independent prior kills are represented by their weighted monster mixture. Each element is optimized independently; body, helm, compatible shield, and amulet use a floored expected maximum, while rings use floored first- and second-best expectations. Their sum is capped at 75%. Hit recovery uses the floored expected best FASTRECOVER value because tiers do not stack. Unique powers, cross-element loadout correlation, and correlation with the selected weapon/armour bases are omitted.',
    };
  };
  if (input.killsSoFar === 0) return finish();

  const positiveProfiles = input.monsterProfiles.filter((row) => row.weight > 0);
  const totalProfileWeight = positiveProfiles.reduce((sum, row) => sum + row.weight, 0);
  if (totalProfileWeight <= 0) throw new Error('positive kills require at least one positive-weight monster loot profile');
  const bases = new Map(input.itemWrappers
    .filter((wrapper) => wrapper.file === 'items/itemdat.tsv')
    .map((wrapper) => [wrapper.entity.id, wrapper]));
  const affixes = affixRows(input.affixWrappers);
  for (const row of positiveProfiles) {
    const sourceWeight = row.weight / totalProfileWeight;
    const drop = row.drop ?? expectedDrop(
      row.profile,
      input.itemWrappers,
      input.affixWrappers,
      input.uniqueItemWrappers,
      row.difficulty ?? input.difficulty,
    );
    for (const quality of drop.baseQuality) {
      const base = bases.get(quality.baseId);
      if (!base) continue;
      const slot = defensiveBaseSlot(base);
      if (!slot || (slot === 'shield' && input.shieldAllowed === false)) continue;
      if (input.strength != null && requirement(base, 'minStrength', 'requiredStrength') > input.strength) continue;
      if (input.magic != null && requirement(base, 'minMagic', 'requiredMagic') > input.magic) continue;
      if (input.dexterity != null && requirement(base, 'minDexterity', 'requiredDexterity') > input.dexterity) continue;
      const outcome = itemAffixOutcome(
        base,
        quality.bonusLevel,
        row.profile.unique === true,
        affixes,
        row.profile.hellfire === true,
      );
      const appliedScale = outcome.none < 1 ? quality.pMagic / (1 - outcome.none) : 0;
      if (appliedScale === 0) continue;
      const pairs = genericAffixChoices(base, quality.bonusLevel, row.profile.unique === true, affixes);
      const baseScale = sourceWeight * quality.pSelected * appliedScale;
      for (const pair of pairs) {
        for (const element of ['magic', 'fire', 'lightning'] as const) {
          const power = element === 'magic' ? 'MAGICRES' : element === 'fire' ? 'FIRERES' : 'LIGHTRES';
          for (const score of affixPairScores(
            pair,
            (candidate) => [power, 'ALLRES'].includes(candidate.power.toUpperCase()),
            (left, right) => left + right,
          )) {
            addScore(resistanceScores.get(slot)![element], score.value, baseScale * pair.p * score.p);
          }
        }
        for (const score of affixPairScores(
          pair,
          (candidate) => candidate.power.toUpperCase() === 'FASTRECOVER',
          Math.max,
        )) {
          addScore(recoveryScores, score.value, baseScale * pair.p * score.p);
        }
      }
    }
  }
  return finish();
}
