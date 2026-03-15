/** ── Drop Simulator Engine ──────────────────────────────────────────────── *
 * Faithful TypeScript reproduction of UARPGAffixRoller::RollAffixes
 * (weighted selection without replacement) with mass simulation for
 * distribution heatmaps and balance analysis.
 * ────────────────────────────────────────────────────────────────────────── */

import type { DNAAffix, TraitAxis } from '@/types/item-genome';

/* ── Types ────────────────────────────────────────────────────────────── */

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface AffixPoolEntry extends DNAAffix {
  /** Override weight for designer tweaking */
  designerWeight?: number;
}

export interface DropSimConfig {
  affixPool: AffixPoolEntry[];
  rarity: Rarity;
  itemLevel: number;
  rollCount: number;
  seed: number;
}

export interface RolledItem {
  affixes: SimRolledAffix[];
  totalPower: number;
}

export interface SimRolledAffix {
  affixId: string;
  name: string;
  axis: TraitAxis;
  magnitude: number;
  isPrefix: boolean;
}

/** Per-affix stats across all rolls */
export interface AffixDistribution {
  affixId: string;
  name: string;
  axis: TraitAxis;
  frequency: number;        // 0-1 how often it appeared
  avgMagnitude: number;
  minMagnitude: number;
  maxMagnitude: number;
  magnitudeHistogram: number[]; // 10 buckets
}

/** Cross-affix co-occurrence matrix cell */
export interface CoOccurrenceCell {
  affixA: string;
  affixB: string;
  count: number;
  probability: number;  // 0-1
}

/** Full simulation result */
export interface DropSimResult {
  items: RolledItem[];
  affixDistributions: AffixDistribution[];
  coOccurrence: CoOccurrenceCell[];
  axisCoverage: Record<TraitAxis, number>;  // % of items with at least one affix from this axis
  avgAffixCount: number;
  avgPower: number;
  powerHistogram: number[];  // 10 buckets
  rarityBreakdown: { affixCount: number; count: number }[];
}

/* ── Seeded RNG (xorshift32) ─────────────────────────────────────────── */

