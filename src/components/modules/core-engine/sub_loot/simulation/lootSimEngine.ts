/**
 * One seeded loot-sim engine. Pure and dependency-free (beyond the tuner's EV math):
 * the Monte Carlo panel, the Drop Simulator and the Economy tab all read it, so a
 * quantity has one authority and every roll is reproducible from a seed.
 */

import { mcStats } from './monte-carlo-utils';
import { exactEV } from '../_shared/bindingTuner';
import { SMART_LOOT_DATA } from '../_shared/data-binding';
import type { EnemyLootBinding } from '../_shared/data-binding';

export type Rng = () => number;
export type EconomyProfile = 'casual' | 'hardcore';
type RarityGold = Record<string, number>;

/** mulberry32: small, fast, good enough for a design what-if. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted pick. Returns the tier index, or -1 when no weight is positive. */
export function sampleRarity(weights: readonly number[], rng: Rng): number {
  let total = 0;
  let last = -1;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > 0) { total += weights[i]; last = i; }
  }
  if (last < 0) return -1;
  const roll = rng() * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    acc += weights[i];
    if (roll < acc) return i;
  }
  return last;
}

/** Per-tier drop counts for `n` kills of one binding. Same seed, same counts. */
export function runBatch(
  binding: Pick<EnemyLootBinding, 'dropChance' | 'rarityWeights'>,
  n: number,
  seed: number,
): number[] {
  const rng = createRng(seed);
  const counts = binding.rarityWeights.map(() => 0);
  for (let i = 0; i < n; i++) {
    if (rng() >= binding.dropChance) continue;
    const idx = sampleRarity(binding.rarityWeights, rng);
    if (idx >= 0) counts[idx]++;
  }
  return counts;
}

export type DeviationSeverity = 'ok' | 'warn' | 'error';

/** Observed count against the binding's OWN expectation: dropChance * weight share. */
export function deviationFor(
  binding: Pick<EnemyLootBinding, 'dropChance' | 'rarityWeights'>,
  tierIdx: number,
  n: number,
  counts: readonly number[],
): { expected: number; label: string; severity: DeviationSeverity } {
  const total = binding.rarityWeights.reduce((s, w) => s + Math.max(0, w), 0);
  const share = total > 0 ? Math.max(0, binding.rarityWeights[tierIdx] ?? 0) / total : 0;
  const p = binding.dropChance * share;
  const expected = n * p;
  const delta = (counts[tierIdx] ?? 0) - expected;
  const rounded = Math.round(delta);
  if (rounded === 0) return { expected, label: 'as expected', severity: 'ok' };
  const stdDev = Math.sqrt(n * p * (1 - p));
  const severity: DeviationSeverity = Math.abs(delta) > 2 * stdDev ? 'error' : Math.abs(delta) > stdDev ? 'warn' : 'ok';
  const abs = Math.abs(rounded);
  return { expected, label: rounded > 0 ? `+${abs} above` : `−${abs} below`, severity };
}

/** Kills per hour per player profile, and play hours per day (the "estimated playtime"). */
export const ECONOMY_KILLS_PER_HOUR: Record<EconomyProfile, number> = { casual: 120, hardcore: 320 };
export const ECONOMY_HOURS_PER_DAY: Record<EconomyProfile, number> = { casual: 0.5, hardcore: 4 };
export const LEGENDARY_SET_PIECES = 5;

export interface DerivedEconomy {
  goldPerHour: number;
  itemsPerHour: number;
  legendaryPerHour: number;
  /** Hours to the first Legendary; null when the roster never drops one. */
  hoursPerLegendary: number | null;
  /** Days of play to collect a Legendary set; null when never. */
  legendaryDays: number | null;
}

/** Economy rollups from the tuned roster: the mean kill of the roster, scaled by kills/hour. */
export function deriveEconomy(
  bindings: readonly EnemyLootBinding[],
  gold: RarityGold,
  killsPerHour: Record<EconomyProfile, number>,
  profile: EconomyProfile,
): DerivedEconomy {
  const kph = killsPerHour[profile];
  const n = bindings.length;
  let ev = 0;
  let drops = 0;
  let legendary = 0;
  for (const b of bindings) {
    ev += exactEV(b, gold);
    drops += b.dropChance;
    const total = b.rarityWeights.reduce((s, w) => s + Math.max(0, w), 0);
    const last = b.rarityWeights.length - 1;
    if (total > 0 && last >= 0) legendary += b.dropChance * (Math.max(0, b.rarityWeights[last]) / total);
  }
  const mean = (x: number) => (n > 0 ? x / n : 0);
  const legendaryPerHour = mean(legendary) * kph;
  const hoursPerLegendary = legendaryPerHour > 0 ? 1 / legendaryPerHour : null;
  return {
    goldPerHour: mean(ev) * kph,
    itemsPerHour: mean(drops) * kph,
    legendaryPerHour,
    hoursPerLegendary,
    legendaryDays: hoursPerLegendary === null
      ? null
      : (hoursPerLegendary * LEGENDARY_SET_PIECES) / ECONOMY_HOURS_PER_DAY[profile],
  };
}

/** Per-tier summary of a Monte Carlo tally (tier name -> one count per run). */
export function mcSummary(tally: Record<string, number[]>): Record<string, ReturnType<typeof mcStats>> {
  const out: Record<string, ReturnType<typeof mcStats>> = {};
  for (const k of Object.keys(tally)) out[k] = mcStats(tally[k]);
  return out;
}

/** Share uplift of drops going to high gear-gap slots under smart loot vs raw. */
export function smartLootLift(minGap = 10): { liftPct: number; slots: number } {
  const hi = SMART_LOOT_DATA.filter((s) => s.gearScoreGap >= minGap);
  const raw = hi.reduce((s, x) => s + x.rawPct, 0);
  const smart = hi.reduce((s, x) => s + x.smartPct, 0);
  return { liftPct: raw > 0 ? Math.round(((smart - raw) / raw) * 100) : 0, slots: hi.length };
}
