/** Pure Diablo I defensive town-stock expectations over caller-supplied reference wrappers. */
import type { HitRecoveryTier, Resistances } from '@/lib/catalog/reference/combatMath';
import { vendorDefensiveAffixOutcomes } from '@/lib/catalog/reference/lootMath';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export type DefensiveStoreId = 'griswold-basic' | 'griswold-premium' | 'adria' | 'wirt';
export type DefensiveEquipmentSlot = 'body' | 'helm' | 'shield' | 'ring1' | 'ring2' | 'amulet';
export type DefensiveOfferTarget = 'armour' | 'magic-resistance' | 'fire-resistance'
  | 'lightning-resistance' | 'hit-recovery';

export interface DefensiveStoreStats {
  armourClass: number;
  resistances: Resistances;
  hitRecoverySkippedFrames: number;
  hitRecoveryTier: HitRecoveryTier;
}

export interface ExpectedDefensiveStoreOffer extends DefensiveStoreStats {
  store: DefensiveStoreId;
  equipmentSlot: DefensiveEquipmentSlot;
  target: DefensiveOfferTarget;
  /** First or second order statistic within this store's finite stock. */
  stockRank: 1 | 2;
  availabilityProbability: number;
  /** Conditional on this ranked targeted offer existing; rounded up for a conservative budget. */
  expectedPrice: number;
  /** Griswold resale value of the offered item (identified value / 4), conditional on it existing. */
  expectedSaleValue: number;
}

export interface ExpectedDefensiveStore {
  store: DefensiveStoreId;
  stockSize: { min: number; max: number; expected: number };
  quality: 'normal' | 'good-only-magic' | 'non-defensive';
  refresh: string;
  offers: ExpectedDefensiveStoreOffer[];
}

export interface ExpectedDefensiveStoreStockInput {
  heroLevel: number;
  deepestVisitedDepth: number;
  strength: number;
  magic: number;
  dexterity: number;
  shieldAllowed: boolean;
  wrappers: readonly ReferenceWrapper[];
}

export interface ExpectedDefensiveStoreStock {
  model: 'conservative-expected-best-defensive-store-stock';
  heroLevel: number;
  deepestVisitedDepth: number;
  stores: ExpectedDefensiveStore[];
  approximation: string;
}

interface GeneratedDefensiveItem extends DefensiveStoreStats {
  probability: number;
  slot: Exclude<DefensiveEquipmentSlot, 'ring1' | 'ring2'> | 'ring' | null;
  price: number;
  saleValue: number;
}

interface RankedSelection {
  probability: number;
  armourClass: number;
  resistances: Resistances;
  hitRecoverySkippedFrames: number;
  priceWeighted: number;
  saleValueWeighted: number;
}

const VANILLA_VENDOR_VALUE_CAP = 140_000;
const VANILLA_WIRT_VALUE_CAP = 90_000;
const WIRT_INSPECTION_FEE = 50;

const emptyResistances = (): Resistances => ({ magic: 0, fire: 0, lightning: 0 });

function recoveryTier(skippedFrames: number): HitRecoveryTier {
  if (skippedFrames >= 3) return 'fastest';
  if (skippedFrames >= 2) return 'faster';
  if (skippedFrames >= 1) return 'fast';
  return 'none';
}

function rowIndex(wrapper: ReferenceWrapper): number | null {
  const match = /^row(\d+)$/.exec(wrapper.key);
  return match ? Number(match[1]) : null;
}

/** Direct projection of IsItemAvailable's vanilla exclusions. */
function isVanillaItem(wrapper: ReferenceWrapper): boolean {
  const index = rowIndex(wrapper);
  const id = String(wrapper.raw.id ?? '').toUpperCase();
  if (id === 'IDI_MAPOFDOOM' || id === 'IDI_LGTFORGE' || id === 'IDI_SORCERER') return false;
  if (index == null) return true;
  if (index >= 37 && index <= 49) return false;
  if (index >= 83 && index <= 86) return false;
  if (index === 92) return false;
  return index < 161 || index > 165;
}

function itemType(wrapper: ReferenceWrapper): string {
  return String(wrapper.raw.itemType ?? wrapper.entity.data.subtype ?? '').toLowerCase();
}

function numeric(wrapper: ReferenceWrapper, rawKey: string, statLabel: string): number {
  const raw = Number(wrapper.raw[rawKey]);
  if (Number.isFinite(raw)) return raw;
  const stats = wrapper.entity.data.stats;
  const entry = Array.isArray(stats)
    ? stats.find((candidate) => candidate != null && typeof candidate === 'object'
      && (candidate as { label?: unknown }).label === statLabel)
    : undefined;
  const value = Number((entry as { value?: unknown } | undefined)?.value);
  if (!Number.isFinite(value)) throw new Error(`${wrapper.entity.id}.${rawKey} is not numeric`);
  return value;
}

