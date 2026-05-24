import { RARITY_COLORS } from '@/lib/chart-colors';

/* ── Item Comparison Data ──────────────────────────────────────────────── */

export interface ComparisonStat {
  label: string;
  key: string;
  value: number;
  unit: string;
  higherIsBetter: boolean;
}

export interface ComparableItem {
  id: string;
  name: string;
  rarity: string;
  slot: string;
  stats: ComparisonStat[];
  affixes: { name: string; stat: string; value: number }[];
}

export const COMPARABLE_ITEMS: ComparableItem[] = [
  {
    id: 'c1', name: 'Iron Longsword', rarity: 'Common', slot: 'MainHand',
    stats: [
      { label: 'Base Damage', key: 'baseDmg', value: 15, unit: '', higherIsBetter: true },
      { label: 'Attack Speed', key: 'atkSpd', value: 1.2, unit: '/s', higherIsBetter: true },
      { label: 'Crit Chance', key: 'critChance', value: 5, unit: '%', higherIsBetter: true },
      { label: 'Armor', key: 'armor', value: 0, unit: '', higherIsBetter: true },
      { label: 'Atk Power', key: 'atkPow', value: 10, unit: '', higherIsBetter: true },
    ],
    affixes: [],
  },
  {
    id: 'c2', name: 'Void Daggers', rarity: 'Legendary', slot: 'MainHand',
    stats: [
      { label: 'Base Damage', key: 'baseDmg', value: 40, unit: '', higherIsBetter: true },
      { label: 'Attack Speed', key: 'atkSpd', value: 1.8, unit: '/s', higherIsBetter: true },
      { label: 'Crit Chance', key: 'critChance', value: 15, unit: '%', higherIsBetter: true },
      { label: 'Armor', key: 'armor', value: 0, unit: '', higherIsBetter: true },
      { label: 'Atk Power', key: 'atkPow', value: 25, unit: '', higherIsBetter: true },
    ],
    affixes: [
      { name: 'Armor Penetration', stat: 'Ignores 20% armor', value: 20 },
      { name: 'Vampiric', stat: '+8% Life Steal', value: 8 },
    ],
  },
  {
    id: 'c3', name: 'Crystal Staff', rarity: 'Rare', slot: 'MainHand',
    stats: [
      { label: 'Base Damage', key: 'baseDmg', value: 30, unit: '', higherIsBetter: true },
      { label: 'Attack Speed', key: 'atkSpd', value: 0.8, unit: '/s', higherIsBetter: true },
      { label: 'Crit Chance', key: 'critChance', value: 8, unit: '%', higherIsBetter: true },
      { label: 'Armor', key: 'armor', value: 0, unit: '', higherIsBetter: true },
      { label: 'Atk Power', key: 'atkPow', value: 35, unit: '', higherIsBetter: true },
    ],
    affixes: [
      { name: 'Mana Efficiency', stat: '-10% mana cost', value: 10 },
    ],
  },
  {
    id: 'c4', name: 'Steel Chestplate', rarity: 'Uncommon', slot: 'Chest',
    stats: [
      { label: 'Base Damage', key: 'baseDmg', value: 0, unit: '', higherIsBetter: true },
      { label: 'Attack Speed', key: 'atkSpd', value: 0, unit: '/s', higherIsBetter: true },
      { label: 'Crit Chance', key: 'critChance', value: 0, unit: '%', higherIsBetter: true },
      { label: 'Armor', key: 'armor', value: 45, unit: '', higherIsBetter: true },
      { label: 'Atk Power', key: 'atkPow', value: 0, unit: '', higherIsBetter: true },
    ],
    affixes: [{ name: 'of Fortitude', stat: '+200 Max HP', value: 200 }],
  },
  {
    id: 'c5', name: "Assassin's Cowl", rarity: 'Epic', slot: 'Head',
    stats: [
      { label: 'Base Damage', key: 'baseDmg', value: 0, unit: '', higherIsBetter: true },
      { label: 'Attack Speed', key: 'atkSpd', value: 0, unit: '/s', higherIsBetter: true },
      { label: 'Crit Chance', key: 'critChance', value: 5, unit: '%', higherIsBetter: true },
      { label: 'Armor', key: 'armor', value: 15, unit: '', higherIsBetter: true },
      { label: 'Atk Power', key: 'atkPow', value: 8, unit: '', higherIsBetter: true },
    ],
    affixes: [{ name: 'Shadow Cloak', stat: '-20% detection', value: 20 }],
  },
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Compute effective DPS from item stats, mirroring GAS damage pipeline */
export function computeEffectiveDPS(item: ComparableItem): { dps: number; ttk: number } {
  const baseDmg = item.stats.find(s => s.key === 'baseDmg')?.value ?? 0;
  const atkSpd = item.stats.find(s => s.key === 'atkSpd')?.value ?? 1;
  const critChance = (item.stats.find(s => s.key === 'critChance')?.value ?? 0) / 100;
  const atkPow = item.stats.find(s => s.key === 'atkPow')?.value ?? 0;
  const totalDmg = baseDmg + atkPow;
  const critMulti = 2.0;
  const dps = totalDmg * atkSpd * (1 + critChance * (critMulti - 1));
  const enemyHP = 1000;
  const ttk = dps > 0 ? enemyHP / dps : Infinity;
  return { dps, ttk };
}
