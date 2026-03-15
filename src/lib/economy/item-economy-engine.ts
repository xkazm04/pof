/** ── Item Economy Monte Carlo Engine ──────────────────────────────────────── *
 * Simulates thousands of players progressing through the game, receiving
 * item drops, rolling affixes via UE5 logic, equipping gear, and trading.
 * Projects real loot distributions, power curves, and economy health.
 * ────────────────────────────────────────────────────────────────────────── */

import type { EconomyItem, ItemRarity } from '@/types/economy-simulator';
import { DEFAULT_ITEMS, DEFAULT_FAUCETS, DEFAULT_SINKS, generateXPCurve } from './definitions';

/* ── Seeded RNG (identical to combat engine) ───────────────────────────── */

function createRNG(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Affix definitions matching ItemCatalog/UE5 ────────────────────────── */

const AFFIX_COUNT_RANGES: Record<string, [number, number]> = {
  common: [0, 0],
  uncommon: [1, 2],
  rare: [3, 4],
  epic: [4, 5],
  legendary: [5, 6],
};

interface AffixDef {
  id: string;
  name: string;
  statKey: string;
  minValue: number;
  maxValue: number;
  weight: number;
  minRarity: ItemRarity;
}

const AFFIX_POOL: AffixDef[] = [
  { id: 'str', name: 'of Strength', statKey: 'strength', minValue: 3, maxValue: 15, weight: 1.5, minRarity: 'common' },
  { id: 'atk', name: 'Fierce', statKey: 'attackPower', minValue: 5, maxValue: 25, weight: 1.2, minRarity: 'common' },
  { id: 'arm', name: 'Fortified', statKey: 'armor', minValue: 5, maxValue: 30, weight: 1.5, minRarity: 'common' },
  { id: 'hp', name: 'of Vitality', statKey: 'maxHealth', minValue: 10, maxValue: 80, weight: 1.3, minRarity: 'common' },
  { id: 'spd', name: 'of Swiftness', statKey: 'moveSpeed', minValue: 3, maxValue: 12, weight: 1.0, minRarity: 'common' },
  { id: 'crit', name: 'of Precision', statKey: 'critChance', minValue: 2, maxValue: 12, weight: 0.8, minRarity: 'rare' },
  { id: 'cdmg', name: 'Devastating', statKey: 'critDamage', minValue: 10, maxValue: 50, weight: 0.5, minRarity: 'epic' },
  { id: 'regen', name: 'Regenerating', statKey: 'healthRegen', minValue: 1, maxValue: 8, weight: 0.6, minRarity: 'rare' },
  { id: 'mana', name: 'of Intellect', statKey: 'maxMana', minValue: 10, maxValue: 60, weight: 1.0, minRarity: 'common' },
  { id: 'cdr', name: 'Quickened', statKey: 'cooldownReduction', minValue: 2, maxValue: 10, weight: 0.8, minRarity: 'rare' },
  { id: 'dodge', name: 'of Evasion', statKey: 'dodgeChance', minValue: 2, maxValue: 10, weight: 0.5, minRarity: 'epic' },
  { id: 'gold', name: 'Prosperous', statKey: 'goldFind', minValue: 5, maxValue: 30, weight: 0.8, minRarity: 'uncommon' },
  { id: 'mf', name: 'of Fortune', statKey: 'magicFind', minValue: 3, maxValue: 20, weight: 0.6, minRarity: 'rare' },
  { id: 'aspd', name: 'of Haste', statKey: 'attackSpeed', minValue: 3, maxValue: 15, weight: 0.7, minRarity: 'rare' },
  { id: 'pen', name: 'Piercing', statKey: 'armorPen', minValue: 3, maxValue: 18, weight: 0.4, minRarity: 'epic' },
  { id: 'xp', name: 'of the Scholar', statKey: 'xpBonus', minValue: 3, maxValue: 15, weight: 0.5, minRarity: 'legendary' },
];

const RARITY_ORDER: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function rarityIndex(r: ItemRarity): number {
  return RARITY_ORDER.indexOf(r);
}

/* ── Rolled item representation ────────────────────────────────────────── */

interface RolledItem {
  baseItem: EconomyItem;
  itemLevel: number;
  affixes: { statKey: string; value: number }[];
  totalPower: number;
}

/* ── Simulation config ─────────────────────────────────────────────────── */

export interface ItemEconomyConfig {
  playerCount: number;
  maxLevel: number;
  maxHours: number;
  dropsPerHour: number;
  seed: number;
}

export const DEFAULT_ITEM_ECON_CONFIG: ItemEconomyConfig = {
  playerCount: 500,
  maxLevel: 25,
  maxHours: 80,
  dropsPerHour: 8,
  seed: 42,
};

/* ── Per-level bracket output ──────────────────────────────────────────── */

export interface LevelBracketStats {
  level: number;
  /** Average total item power across all agents at this level */
  avgItemPower: number;
  minItemPower: number;
  maxItemPower: number;
  /** Percentage of items per rarity */
  rarityDistribution: Record<ItemRarity, number>;
  /** Percentage of affixes by stat key */
  affixSaturation: Record<string, number>;
  /** Average number of gear upgrades (equip swaps) at this level */
  avgUpgrades: number;
  /** Average gold held */
  avgGold: number;
  /** Average hours played to reach this level */
  avgHoursToReach: number;
  /** How many items were replaced (gear churn) */
  gearReplacementCount: number;
}

/* ── Balance alerts ────────────────────────────────────────────────────── */

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface EconomyAlert {
  severity: AlertSeverity;
  type: string;
  message: string;
  level: number;
  metric: string;
  value: number;
  threshold: number;
}

/* ── Simulation result ─────────────────────────────────────────────────── */

export interface ItemEconomyResult {
  config: ItemEconomyConfig;
  brackets: LevelBracketStats[];
  alerts: EconomyAlert[];
  /** Power curve data points (level vs avg power) */
  powerCurve: { level: number; avgPower: number; p10: number; p90: number }[];
  /** Affix saturation across all levels */
  globalAffixSaturation: Record<string, number>;
  /** Rarity inflation: ratio of rare+ items at endgame vs early game */
  rarityInflation: number;
  durationMs: number;
}

/* ── Core simulation ───────────────────────────────────────────────────── */

function rollAffixCount(rarity: ItemRarity, rng: () => number): number {
  const [min, max] = AFFIX_COUNT_RANGES[rarity] ?? [0, 0];
  return min + Math.floor(rng() * (max - min + 1));
}

function rollAffixes(
  rarity: ItemRarity,
  itemLevel: number,
  rng: () => number,
): { statKey: string; value: number }[] {
  const count = rollAffixCount(rarity, rng);
  if (count === 0) return [];

  // Rarity gate filter
  const eligible = AFFIX_POOL.filter((a) => rarityIndex(a.minRarity) <= rarityIndex(rarity));
  if (eligible.length === 0) return [];

  const result: { statKey: string; value: number }[] = [];
  const remaining = [...eligible];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Weighted selection
    const totalW = remaining.reduce((s, a) => s + a.weight, 0);
    let roll = rng() * totalW;
    let pickIdx = 0;
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].weight;
      if (roll <= 0) { pickIdx = j; break; }
    }
    const picked = remaining[pickIdx];
    remaining.splice(pickIdx, 1); // without replacement

    // UE5 magnitude scaling: FRandRange(Min, Max) * (1 + 0.1 * ItemLevel)
    const base = picked.minValue + rng() * (picked.maxValue - picked.minValue);
    const scaled = base * (1 + 0.1 * itemLevel);
    result.push({ statKey: picked.statKey, value: Math.round(scaled * 10) / 10 });
  }

  return result;
}

