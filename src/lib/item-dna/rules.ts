/** ── Item-DNA Rules Table ─────────────────────────────────────────────────── *
 * The one authority for every item-DNA rule. The rolling engine applies these
 * rules and the dna-genome tabs render them, so a tuning edit here moves the
 * engine and every caption together. Never re-type a rule literal elsewhere
 * (guarded by src/__tests__/components/core-engine/item-dna-rule-displays.test.tsx).
 * ────────────────────────────────────────────────────────────────────────── */

import type { ItemGenome, TraitAxis, TraitGene } from '@/types/item-genome';

export type ItemRarity = ItemGenome['minRarity'];
export type ItemType = ItemGenome['itemType'];

/* ── Rarity and item types ─────────────────────────────────────────────── */

/** Rarity order, lowest first. The index is the rarity rank. */
export const RARITY_ORDER: readonly ItemRarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

export const ITEM_TYPES: readonly ItemType[] = ['Weapon', 'Armor', 'Consumable', 'Material', 'Accessory'];

/** Rank of a rarity in RARITY_ORDER (-1 when unknown). */
export function rarityIndex(rarity: string): number {
  return RARITY_ORDER.indexOf(rarity as ItemRarity);
}

/* ── Affix count by rarity ─────────────────────────────────────────────── */

export const AFFIX_COUNT_RANGES: Readonly<Record<ItemRarity, readonly [number, number]>> = {
  Common: [0, 0],
  Uncommon: [1, 2],
  Rare: [3, 4],
  Epic: [4, 5],
  Legendary: [5, 6],
};

/** [min, max] affixes rolled at a rarity ([0, 0] when unknown). */
export function affixCountRange(rarity: string): [number, number] {
  const range = AFFIX_COUNT_RANGES[rarity as ItemRarity];
  return range ? [range[0], range[1]] : [0, 0];
}

/** Display form of the affix count: '0', '3-4', or '?' for an unknown rarity. */
export function describeAffixCount(rarity: string): string {
  const range = AFFIX_COUNT_RANGES[rarity as ItemRarity];
  if (!range) return '?';
  return range[0] === range[1] ? `${range[0]}` : `${range[0]}-${range[1]}`;
}

/* ── Magnitude scaling by item level ───────────────────────────────────── */

export const LEVEL_SCALE_PER_LEVEL = 0.1;

export function scaleByLevel(base: number, itemLevel: number): number {
  return base * (1 + LEVEL_SCALE_PER_LEVEL * itemLevel);
}

export function describeLevelScale(itemLevel: number): string {
  return `Base * (1 + ${LEVEL_SCALE_PER_LEVEL} * ${itemLevel})`;
}

/* ── God roll ──────────────────────────────────────────────────────────── */

/** Minimum coherence for a max-affix roll to count as a god roll. */
export const GOD_ROLL_THRESHOLD = 0.85;

/* ── Dominant axis ─────────────────────────────────────────────────────── */

/** The dominant gene is the argmax weight (on a tie, the later axis wins). */
export function dominantGene(traits: readonly TraitGene[]): TraitGene | undefined {
  if (traits.length === 0) return undefined;
  return traits.reduce((a, b) => (a.weight > b.weight ? a : b));
}

export function dominantAxis(genome: Pick<ItemGenome, 'traits'>): TraitAxis | undefined {
  return dominantGene(genome.traits)?.axis;
}

/* ── Evolution ─────────────────────────────────────────────────────────── */

export interface EvolutionTier {
  tier: number;
  /** Cumulative evolution XP needed to reach this tier. */
  xp: number;
  label: string;
  /** Dominant-weight bonus this tier adds on top of the previous tier. */
  bonus: number;
}

export const EVOLUTION_TIERS: readonly EvolutionTier[] = [
  { tier: 1, xp: 100, label: 'Awakened', bonus: 0.05 },
  { tier: 2, xp: 500, label: 'Empowered', bonus: 0.10 },
  { tier: 3, xp: 2000, label: 'Ascended', bonus: 0.15 },
];

export const MAX_EVOLUTION_TIER = EVOLUTION_TIERS.length;

/** Roll-weight multiplier per tier for affixes tagged with a dominant trait. */
export const EVOLUTION_ROLL_BONUS_PER_TIER = 0.15;

/** XP needed to reach the tier after `tier` (undefined at max tier). */
export function nextTierXP(tier: number): number | undefined {
  return EVOLUTION_TIERS.find((t) => t.tier === tier + 1)?.xp;
}

/** The tier a cumulative XP total has reached. */
export function tierForXP(xp: number): number {
  let reached = 0;
  for (const t of EVOLUTION_TIERS) if (xp >= t.xp) reached = t.tier;
  return reached;
}

/** Cumulative dominant-weight bonus held at a tier (tier 0 = 0). */
export function tierBonus(tier: number): number {
  const sum = EVOLUTION_TIERS
    .filter((t) => t.tier <= tier)
    .reduce((s, t) => s + t.bonus, 0);
  return Math.round(sum * 100) / 100;
}
