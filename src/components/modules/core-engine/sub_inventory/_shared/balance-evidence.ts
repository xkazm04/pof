import type { ItemData } from './data';
import type { ItemEconomyResult } from '@/lib/economy/item-economy-engine';
import type { ItemRarity } from '@/types/economy-simulator';

/**
 * Balance Advisor evidence, derived from the items the advisor lists or from a
 * measured economy-sim run. Nothing here is typed by hand: a quantity that was
 * never measured is reported as unmeasured with its reason, never as a number.
 */

/* ── Affix pool: the affixes the items actually carry ────────────────────── */

export interface AffixPoolEntry {
  name: string;
  /** Distinct stat texts this affix name carries across items. */
  stats: string[];
  categories: string[];
  /** Items carrying this affix (always >= 1). */
  carriedBy: number;
}

export function deriveAffixPool(items: readonly ItemData[]): AffixPoolEntry[] {
  const byName = new Map<string, { stats: Set<string>; categories: Set<string>; carriedBy: number }>();
  for (const item of items) {
    const seen = new Set<string>();
    for (const a of item.affixes ?? []) {
      const e = byName.get(a.name) ?? { stats: new Set<string>(), categories: new Set<string>(), carriedBy: 0 };
      e.stats.add(a.stat);
      e.categories.add(a.category);
      if (!seen.has(a.name)) { e.carriedBy++; seen.add(a.name); }
      byName.set(a.name, e);
    }
  }
  return [...byName.entries()]
    .map(([name, e]) => ({ name, stats: [...e.stats], categories: [...e.categories], carriedBy: e.carriedBy }))
    .sort((a, b) => b.carriedBy - a.carriedBy || a.name.localeCompare(b.name));
}

/* ── Combat profile: DPS from the item's own Damage / Speed stats ────────── */

export type CombatProfile = { dps: number; basis: string } | { dps: null; reason: string };

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const DAMAGE_RANGE = new RegExp(String.raw`^${NUM}\s*-\s*${NUM}$`);
const SECONDS_PER_ATTACK = new RegExp(String.raw`^${NUM}\s*s$`);
const ATTACKS_PER_SECOND = new RegExp(String.raw`^${NUM}\s*/\s*s$`);

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * DPS = average damage per hit × attacks per second, with the unit stated in the
 * basis. Speed "1.2s" is seconds per attack; "2/s" is attacks per second; a bare
 * number carries no unit and is not guessed.
 */
export function itemCombatProfile(item: ItemData): CombatProfile {
  const dmg = item.stats.find((s) => /damage$/i.test(s.label.trim()) && DAMAGE_RANGE.test(s.value.trim()));
  if (!dmg) return { dps: null, reason: 'no Damage stat with an "a-b" range' };
  const [, lo, hi] = DAMAGE_RANGE.exec(dmg.value.trim())!;
  const avgDamage = round2((Number(lo) + Number(hi)) / 2);

  const speed = item.stats.find((s) => /speed$/i.test(s.label.trim()));
  if (!speed) return { dps: null, reason: 'no Speed stat' };
  const v = speed.value.trim();
  const spa = SECONDS_PER_ATTACK.exec(v);
  if (spa) {
    const seconds = Number(spa[1]);
    if (seconds <= 0) return { dps: null, reason: `${speed.label} "${v}" is not a positive interval` };
    return { dps: round2(avgDamage / seconds), basis: `avg damage ${avgDamage} / ${seconds} s per attack` };
  }
  const aps = ATTACKS_PER_SECOND.exec(v);
  if (aps) {
    const rate = Number(aps[1]);
    return { dps: round2(avgDamage * rate), basis: `avg damage ${avgDamage} × ${rate} attacks/s` };
  }
  return { dps: null, reason: `${speed.label} "${v}" carries no unit (s per attack or /s)` };
}

export interface DpsRow { name: string; rarity: string; subtype: string; dps: number; basis: string }
export interface DpsTable { rows: DpsRow[]; unparsed: { name: string; reason: string }[] }

/** DPS for every item that states one; the rest are listed as unparsed, never zero. */
export function deriveDpsTable(items: readonly ItemData[]): DpsTable {
  const rows: DpsRow[] = [];
  const unparsed: DpsTable['unparsed'] = [];
  for (const item of items) {
    const p = itemCombatProfile(item);
    if (p.dps === null) unparsed.push({ name: item.name, reason: p.reason });
    else rows.push({ name: item.name, rarity: item.rarity, subtype: item.subtype, dps: p.dps, basis: p.basis });
  }
  return { rows, unparsed };
}

/* ── Rarity distribution: measured by a sim run, or UNMEASURED ───────────── */

export type RarityEvidence =
  | { state: 'measured'; level: number; shares: Record<ItemRarity, number>; basis: string }
  | { state: 'unmeasured'; level: number; reason: string };

/** The rarity shares a sim run measured at `level`, with the run's basis. */
export function rarityEvidence(sim: ItemEconomyResult | null, level: number): RarityEvidence {
  if (!sim) return { state: 'unmeasured', level, reason: 'no economy simulation run was passed to the advisor' };
  const { seed, playerCount, maxHours, maxLevel } = sim.config;
  const run = `runItemEconomySim seed ${seed}, ${playerCount} players, ${maxHours} h`;
  const bracket = sim.brackets.find((b) => b.level === level);
  if (!bracket) return { state: 'unmeasured', level, reason: `Lv${level} is beyond the simulated maxLevel ${maxLevel} (${run})` };
  const total = Object.values(bracket.rarityDistribution).reduce((s, v) => s + v, 0);
  if (total <= 0) return { state: 'unmeasured', level, reason: `no simulated agent reached Lv${level} (${run})` };
  return {
    state: 'measured', level, shares: { ...bracket.rarityDistribution },
    basis: `${run}; Lv${level} bracket: ${bracket.agents} agents sampled, ${bracket.agentsReached} reached`,
  };
}
