/** ── DNA-Biased Affix Rolling Engine ─────────────────────────────────────── *
 * Rolls affixes using Item DNA to bias toward coherent item identities.
 * A "warrior sword" naturally rolls strength/crit affixes while a
 * "mage staff" gravitates toward mana/spell power.
 * ────────────────────────────────────────────────────────────────────────── */

import type {
  ItemGenome, TraitAxis, DNAAffix,
  DNARollResult, RolledAffix,
  InheritanceResult, EvolutionState, TraitGene,
} from '@/types/item-genome';

/* ── Rarity hierarchy ──────────────────────────────────────────────────── */

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;

function rarityIndex(rarity: string): number {
  return RARITY_ORDER.indexOf(rarity as typeof RARITY_ORDER[number]);
}

function meetsRarity(affixMin: string, itemRarity: string): boolean {
  return rarityIndex(affixMin) <= rarityIndex(itemRarity);
}

/* ── Affix count by rarity ─────────────────────────────────────────────── */

const AFFIX_COUNT_RANGES: Record<string, [number, number]> = {
  Common: [0, 0],
  Uncommon: [1, 2],
  Rare: [3, 4],
  Epic: [4, 5],
  Legendary: [5, 6],
};

function rollAffixCount(rarity: string): number {
  const [min, max] = AFFIX_COUNT_RANGES[rarity] ?? [0, 0];
  return min + Math.floor(Math.random() * (max - min + 1));
}

/* ── DNA weight calculation ────────────────────────────────────────────── */

/**
 * Calculate the effective weight of an affix given the item's DNA.
 * Affixes matching the genome's dominant traits get boosted.
 */
function calcEffectiveWeight(affix: DNAAffix, genome: ItemGenome): number {
  const matchingGene = genome.traits.find((g) => g.axis === affix.axis);
  if (!matchingGene) return affix.baseWeight * 0.3; // off-type penalty

  // Base bias from gene weight (0-1 scaled to 0.5-3x multiplier)
  const geneBias = 0.5 + matchingGene.weight * 2.5;

  // Tag affinity bonus: extra weight if affix tags match gene affinities
  const tagOverlap = affix.tags.filter((t) =>
    matchingGene.affinityTags.includes(t)
  ).length;
  const tagBonus = 1 + tagOverlap * 0.5;

  // Evolution bonus: items used frequently develop their dominant traits
  const evoBonus = genome.evolution
    ? 1 + genome.evolution.tier * 0.15 *
      (genome.evolution.dominantTraits.some((t) => affix.tags.includes(t)) ? 1 : 0)
    : 1;

  return affix.baseWeight * geneBias * tagBonus * evoBonus;
}

/* ── Core rolling function ─────────────────────────────────────────────── */

/**
 * Roll affixes for an item using DNA-biased weighted selection.
 */
export function rollAffixesWithDNA(
  genome: ItemGenome,
  rarity: string,
  itemLevel: number,
  affixPool: DNAAffix[],
): DNARollResult {
  const count = rollAffixCount(rarity);
  if (count === 0) {
    return { affixes: [], hasMutations: false, mutationIndices: [], coherenceScore: 1 };
  }

  // 1. Filter pool by rarity gate
  const eligible = affixPool.filter((a) => meetsRarity(a.minRarity, rarity));
  if (eligible.length === 0) {
    return { affixes: [], hasMutations: false, mutationIndices: [], coherenceScore: 1 };
  }

  // 2. Calculate effective weights
  const weighted = eligible.map((affix) => ({
    affix,
    effectiveWeight: calcEffectiveWeight(affix, genome),
  }));

  // 3. Roll without replacement
  const rolled: RolledAffix[] = [];
  const remaining = [...weighted];
  const mutationIndices: number[] = [];
  let mutationCount = 0;

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Check for mutation
    const isMutation = mutationCount < genome.mutation.maxMutations &&
      Math.random() < genome.mutation.mutationRate;

    let pick: typeof remaining[number];

    if (isMutation && genome.mutation.wildMutation) {
      // Wild mutation: equal weights for all remaining
      const idx = Math.floor(Math.random() * remaining.length);
      pick = remaining[idx];
      remaining.splice(idx, 1);
      mutationIndices.push(i);
      mutationCount++;
    } else if (isMutation) {
      // Targeted mutation: boost off-type affixes
      const dominantAxis = genome.traits.reduce((a, b) =>
        a.weight > b.weight ? a : b
      ).axis;
      const offType = remaining.filter((r) => r.affix.axis !== dominantAxis);
      const pool = offType.length > 0 ? offType : remaining;
      const totalW = pool.reduce((s, r) => s + r.effectiveWeight, 0);
      let roll = Math.random() * totalW;
      pick = pool[0];
      for (const entry of pool) {
        roll -= entry.effectiveWeight;
        if (roll <= 0) { pick = entry; break; }
      }
      remaining.splice(remaining.indexOf(pick), 1);
      mutationIndices.push(i);
      mutationCount++;
    } else {
      // Normal DNA-biased selection
      const totalW = remaining.reduce((s, r) => s + r.effectiveWeight, 0);
      let roll = Math.random() * totalW;
      pick = remaining[0];
      for (const entry of remaining) {
        roll -= entry.effectiveWeight;
        if (roll <= 0) { pick = entry; break; }
      }
      remaining.splice(remaining.indexOf(pick), 1);
    }

    // Scale magnitude by item level
    const baseRange = pick.affix.maxValue - pick.affix.minValue;
    const base = pick.affix.minValue + Math.random() * baseRange;
    const scaled = base * (1 + 0.1 * itemLevel);

    rolled.push({
      affix: pick.affix,
      rolledValue: Math.round(scaled * 10) / 10,
      isMutation: mutationIndices.includes(i),
      effectiveWeight: pick.effectiveWeight,
    });
  }

  // 4. Calculate coherence score
  const dominantAxis = genome.traits.reduce((a, b) =>
    a.weight > b.weight ? a : b
  ).axis;
  const onTypeCount = rolled.filter((r) => r.affix.axis === dominantAxis).length;
  const coherenceScore = rolled.length > 0 ? onTypeCount / rolled.length : 1;

  return {
    affixes: rolled,
    hasMutations: mutationIndices.length > 0,
    mutationIndices,
    coherenceScore,
  };
}