function createRng(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/* ── Rarity helpers ──────────────────────────────────────────────────── */

const RARITY_ORDER: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

const AFFIX_COUNT_RANGES: Record<Rarity, [number, number]> = {
  Common: [0, 0],
  Uncommon: [1, 2],
  Rare: [3, 4],
  Epic: [4, 5],
  Legendary: [5, 6],
};

function rarityIndex(r: string): number {
  return RARITY_ORDER.indexOf(r as Rarity);
}

function meetsRarity(affixMin: string, itemRarity: Rarity): boolean {
  return rarityIndex(affixMin) <= rarityIndex(itemRarity);
}

function getItemLevelScaling(level: number): number {
  return 1.0 + 0.1 * Math.max(1, level);
}

/* ── Power weight per stat (matches economy engine) ──────────────────── */

const POWER_WEIGHTS: Record<string, number> = {
  'Stat.Strength': 1.0, 'Stat.AttackPower': 1.2, 'Stat.Armor': 0.8,
  'Stat.MaxHealth': 0.5, 'Stat.CritChance': 2.0, 'Stat.CritDamage': 1.5,
  'Stat.AttackSpeed': 1.3, 'Stat.PenArmor': 1.8, 'Stat.HealthRegen': 0.7,
  'Stat.MaxMana': 0.4, 'Stat.CooldownReduction': 1.1, 'Stat.DodgeChance': 1.5,
  'Stat.MoveSpeed': 0.6, 'Stat.GoldFind': 0.3, 'Stat.MagicFind': 0.3,
  'Stat.XPBonus': 0.2, 'Stat.BlockChance': 1.2, 'Stat.Resistance': 0.9,
  'Stat.ManaRegen': 0.5, 'Stat.ManaCost': 0.4, 'Stat.AreaOfEffect': 0.8,
  'Stat.ItemQuantity': 0.3, 'Stat.VendorPrice': 0.1, 'Stat.CraftBonus': 0.2,
};

/* ── Core: single item roll (faithful to UARPGAffixRoller::RollAffixes) ── */

function rollSingleItem(
  pool: AffixPoolEntry[],
  rarity: Rarity,
  itemLevel: number,
  rng: () => number,
  powerFn: (pool: AffixPoolEntry[], affix: SimRolledAffix) => number,
): RolledItem {
  const [minCount, maxCount] = AFFIX_COUNT_RANGES[rarity];
  if (maxCount <= 0) return { affixes: [], totalPower: 0 };

  // 1. Rarity tier-gate filter
  const eligible = pool.filter((a) => meetsRarity(a.minRarity, rarity));
  if (eligible.length === 0) return { affixes: [], totalPower: 0 };

  // 2. Desired count
  const desiredCount = minCount + Math.floor(rng() * (maxCount - minCount + 1));
  const actualCount = Math.min(desiredCount, eligible.length);
  const levelScale = getItemLevelScaling(itemLevel);

  // 3. Weighted selection without replacement (exact UE5 algorithm)
  const chosen = new Set<number>();
  const affixes: SimRolledAffix[] = [];

  for (let picked = 0; picked < actualCount && chosen.size < eligible.length; picked++) {
    // Rebuild weight pool excluding chosen
    let effectiveTotal = 0;
    const weightPool: { idx: number; cumWeight: number }[] = [];

    for (let i = 0; i < eligible.length; i++) {
      if (!chosen.has(i)) {
        const w = Math.max(0.01, eligible[i].designerWeight ?? eligible[i].baseWeight);
        effectiveTotal += w;
        weightPool.push({ idx: i, cumWeight: effectiveTotal });
      }
    }

    if (weightPool.length === 0 || effectiveTotal <= 0) break;

    // Weighted random selection
    const roll = rng() * effectiveTotal;
    let selectedIdx = weightPool[weightPool.length - 1].idx;
    for (const entry of weightPool) {
      if (roll <= entry.cumWeight) {
        selectedIdx = entry.idx;
        break;
      }
    }

    chosen.add(selectedIdx);
    const row = eligible[selectedIdx];

    // Magnitude: random in [min, max] * level scaling
    const base = row.minValue + rng() * (row.maxValue - row.minValue);
    const magnitude = Math.round(base * levelScale * 10) / 10;

    const rolledAffix: SimRolledAffix = {
      affixId: row.id,
      name: row.name,
      axis: row.axis,
      magnitude,
      isPrefix: row.isPrefix,
    };

    affixes.push(rolledAffix);
  }

  const totalPower = affixes.reduce((sum, a) => sum + powerFn(pool, a), 0);
  return { affixes, totalPower: Math.round(totalPower * 10) / 10 };
}

/* ── Mass simulation ─────────────────────────────────────────────────── */

export function runDropSimulation(config: DropSimConfig): DropSimResult {
  const { affixPool, rarity, itemLevel, rollCount, seed } = config;
  const rng = createRng(seed);

  // Build power lookup from pool
  const poolMap = new Map(affixPool.map((a) => [a.id, a]));
  const powerFn = (_pool: AffixPoolEntry[], affix: SimRolledAffix): number => {
    const def = poolMap.get(affix.affixId);
    const tag = def?.tags[0];
    return affix.magnitude * (tag ? (POWER_WEIGHTS[tag] ?? 0.5) : 0.5);
  };

  // Roll all items
  const items: RolledItem[] = [];
  for (let i = 0; i < rollCount; i++) {
    items.push(rollSingleItem(affixPool, rarity, itemLevel, rng, powerFn));
  }

  // ── Affix distributions ──
  const affixCounts = new Map<string, { count: number; magnitudes: number[] }>();
  for (const item of items) {
    for (const a of item.affixes) {
      const entry = affixCounts.get(a.affixId) ?? { count: 0, magnitudes: [] };
      entry.count++;
      entry.magnitudes.push(a.magnitude);
      affixCounts.set(a.affixId, entry);
    }
  }

  const itemsWithAffixes = items.filter((it) => it.affixes.length > 0).length || 1;
  const affixDistributions: AffixDistribution[] = affixPool.map((affix) => {
    const stats = affixCounts.get(affix.id);
    if (!stats || stats.count === 0) {
      return {
        affixId: affix.id, name: affix.name, axis: affix.axis,
        frequency: 0, avgMagnitude: 0, minMagnitude: 0, maxMagnitude: 0,
        magnitudeHistogram: new Array(10).fill(0),
      };
    }
    const mags = stats.magnitudes;
    const min = Math.min(...mags);
    const max = Math.max(...mags);
    const avg = mags.reduce((s, v) => s + v, 0) / mags.length;
    const range = max - min || 1;
    const histogram = new Array(10).fill(0) as number[];
    for (const m of mags) {
      const bucket = Math.min(9, Math.floor(((m - min) / range) * 10));
      histogram[bucket]++;
    }

    return {
      affixId: affix.id, name: affix.name, axis: affix.axis,
      frequency: stats.count / itemsWithAffixes,
      avgMagnitude: Math.round(avg * 10) / 10,
      minMagnitude: Math.round(min * 10) / 10,
      maxMagnitude: Math.round(max * 10) / 10,
      magnitudeHistogram: histogram,
    };
  });

  // ── Co-occurrence matrix ──
  const coMap = new Map<string, number>();
  for (const item of items) {
    const ids = item.affixes.map((a) => a.affixId).sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        coMap.set(key, (coMap.get(key) ?? 0) + 1);
      }
    }
  }

  const coOccurrence: CoOccurrenceCell[] = [];
  for (const [key, count] of coMap.entries()) {
    const [affixA, affixB] = key.split('|');
    coOccurrence.push({ affixA, affixB, count, probability: count / itemsWithAffixes });
  }

  // ── Axis coverage ──
  const axisCoverage: Record<TraitAxis, number> = { offensive: 0, defensive: 0, utility: 0, economic: 0 };
  for (const item of items) {
    const axes = new Set(item.affixes.map((a) => a.axis));
    for (const ax of axes) axisCoverage[ax]++;
  }
  for (const ax of Object.keys(axisCoverage) as TraitAxis[]) {
    axisCoverage[ax] = Math.round((axisCoverage[ax] / itemsWithAffixes) * 1000) / 1000;
  }

  // ── Power histogram ──
  const powers = items.map((it) => it.totalPower);
  const minP = Math.min(...powers);
  const maxP = Math.max(...powers);
  const rangeP = maxP - minP || 1;
  const powerHistogram = new Array(10).fill(0) as number[];
  for (const p of powers) {
    const bucket = Math.min(9, Math.floor(((p - minP) / rangeP) * 10));
    powerHistogram[bucket]++;
  }

  // ── Affix count distribution ──
  const countMap = new Map<number, number>();
  for (const item of items) {
    const c = item.affixes.length;
    countMap.set(c, (countMap.get(c) ?? 0) + 1);
  }
  const rarityBreakdown = Array.from(countMap.entries())
    .map(([affixCount, count]) => ({ affixCount, count }))
    .sort((a, b) => a.affixCount - b.affixCount);

  // ── Averages ──
  const totalAffixes = items.reduce((s, it) => s + it.affixes.length, 0);
  const avgAffixCount = Math.round((totalAffixes / items.length) * 100) / 100;
  const avgPower = Math.round(powers.reduce((s, p) => s + p, 0) / items.length * 10) / 10;

  return {
    items,
    affixDistributions,
    coOccurrence,
    axisCoverage,
    avgAffixCount,
    avgPower,
    powerHistogram,
    rarityBreakdown,
  };
}