function requirement(wrapper: ReferenceWrapper, rawKey: string, dataKey: string): number {
  const value = Number(wrapper.raw[rawKey] ?? wrapper.entity.data[dataKey] ?? 0);
  if (!Number.isFinite(value)) throw new Error(`${wrapper.entity.id}.${rawKey} is not numeric`);
  return value;
}

function equipmentSlot(wrapper: ReferenceWrapper): GeneratedDefensiveItem['slot'] {
  const type = itemType(wrapper);
  if (type === 'helm') return 'helm';
  if (type === 'shield') return 'shield';
  if (['lightarmor', 'mediumarmor', 'heavyarmor', 'armor'].includes(type)) return 'body';
  if (type === 'ring') return 'ring';
  if (type === 'amulet') return 'amulet';
  return null;
}

function smithEligible(wrapper: ReferenceWrapper): boolean {
  return !['misc', 'gold', 'staff', 'ring', 'amulet'].includes(itemType(wrapper));
}

function premiumEligible(wrapper: ReferenceWrapper): boolean {
  return !['misc', 'gold', 'staff'].includes(itemType(wrapper));
}

function baseRows(wrappers: readonly ReferenceWrapper[]): ReferenceWrapper[] {
  return wrappers.filter((wrapper) => wrapper.file === 'items/itemdat.tsv'
    && Number(wrapper.raw.dropRate) > 0
    && isVanillaItem(wrapper));
}

function canEquip(base: ReferenceWrapper, input: ExpectedDefensiveStoreStockInput, slot: GeneratedDefensiveItem['slot']): boolean {
  if (slot === 'shield' && !input.shieldAllowed) return false;
  return requirement(base, 'minStrength', 'requiredStrength') <= input.strength
    && requirement(base, 'minMagic', 'requiredMagic') <= input.magic
    && requirement(base, 'minDexterity', 'requiredDexterity') <= input.dexterity;
}

function itemPrice(baseValue: number, affixCount: number, addition: number, multiplier: number): number {
  if (affixCount === 0) return baseValue;
  let value = multiplier;
  if (value > 0) value *= baseValue;
  else if (value < 0) value = Math.trunc(baseValue / value);
  return Math.max(1, addition + value);
}

function normalized(items: GeneratedDefensiveItem[]): GeneratedDefensiveItem[] {
  const total = items.reduce((sum, item) => sum + item.probability, 0);
  if (total <= 0) throw new Error('vendor generation has no accepted item outcomes');
  return items.map((item) => ({ ...item, probability: item.probability / total }));
}

function generatedNormalItem(
  bases: readonly ReferenceWrapper[],
  level: number,
  input: ExpectedDefensiveStoreStockInput,
): GeneratedDefensiveItem[] {
  const eligible = bases.filter((base) => smithEligible(base)
    && numeric(base, 'minMonsterLevel', 'dropLevel') >= 0
    && numeric(base, 'minMonsterLevel', 'dropLevel') <= level);
  const totalWeight = eligible.reduce((sum, base) => sum + Number(base.raw.dropRate), 0);
  if (totalWeight <= 0) throw new Error(`Griswold basic has no eligible bases at stock level ${level}`);
  return eligible.map((base) => {
    const slot = equipmentSlot(base);
    const usableSlot = slot && canEquip(base, input, slot) ? slot : null;
    const minArmour = numeric(base, 'minArmor', 'Armor Min');
    const maxArmour = numeric(base, 'maxArmor', 'Armor Max');
    return {
      probability: Number(base.raw.dropRate) / totalWeight,
      slot: usableSlot,
      armourClass: usableSlot == null ? 0 : Math.floor((minArmour + maxArmour) / 2),
      resistances: emptyResistances(),
      hitRecoverySkippedFrames: 0,
      hitRecoveryTier: 'none',
      price: numeric(base, 'value', 'Value'),
      saleValue: Math.max(1, Math.trunc(numeric(base, 'value', 'Value') / 4)),
    };
  });
}