function calcItemPower(affixes: { statKey: string; value: number }[]): number {
  // Simple power metric: sum of all affix values with weighting
  const weights: Record<string, number> = {
    strength: 1.0, attackPower: 1.2, armor: 0.8, maxHealth: 0.5,
    critChance: 2.0, critDamage: 1.5, attackSpeed: 1.3, armorPen: 1.8,
    healthRegen: 0.7, maxMana: 0.4, cooldownReduction: 1.1, dodgeChance: 1.5,
    moveSpeed: 0.6, goldFind: 0.3, magicFind: 0.3, xpBonus: 0.2,
  };
  return affixes.reduce((sum, a) => sum + a.value * (weights[a.statKey] ?? 1), 0);
}

function rollItemDrop(
  level: number,
  rng: () => number,
): RolledItem | null {
  // Filter eligible items by level
  const eligible = DEFAULT_ITEMS.filter(
    (it) => it.minLevel <= level && (it.category === 'weapon' || it.category === 'armor')
  );
  if (eligible.length === 0) return null;

  // Weighted selection by dropWeight
  const totalW = eligible.reduce((s, it) => s + it.dropWeight, 0);
  let roll = rng() * totalW;
  let picked = eligible[0];
  for (const item of eligible) {
    roll -= item.dropWeight;
    if (roll <= 0) { picked = item; break; }
  }

  const affixes = rollAffixes(picked.rarity, level, rng);
  return {
    baseItem: picked,
    itemLevel: level,
    affixes,
    totalPower: calcItemPower(affixes) + (picked.buyPrice * 0.01), // base item contributes
  };
}

