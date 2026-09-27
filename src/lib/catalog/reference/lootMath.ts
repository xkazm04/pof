/** Pure Diablo I loot expectations over caller-supplied reference wrappers. */
import type { Difficulty, PlayerClass, WeaponType } from '@/lib/catalog/reference/combatMath';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const ORDINARY_NOTHING = 0.59;
const ORDINARY_DIRECT_GOLD = 0.3034;
const ORDINARY_POOL = 0.1066;

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
    }];
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
    const drop = expectedDrop(
      row.profile,
      input.itemWrappers,
      input.affixWrappers,
      input.uniqueItemWrappers,
      input.difficulty,
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
    const drop = expectedDrop(row.profile, input.itemWrappers, input.affixWrappers, input.uniqueItemWrappers, input.difficulty);
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
    const drop = expectedDrop(row.profile, input.itemWrappers, input.affixWrappers, input.uniqueItemWrappers, input.difficulty);
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