function generatedMagicItem(
  bases: readonly ReferenceWrapper[],
  baseMinLevel: number,
  baseMaxLevel: number,
  affixMinLevel: number,
  affixMaxLevel: number,
  priceCap: number,
  priceTransform: (price: number) => number,
  input: ExpectedDefensiveStoreStockInput,
): GeneratedDefensiveItem[] {
  const eligible = bases.filter((base) => premiumEligible(base)
    && numeric(base, 'minMonsterLevel', 'dropLevel') >= baseMinLevel
    && numeric(base, 'minMonsterLevel', 'dropLevel') <= baseMaxLevel);
  if (eligible.length === 0) {
    throw new Error(`magic vendor has no eligible bases from level ${baseMinLevel} to ${baseMaxLevel}`);
  }
  const baseProbability = 1 / eligible.length;
  const outcomes = eligible.flatMap<GeneratedDefensiveItem>((base): GeneratedDefensiveItem[] => {
    const slot = equipmentSlot(base);
    const usableSlot = slot && canEquip(base, input, slot) ? slot : null;
    const minArmour = numeric(base, 'minArmor', 'Armor Min');
    const maxArmour = numeric(base, 'maxArmor', 'Armor Max');
    const meanArmour = (minArmour + maxArmour) / 2;
    const baseValue = numeric(base, 'value', 'Value');
    if (usableSlot == null) {
      return [{
        probability: baseProbability,
        slot: null,
        armourClass: 0,
        resistances: emptyResistances(),
        hitRecoverySkippedFrames: 0,
        hitRecoveryTier: 'none' as const,
        price: priceTransform(baseValue),
        saleValue: Math.max(1, Math.trunc(baseValue / 4)),
      }];
    }
    return vendorDefensiveAffixOutcomes({
      base,
      minLevel: affixMinLevel,
      maxLevel: affixMaxLevel,
      onlyGood: true,
      affixWrappers: input.wrappers,
    }).flatMap((affix) => {
      const price = itemPrice(baseValue, affix.affixCount, affix.priceAddition, affix.priceMultiplier);
      if (price > priceCap) return [];
      const armourClass = usableSlot == null
        ? 0
        : Math.floor(meanArmour + meanArmour * affix.armourBonusPercent / 100);
      return [{
        probability: baseProbability * affix.probability,
        slot: usableSlot,
        armourClass,
        resistances: usableSlot == null ? emptyResistances() : { ...affix.resistances },
        hitRecoverySkippedFrames: usableSlot == null ? 0 : affix.hitRecoverySkippedFrames,
        hitRecoveryTier: usableSlot == null ? 'none' as const : recoveryTier(affix.hitRecoverySkippedFrames),
        price: priceTransform(price),
        saleValue: Math.max(1, Math.trunc(price / 4)),
      }];
    });
  });
  return normalized(outcomes);
}

function slotMatches(item: GeneratedDefensiveItem, slot: DefensiveEquipmentSlot): boolean {
  return item.slot === slot || item.slot === 'ring' && (slot === 'ring1' || slot === 'ring2');
}

function targetValue(item: GeneratedDefensiveItem, target: DefensiveOfferTarget): number {
  if (target === 'armour') return item.armourClass;
  if (target === 'hit-recovery') return item.hitRecoverySkippedFrames;
  const element = target === 'magic-resistance' ? 'magic'
    : target === 'fire-resistance' ? 'fire' : 'lightning';
  return item.resistances[element];
}

function probabilityExactly(probabilities: readonly number[], count: 0 | 1): number {
  let zero = 1;
  let one = 0;
  for (const probability of probabilities) {
    one = one * (1 - probability) + zero * probability;
    zero *= 1 - probability;
  }
  return count === 0 ? zero : one;
}