interface AgentState {
  level: number;
  xp: number;
  gold: number;
  equippedPower: number;
  equippedRarity: ItemRarity;
  totalUpgrades: number;
  hoursPlayed: number;
  itemsSeen: number;
  affixCounts: Record<string, number>;
  rarityCounts: Record<ItemRarity, number>;
}

function goldPerHourAtLevel(level: number, type: 'faucet' | 'sink'): number {
  const flows = type === 'faucet' ? DEFAULT_FAUCETS : DEFAULT_SINKS;
  return flows
    .filter((f) => level >= f.minLevel && (f.maxLevel === 0 || level <= f.maxLevel))
    .reduce((sum, f) => sum + (f.baseAmount + f.levelScaling * level) * f.frequencyPerHour, 0);
}

export function runItemEconomySim(config: ItemEconomyConfig): ItemEconomyResult {
  const start = performance.now();
  const rng = createRNG(config.seed);
  const xpCurve = generateXPCurve(config.maxLevel);

  // Initialize agents
  const agents: AgentState[] = Array.from({ length: config.playerCount }, () => ({
    level: 1,
    xp: 0,
    gold: 50, // starting gold
    equippedPower: 0,
    equippedRarity: 'common' as ItemRarity,
    totalUpgrades: 0,
    hoursPlayed: 0,
    itemsSeen: 0,
    affixCounts: {},
    rarityCounts: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
  }));

  // Per-level accumulators
  const brackets: Map<number, {
    powers: number[];
    upgrades: number[];
    golds: number[];
    hours: number[];
    affixCounts: Record<string, number>;
    rarityCounts: Record<ItemRarity, number>;
    gearReplacements: number;
    totalItems: number;
  }> = new Map();

  for (let lvl = 1; lvl <= config.maxLevel; lvl++) {
    brackets.set(lvl, {
      powers: [], upgrades: [], golds: [], hours: [],
      affixCounts: {}, rarityCounts: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
      gearReplacements: 0, totalItems: 0,
    });
  }

  // XP needed per level
  const xpNeeded = (lvl: number) => xpCurve[lvl - 1]?.xpRequired ?? 99999;

  // Simulate hourly ticks
  for (let hour = 0; hour < config.maxHours; hour++) {
    for (const agent of agents) {
      if (agent.level >= config.maxLevel) continue;
      agent.hoursPlayed = hour + 1;

      // Gold flow
      const inflow = goldPerHourAtLevel(agent.level, 'faucet');
      const outflow = goldPerHourAtLevel(agent.level, 'sink');
      agent.gold = Math.max(0, agent.gold + inflow - outflow);

      // XP gain (simplified: XP per hour scales with level)
      const xpPerHour = 100 + agent.level * 40 + rng() * 50;
      agent.xp += xpPerHour;

      // Level up check
      while (agent.level < config.maxLevel && agent.xp >= xpNeeded(agent.level + 1)) {
        agent.xp -= xpNeeded(agent.level + 1);
        agent.level++;
      }

      // Item drops
      const drops = Math.round(config.dropsPerHour * (0.8 + rng() * 0.4));
      for (let d = 0; d < drops; d++) {
        const item = rollItemDrop(agent.level, rng);
        if (!item) continue;

        agent.itemsSeen++;
        agent.rarityCounts[item.baseItem.rarity]++;

        // Track affixes
        for (const aff of item.affixes) {
          agent.affixCounts[aff.statKey] = (agent.affixCounts[aff.statKey] ?? 0) + 1;
        }

        // Equip if better
        if (item.totalPower > agent.equippedPower) {
          agent.equippedPower = item.totalPower;
          agent.equippedRarity = item.baseItem.rarity;
          agent.totalUpgrades++;

          const b = brackets.get(agent.level);
          if (b) b.gearReplacements++;
        }
      }

      // Record bracket data
      const b = brackets.get(agent.level);
      if (b) {
        b.powers.push(agent.equippedPower);
        b.upgrades.push(agent.totalUpgrades);
        b.golds.push(agent.gold);
        b.hours.push(agent.hoursPlayed);
        b.totalItems += drops;
      }
    }
  }

  // Finalize bracket stats
  const bracketResults: LevelBracketStats[] = [];
  const globalAffixTotal: Record<string, number> = {};
  let earlyRarePlus = 0;
  let endgameRarePlus = 0;
  let earlyTotal = 0;
  let endgameTotal = 0;

  for (let lvl = 1; lvl <= config.maxLevel; lvl++) {
    const b = brackets.get(lvl)!;
    if (b.powers.length === 0) {
      bracketResults.push({
        level: lvl, avgItemPower: 0, minItemPower: 0, maxItemPower: 0,
        rarityDistribution: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
        affixSaturation: {}, avgUpgrades: 0, avgGold: 0, avgHoursToReach: 0,
        gearReplacementCount: 0,
      });
      continue;
    }

    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const sorted = [...b.powers].sort((a, c) => a - c);

    // Aggregate rarity counts from agents at this level
    const agentsAtLevel = agents.filter((a) => a.level >= lvl);
    const rarityDist: Record<ItemRarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    let totalRarity = 0;
    for (const a of agentsAtLevel) {
      for (const r of RARITY_ORDER) {
        rarityDist[r] += a.rarityCounts[r];
        totalRarity += a.rarityCounts[r];
      }
    }
    if (totalRarity > 0) {
      for (const r of RARITY_ORDER) rarityDist[r] = rarityDist[r] / totalRarity;
    }

    // Affix saturation
    const affixSat: Record<string, number> = {};
    let affixTotal = 0;
    for (const a of agentsAtLevel) {
      for (const [key, count] of Object.entries(a.affixCounts)) {
        affixSat[key] = (affixSat[key] ?? 0) + count;
        globalAffixTotal[key] = (globalAffixTotal[key] ?? 0) + count;
        affixTotal += count;
      }
    }
    if (affixTotal > 0) {
      for (const key of Object.keys(affixSat)) affixSat[key] /= affixTotal;
    }

    // Rarity inflation tracking
    if (lvl <= 5) {
      for (const r of RARITY_ORDER) {
        if (rarityIndex(r) >= 2) earlyRarePlus += rarityDist[r];
        earlyTotal++;
      }
    }
    if (lvl >= config.maxLevel - 3) {
      for (const r of RARITY_ORDER) {
        if (rarityIndex(r) >= 2) endgameRarePlus += rarityDist[r];
        endgameTotal++;
      }
    }

    bracketResults.push({
      level: lvl,
      avgItemPower: Math.round(avg(b.powers) * 10) / 10,
      minItemPower: Math.round(sorted[0] * 10) / 10,
      maxItemPower: Math.round(sorted[sorted.length - 1] * 10) / 10,
      rarityDistribution: rarityDist,
      affixSaturation: affixSat,
      avgUpgrades: Math.round(avg(b.upgrades) * 10) / 10,
      avgGold: Math.round(avg(b.golds)),
      avgHoursToReach: Math.round(avg(b.hours) * 10) / 10,
      gearReplacementCount: b.gearReplacements,
    });
  }

  // Global affix saturation
  const globalTotal = Object.values(globalAffixTotal).reduce((s, v) => s + v, 0);
  const globalAffixSaturation: Record<string, number> = {};
  if (globalTotal > 0) {
    for (const [key, count] of Object.entries(globalAffixTotal)) {
      globalAffixSaturation[key] = count / globalTotal;
    }
  }

  // Power curve (percentiles)
  const powerCurve = bracketResults.map((b) => {
    const agentsHere = agents.filter((a) => a.level >= b.level);
    const powers = agentsHere.map((a) => a.equippedPower).sort((a, c) => a - c);
    const p10 = powers[Math.floor(powers.length * 0.1)] ?? 0;
    const p90 = powers[Math.floor(powers.length * 0.9)] ?? 0;
    return { level: b.level, avgPower: b.avgItemPower, p10: Math.round(p10 * 10) / 10, p90: Math.round(p90 * 10) / 10 };
  });

  // Rarity inflation ratio
  const earlyRate = earlyTotal > 0 ? earlyRarePlus / earlyTotal : 0;
  const endgameRate = endgameTotal > 0 ? endgameRarePlus / endgameTotal : 0;
  const rarityInflation = earlyRate > 0 ? endgameRate / earlyRate : 1;

  // Detect alerts
  const alerts: EconomyAlert[] = [];

  // Check power plateaus
  for (let i = 2; i < powerCurve.length; i++) {
    const prev = powerCurve[i - 1];
    const curr = powerCurve[i];
    if (prev.avgPower > 0 && curr.avgPower > 0) {
      const growth = (curr.avgPower - prev.avgPower) / prev.avgPower;
      if (growth < 0.02) {
        alerts.push({
          severity: 'warning', type: 'power-plateau',
          message: `Power growth stalls at level ${curr.level} (${(growth * 100).toFixed(1)}% growth)`,
          level: curr.level, metric: 'powerGrowth', value: growth, threshold: 0.02,
        });
      }
    }
  }

  // Check rarity obsolescence
  for (let i = 1; i < bracketResults.length; i++) {
    const b = bracketResults[i];
    if (b.level >= config.maxLevel - 2 && b.rarityDistribution.rare > 0.01 && b.rarityDistribution.legendary > 0.15) {
      alerts.push({
        severity: 'critical', type: 'rarity-obsolescence',
        message: `Legendary items flood endgame at level ${b.level} — Rare items become obsolete`,
        level: b.level, metric: 'legendaryRate', value: b.rarityDistribution.legendary, threshold: 0.15,
      });
    }
  }

  // Check affix saturation
  for (const [stat, pct] of Object.entries(globalAffixSaturation)) {
    if (pct > 0.20) {
      alerts.push({
        severity: 'warning', type: 'affix-saturation',
        message: `"${stat}" dominates affix pool at ${(pct * 100).toFixed(1)}% — trivially available`,
        level: 0, metric: 'affixSaturation', value: pct, threshold: 0.20,
      });
    }
  }

  // Check rarity inflation
  if (rarityInflation > 5) {
    alerts.push({
      severity: 'critical', type: 'rarity-inflation',
      message: `Rare+ items ${rarityInflation.toFixed(1)}x more common at endgame vs early game`,
      level: config.maxLevel, metric: 'rarityInflation', value: rarityInflation, threshold: 5,
    });
  } else if (rarityInflation > 3) {
    alerts.push({
      severity: 'warning', type: 'rarity-inflation',
      message: `Rare+ items ${rarityInflation.toFixed(1)}x more common at endgame vs early game`,
      level: config.maxLevel, metric: 'rarityInflation', value: rarityInflation, threshold: 3,
    });
  }

  // Check gear replacement cadence (too fast or too slow)
  for (const b of bracketResults) {
    if (b.level >= 3 && b.avgUpgrades < 0.5 && b.avgItemPower > 0) {
      alerts.push({
        severity: 'info', type: 'low-upgrade-cadence',
        message: `Few gear upgrades at level ${b.level} — players may feel stuck`,
        level: b.level, metric: 'avgUpgrades', value: b.avgUpgrades, threshold: 0.5,
      });
    }
  }

  return {
    config,
    brackets: bracketResults,
    alerts,
    powerCurve,
    globalAffixSaturation,
    rarityInflation,
    durationMs: performance.now() - start,
  };
}