/* ── UE5 C++ Code Generation ─────────────────────────────────────────── */

export interface ItemDesign {
  name: string;
  displayName: string;
  type: string;
  rarity: Rarity;
  description: string;
  affixPool: AffixPoolEntry[];
}

export function generateUE5Code(design: ItemDesign): string {
  const lines: string[] = [];
  lines.push(`// ── Auto-generated Item Definition: ${design.displayName}`);
  lines.push(`// Generated by PoF AI Loot Designer`);
  lines.push('');
  lines.push('// 1. Item Definition Data Asset');
  lines.push(`UFUNCTION(BlueprintCallable, Category = "Items")`);
  lines.push(`static UARPGItemDefinition* Create_${design.name}()`);
  lines.push('{');
  lines.push(`    UARPGItemDefinition* Def = NewObject<UARPGItemDefinition>();`);
  lines.push(`    Def->DisplayName = FText::FromString(TEXT("${design.displayName}"));`);
  lines.push(`    Def->Description = FText::FromString(TEXT("${design.description}"));`);
  lines.push(`    Def->Type = EItemType::${design.type};`);
  lines.push(`    Def->Rarity = EARPGItemRarity::${design.rarity};`);
  lines.push('    return Def;');
  lines.push('}');
  lines.push('');
  lines.push('// 2. Affix Pool DataTable Rows');
  lines.push('// Add these rows to DT_AffixPool DataTable:');

  for (const affix of design.affixPool) {
    lines.push(`// Row: ${affix.id}`);
    lines.push(`//   AffixTag: Affix.${affix.tags[0]?.replace('Stat.', '') ?? affix.name}`);
    lines.push(`//   DisplayName: "${affix.name}"`);
    lines.push(`//   bIsPrefix: ${affix.isPrefix}`);
    lines.push(`//   MinValue: ${affix.minValue}f`);
    lines.push(`//   MaxValue: ${affix.maxValue}f`);
    lines.push(`//   Weight: ${(affix.designerWeight ?? affix.baseWeight).toFixed(2)}f`);
    lines.push(`//   MinRarity: EARPGItemRarity::${affix.minRarity}`);
  }

  lines.push('');
  lines.push('// 3. Gameplay Effect Class');
  lines.push(`// Create GE_${design.name}_OnEquip with infinite duration`);
  lines.push('// Modifiers: SetByCaller magnitude per rolled affix tag');

  return lines.join('\n');
}