function rankedSelection(
  stock: readonly (readonly GeneratedDefensiveItem[])[],
  slot: DefensiveEquipmentSlot,
  target: DefensiveOfferTarget,
  rank: 1 | 2,
): RankedSelection {
  const groupedStock = stock.map((outcomes) => {
    const groups = new Map<number, RankedSelection>();
    for (const outcome of outcomes) {
      const score = slotMatches(outcome, slot) ? targetValue(outcome, target) : 0;
      const group = groups.get(score) ?? {
        probability: 0,
        armourClass: 0,
        resistances: emptyResistances(),
        hitRecoverySkippedFrames: 0,
        priceWeighted: 0,
        saleValueWeighted: 0,
      };
      group.probability += outcome.probability;
      group.armourClass += outcome.probability * outcome.armourClass;
      group.resistances.magic += outcome.probability * outcome.resistances.magic;
      group.resistances.fire += outcome.probability * outcome.resistances.fire;
      group.resistances.lightning += outcome.probability * outcome.resistances.lightning;
      group.hitRecoverySkippedFrames += outcome.probability * outcome.hitRecoverySkippedFrames;
      group.priceWeighted += outcome.probability * outcome.price;
      group.saleValueWeighted += outcome.probability * outcome.saleValue;
      groups.set(score, group);
    }
    return groups;
  });
  const result: RankedSelection = {
    probability: 0,
    armourClass: 0,
    resistances: emptyResistances(),
    hitRecoverySkippedFrames: 0,
    priceWeighted: 0,
    saleValueWeighted: 0,
  };
  for (const [index, groups] of groupedStock.entries()) {
    for (const [score, outcome] of groups) {
      if (score <= 0) continue;
      const precedingProbabilities = groupedStock.flatMap((otherGroups, otherIndex) => {
        if (otherIndex === index) return [];
        const probability = [...otherGroups].reduce((sum, [candidateScore, candidate]) => {
          const precedes = otherIndex < index ? candidateScore >= score : candidateScore > score;
          return sum + (precedes ? candidate.probability : 0);
        }, 0);
        return [probability];
      });
      const selectionProbability = outcome.probability
        * probabilityExactly(precedingProbabilities, rank === 1 ? 0 : 1);
      result.probability += selectionProbability;
      const conditionalScale = outcome.probability > 0 ? selectionProbability / outcome.probability : 0;
      result.armourClass += conditionalScale * outcome.armourClass;
      result.resistances.magic += conditionalScale * outcome.resistances.magic;
      result.resistances.fire += conditionalScale * outcome.resistances.fire;
      result.resistances.lightning += conditionalScale * outcome.resistances.lightning;
      result.hitRecoverySkippedFrames += conditionalScale * outcome.hitRecoverySkippedFrames;
      result.priceWeighted += conditionalScale * outcome.priceWeighted;
      result.saleValueWeighted += conditionalScale * outcome.saleValueWeighted;
    }
  }
  return result;
}

function offersForStocks(
  store: DefensiveStoreId,
  variants: readonly { probability: number; stock: readonly (readonly GeneratedDefensiveItem[])[] }[],
): ExpectedDefensiveStoreOffer[] {
  const offers: ExpectedDefensiveStoreOffer[] = [];
  for (const slot of ['body', 'helm', 'shield', 'ring1', 'ring2', 'amulet'] as const) {
    const rank: 1 | 2 = slot === 'ring2' ? 2 : 1;
    for (const target of [
      'armour', 'magic-resistance', 'fire-resistance', 'lightning-resistance', 'hit-recovery',
    ] as const) {
      const expected = variants.reduce<RankedSelection>((sum, variant) => {
        const selected = rankedSelection(variant.stock, slot, target, rank);
        sum.probability += variant.probability * selected.probability;
        sum.armourClass += variant.probability * selected.armourClass;
        sum.resistances.magic += variant.probability * selected.resistances.magic;
        sum.resistances.fire += variant.probability * selected.resistances.fire;
        sum.resistances.lightning += variant.probability * selected.resistances.lightning;
        sum.hitRecoverySkippedFrames += variant.probability * selected.hitRecoverySkippedFrames;
        sum.priceWeighted += variant.probability * selected.priceWeighted;
        sum.saleValueWeighted += variant.probability * selected.saleValueWeighted;
        return sum;
      }, {
        probability: 0,
        armourClass: 0,
        resistances: emptyResistances(),
        hitRecoverySkippedFrames: 0,
        priceWeighted: 0,
        saleValueWeighted: 0,
      });
      const conditionalScale = expected.probability > 0 ? 1 / expected.probability : 0;
      const projected = {
        armourClass: Math.floor(expected.armourClass * conditionalScale),
        resistances: {
          magic: Math.floor(expected.resistances.magic * conditionalScale),
          fire: Math.floor(expected.resistances.fire * conditionalScale),
          lightning: Math.floor(expected.resistances.lightning * conditionalScale),
        },
        hitRecoverySkippedFrames: Math.floor(expected.hitRecoverySkippedFrames * conditionalScale),
      };
      if (target === 'armour' && projected.armourClass <= 0) continue;
      if (target === 'hit-recovery' && projected.hitRecoverySkippedFrames <= 0) continue;
      if (target === 'magic-resistance' && projected.resistances.magic <= 0) continue;
      if (target === 'fire-resistance' && projected.resistances.fire <= 0) continue;
      if (target === 'lightning-resistance' && projected.resistances.lightning <= 0) continue;
      offers.push({
        store,
        equipmentSlot: slot,
        target,
        stockRank: rank,
        availabilityProbability: expected.probability,
        expectedPrice: expected.probability > 0
          ? Math.ceil(expected.priceWeighted / expected.probability - 1e-9)
          : 0,
        expectedSaleValue: expected.probability > 0
          ? Math.floor(expected.saleValueWeighted / expected.probability + 1e-9)
          : 0,
        ...projected,
        hitRecoveryTier: recoveryTier(projected.hitRecoverySkippedFrames),
      });
    }
  }
  return offers;
}

