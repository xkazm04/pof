/**
 * The ONE reward-pacing model for the Progression Rewards tab.
 *
 * Puts the reward schedule on the clock: every time figure the tab shows
 * (minutes per level, days to max per playstyle, hours between unlocks,
 * drought / clump flags, the even re-spacing) and the unlock column the XP
 * table exports to UE are derived here from the live curve.
 *
 * XP per level comes from `calculateXpForLevel` (the one XP law). The earn
 * rate is an explicit, displayed ASSUMPTION, not a measurement:
 *   xpPerMin(L) = xpPerMinAtL1 * L^rateGrowth
 * so minutes to clear level L = calculateXpForLevel(L) / xpPerMin(L).
 *
 * DOM-free on purpose so it can be unit-tested in isolation.
 */
import { calculateXpForLevel, MAX_LEVEL, type LEVEL_REWARDS } from './data';

/** One authored reward (the shape of LEVEL_REWARDS rows). */
export type LevelReward = (typeof LEVEL_REWARDS)[number];

export interface PacingModel {
  baseXp: number;
  exponent: number;
  maxLevel: number;
  /** Assumed XP earned per minute of play at level 1. */
  xpPerMinAtL1: number;
  /** Assumed growth of the earn rate: xpPerMin(L) = xpPerMinAtL1 * L^rateGrowth. */
  rateGrowth: number;
}

/** The stated earn-rate assumption shown beside every time figure. */
export const DEFAULT_RATE = { xpPerMinAtL1: 100, rateGrowth: 1 } as const;

/** Minutes per day for the playstyle comparison rows. */
export const PLAYSTYLES = [
  { id: 'casual', label: 'Casual (30min/day)', minutesPerDay: 30 },
  { id: 'hardcore', label: 'Hardcore (4hr/day)', minutesPerDay: 240 },
] as const;

/** A gap longer than this multiple of the median gap is a drought. */
export const DROUGHT_FACTOR = 2;

export function pacingModel(baseXp: number, exponent: number, maxLevel: number = MAX_LEVEL): PacingModel {
  return { baseXp, exponent, maxLevel, ...DEFAULT_RATE };
}

export function xpPerMinAt(model: PacingModel, level: number): number {
  return model.xpPerMinAtL1 * Math.pow(level, model.rateGrowth);
}

/** Minutes to clear each level; index 0 is level 1, length = maxLevel. */
export function minutesPerLevel(model: PacingModel): number[] {
  return Array.from({ length: model.maxLevel }, (_, i) => {
    const level = i + 1;
    return calculateXpForLevel(level, model.baseXp, model.exponent) / xpPerMinAt(model, level);
  });
}

/** Cumulative minutes; cum[L] = minutes to clear levels 1..L, cum[0] = 0. */
export function cumulativeMinutes(model: PacingModel): number[] {
  const cum = [0];
  for (const m of minutesPerLevel(model)) cum.push(cum[cum.length - 1] + m);
  return cum;
}

export function daysToMax(model: PacingModel, minutesPerDay: number): number {
  const cum = cumulativeMinutes(model);
  return cum[cum.length - 1] / minutesPerDay;
}

/* -- Reward schedule ------------------------------------------------------ */

export interface RewardGroup<R extends { level: number } = LevelReward> {
  level: number;
  rewards: R[];
}

/** Group rewards by unlock level (ascending); co-level rewards keep source order. */
export function rewardSchedule<R extends { level: number }>(rewards: readonly R[]): RewardGroup<R>[] {
  const byLevel = new Map<number, R[]>();
  for (const r of rewards) {
    const list = byLevel.get(r.level);
    if (list) list.push(r);
    else byLevel.set(r.level, [r]);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, list]) => ({ level, rewards: list }));
}

/** The exported UnlockReward cell: every reward at the level, one cell. */
export function unlockRewardCell(rewards: readonly { name: string; type: string }[]): string {
  return rewards.map((r) => `${r.name} (${r.type})`).join('; ');
}

/* -- Timeline ------------------------------------------------------------- */

export interface PacingEntry<R extends { level: number }> extends RewardGroup<R> {
  hoursFromStart: number;
  /** Hours since the previous unlock (from the start for the first). */
  gapHours: number;
  drought: boolean;
  /** More than one reward lands on this level. */
  clump: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function pacingTimeline<R extends { level: number }>(
  model: PacingModel,
  schedule: readonly RewardGroup<R>[],
): PacingEntry<R>[] {
  const cum = cumulativeMinutes(model);
  const at = (level: number) => cum[Math.min(Math.max(level, 0), model.maxLevel)] / 60;
  const gaps = schedule.map((g, i) => at(g.level) - (i ? at(schedule[i - 1].level) : 0));
  const threshold = DROUGHT_FACTOR * median(gaps);
  return schedule.map((g, i) => ({
    ...g,
    hoursFromStart: at(g.level),
    gapHours: gaps[i],
    drought: gaps[i] > threshold,
    clump: g.rewards.length > 1,
  }));
}

/** Coefficient of variation (population) of the unlock gaps; 0 = perfectly even. */
export function gapCV(gapHours: readonly number[]): number {
  if (gapHours.length === 0) return 0;
  const mean = gapHours.reduce((s, x) => s + x, 0) / gapHours.length;
  if (mean === 0) return 0;
  const variance = gapHours.reduce((s, x) => s + (x - mean) ** 2, 0) / gapHours.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Levels that space the schedule's groups evenly in PLAY TIME: group k of n
 * lands on the level whose cumulative time is closest to k/n of time-to-max.
 * Levels are strictly increasing, within [1, maxLevel], and the last is the cap.
 * Returns the current levels unchanged when the groups cannot fit.
 */
export function evenSpacingSuggestion(model: PacingModel, schedule: readonly RewardGroup<{ level: number }>[]): number[] {
  const n = schedule.length;
  if (n === 0 || n > model.maxLevel) return schedule.map((g) => g.level);
  const cum = cumulativeMinutes(model);
  const total = cum[model.maxLevel];
  const levels: number[] = [];
  for (let k = 1; k <= n; k++) {
    const target = (total * k) / n;
    let best = 1;
    for (let l = 1; l <= model.maxLevel; l++) {
      if (Math.abs(cum[l] - target) < Math.abs(cum[best] - target)) best = l;
    }
    const lo = (levels[levels.length - 1] ?? 0) + 1;
    const hi = model.maxLevel - (n - k);
    levels.push(k === n ? model.maxLevel : Math.min(Math.max(best, lo), hi));
  }
  return levels;
}

/** Move each group (in order) to the given level; rewards travel with their group. */
export function respaceSchedule<R extends { level: number }>(
  schedule: readonly RewardGroup<R>[],
  levels: readonly number[],
): RewardGroup<R>[] {
  return schedule.map((g, i) => {
    const level = levels[i] ?? g.level;
    return { level, rewards: g.rewards.map((r) => ({ ...r, level })) };
  });
}