/* ── Inheritance: breed two item genomes ────────────────────────────────── */

/**
 * Combine two item genomes to create offspring with blended DNA.
 */
export function inheritGenomes(
  parentA: ItemGenome,
  parentB: ItemGenome,
): InheritanceResult {
  const axes: TraitAxis[] = ['offensive', 'defensive', 'utility', 'economic'];
  const traits: TraitGene[] = [];

  let totalA = 0;
  let totalB = 0;

  for (const axis of axes) {
    const geneA = parentA.traits.find((g) => g.axis === axis);
    const geneB = parentB.traits.find((g) => g.axis === axis);
    const wA = geneA?.weight ?? 0;
    const wB = geneB?.weight ?? 0;
    totalA += wA;
    totalB += wB;

    // Blend: random interpolation between parents with slight mutation
    const blend = 0.3 + Math.random() * 0.4; // 30-70% split
    const blendedWeight = Math.min(1, wA * blend + wB * (1 - blend) + (Math.random() * 0.1 - 0.05));

    // Merge affinity tags from both parents, dedup
    const mergedTags = Array.from(new Set([
      ...(geneA?.affinityTags ?? []),
      ...(geneB?.affinityTags ?? []),
    ]));

    traits.push({
      axis,
      weight: Math.max(0, Math.round(blendedWeight * 100) / 100),
      affinityTags: mergedTags,
    });
  }

  return {
    traits,
    dominantParent: totalA >= totalB ? 'A' : 'B',
    crossoverBonus: Math.random() < 0.15 ? 0.1 + Math.random() * 0.15 : 0,
  };
}

/* ── Evolution: strengthen used traits ─────────────────────────────────── */

/**
 * Evolve an item's genome based on usage, strengthening dominant traits.
 */
export function evolveGenome(
  genome: ItemGenome,
  usageXP: number,
): { evolved: ItemGenome; tierChanged: boolean } {
  const evo: EvolutionState = genome.evolution ?? {
    usageCount: 0,
    evolutionXP: 0,
    tier: 0,
    dominantTraits: [],
  };

  const newXP = evo.evolutionXP + usageXP;
  const xpThresholds = [100, 500, 2000]; // Tier 1, 2, 3
  let newTier = evo.tier;
  for (let i = evo.tier; i < xpThresholds.length; i++) {
    if (newXP >= xpThresholds[i]) newTier = i + 1;
  }

  const tierChanged = newTier > evo.tier;

  // Boost dominant trait weights on tier up
  const evolvedTraits = genome.traits.map((gene) => {
    if (tierChanged && gene.weight > 0.5) {
      return { ...gene, weight: Math.min(1, gene.weight + 0.05 * newTier) };
    }
    return gene;
  });

  return {
    evolved: {
      ...genome,
      traits: evolvedTraits,
      evolution: {
        ...evo,
        usageCount: evo.usageCount + 1,
        evolutionXP: newXP,
        tier: newTier,
        dominantTraits: evo.dominantTraits,
      },
    },
    tierChanged,
  };
}

/* ── Predicted distribution ────────────────────────────────────────────── */

/**
 * Predict the affix distribution percentages for a genome against an affix pool.
 * Returns per-axis percentage (how likely each axis is to appear).
 */
export function predictDistribution(
  genome: ItemGenome,
  affixPool: DNAAffix[],
  rarity: string,
): Record<TraitAxis, number> {
  const eligible = affixPool.filter((a) => meetsRarity(a.minRarity, rarity));
  const totalWeight = eligible.reduce(
    (sum, a) => sum + calcEffectiveWeight(a, genome),
    0,
  );

  if (totalWeight === 0) {
    return { offensive: 0.25, defensive: 0.25, utility: 0.25, economic: 0.25 };
  }

  const dist: Record<TraitAxis, number> = { offensive: 0, defensive: 0, utility: 0, economic: 0 };
  for (const affix of eligible) {
    const w = calcEffectiveWeight(affix, genome);
    dist[affix.axis] += w / totalWeight;
  }

  return dist;
}