/**
 * Expected best defensive offers in one vanilla single-player town visit. Each store item is an
 * independent engine-law draw. Offer stats and price are conditional on the ranked targeted offer
 * existing: stats and resale are floored, while the purchase price is rounded up. Availability is
 * reported separately so a purchase simulation can weight outcomes without diluting the item twice. Adria is retained
 * explicitly to show that Misc/Staff stock does not include Ring/Amulet item types.
 */
export function expectedDefensiveStoreStock(input: ExpectedDefensiveStoreStockInput): ExpectedDefensiveStoreStock {
  if (!Number.isInteger(input.heroLevel) || input.heroLevel < 1) {
    throw new Error(`heroLevel must be a positive integer (got ${input.heroLevel})`);
  }
  if (!Number.isInteger(input.deepestVisitedDepth) || input.deepestVisitedDepth < 0) {
    throw new Error(`deepestVisitedDepth must be a non-negative integer (got ${input.deepestVisitedDepth})`);
  }
  const bases = baseRows(input.wrappers);
  const smithLevel = Math.max(6, Math.min(16, input.deepestVisitedDepth + 2));
  const basicItem = generatedNormalItem(bases, smithLevel, input);
  const basicVariants = Array.from({ length: 10 }, (_, index) => {
    const count = index + 10;
    return { probability: 1 / 10, stock: Array.from({ length: count }, () => basicItem) };
  });
  const premiumItems = Array.from({ length: 6 }, (_, index) => {
    const offset = index < 2 ? -1 : index < 4 ? 0 : index - 3;
    const level = Math.max(1, Math.min(30, input.heroLevel + offset));
    return generatedMagicItem(
      bases,
      Math.trunc(level / 4),
      level,
      Math.trunc(level / 2),
      level,
      VANILLA_VENDOR_VALUE_CAP,
      (price) => price,
      input,
    );
  });
  const wirtLevel = input.heroLevel;
  const wirtItem = generatedMagicItem(
    bases,
    0,
    wirtLevel,
    wirtLevel,
    2 * wirtLevel,
    VANILLA_WIRT_VALUE_CAP,
    (price) => price + Math.trunc(price / 2) + WIRT_INSPECTION_FEE,
    input,
  );
  return {
    model: 'conservative-expected-best-defensive-store-stock',
    heroLevel: input.heroLevel,
    deepestVisitedDepth: input.deepestVisitedDepth,
    stores: [
      {
        store: 'griswold-basic',
        stockSize: { min: 10, max: 19, expected: 14.5 },
        quality: 'normal',
        refresh: 'whole stock on each town setup',
        offers: offersForStocks('griswold-basic', basicVariants),
      },
      {
        store: 'griswold-premium',
        stockSize: { min: 6, max: 6, expected: 6 },
        quality: 'good-only-magic',
        refresh: 'persistent; two slots rotate per gained hero level and a purchased slot is replaced immediately',
        offers: offersForStocks('griswold-premium', [{ probability: 1, stock: premiumItems }]),
      },
      {
        store: 'adria',
        stockSize: { min: 10, max: 17, expected: 13.5 },
        quality: 'non-defensive',
        refresh: 'whole random stock on each town setup; permanent consumables persist',
        offers: [],
      },
      {
        store: 'wirt',
        stockSize: { min: 1, max: 1, expected: 1 },
        quality: 'good-only-magic',
        refresh: 'when floor(hero level / 2) rises, or on town setup after purchase emptied the slot',
        offers: offersForStocks('wirt', [{ probability: 1, stock: [wirtItem] }]),
      },
    ],
    approximation: 'Base selection, stock size, good-only affix allocation, value caps, and Wirt pricing follow the pinned engine. Each offer\'s stats, purchase price, and resale value are conditional on its targeted ranked item existing; availability is reported separately. Base AC and affix power rolls use their means before the final conditional expected-best floor. Non-defensive or unusable bases conservatively remain accepted zero-defence outcomes without simulating their magic-value cap rejection. Non-defensive affixes retain their expected price contribution but no combat effect. Cross-target best offers are alternatives, not simultaneous items.',
  };
}
