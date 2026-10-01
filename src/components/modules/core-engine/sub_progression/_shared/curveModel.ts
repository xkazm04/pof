/**
 * The ONE curve model for the Progression Curves tab.
 *
 * Every curve figure the tab shows (cumulative XP to the cap, time to max, the
 * per-level comparison, the overlay's XP series) is derived here from the one
 * XP law (`calculateXpForLevel`) and the one pacing clock (`rewardPacing`), so
 * the Curves tab agrees with the exported DataTable's XPTotal column and with
 * the Rewards tab's "Hours to max". No private sample sums, no private clock.
 *
 * DOM-free on purpose so it can be unit-tested in isolation.
 */
import { calculateXpForLevel, COMPARISON_LEVELS, MAX_LEVEL } from './data';
import { cumulativeMinutes, pacingModel } from './rewardPacing';

export interface CurveParams {
  baseXp: number;
  curveExp: number;
}

export interface CurveTotals {
  /** cumulativeXp[L] = XP to clear levels 1..L (the export's XPTotal); [0] = 0. */
  cumulativeXp: number[];
  /** XP to clear every level up to the cap (= cumulativeXp[maxLevel]). */
  totalXp: number;
  /** Hours to the cap on the Rewards-tab clock (cumulativeMinutes / 60). */
  hoursToMax: number;
}

export function curveTotals(baseXp: number, curveExp: number, maxLevel: number = MAX_LEVEL): CurveTotals {
  const cumulativeXp = [0];
  for (let level = 1; level <= maxLevel; level++) {
    cumulativeXp.push(cumulativeXp[level - 1] + calculateXpForLevel(level, baseXp, curveExp));
  }
  const minutes = cumulativeMinutes(pacingModel(baseXp, curveExp, maxLevel));
  return {
    cumulativeXp,
    totalXp: cumulativeXp[maxLevel],
    hoursToMax: minutes[maxLevel] / 60,
  };
}

export interface CurveDeltaRow {
  level: number;
  snapXp: number;
  liveXp: number;
  diff: number;
  pct: number;
}

export interface CurveDelta {
  rows: CurveDeltaRow[];
  snapshot: CurveTotals;
  live: CurveTotals;
  /** Percent change of the cumulative XP to the cap. */
  totalPct: number;
  /** live.hoursToMax - snapshot.hoursToMax. */
  hoursDiff: number;
}

const pctChange = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : 0);

/** Compare a snapshot curve against the live one at COMPARISON_LEVELS and in total. */
export function curveDelta(snapshot: CurveParams, live: CurveParams): CurveDelta {
  const rows = COMPARISON_LEVELS.map((level) => {
    const snapXp = calculateXpForLevel(level, snapshot.baseXp, snapshot.curveExp);
    const liveXp = calculateXpForLevel(level, live.baseXp, live.curveExp);
    return { level, snapXp, liveXp, diff: liveXp - snapXp, pct: pctChange(snapXp, liveXp) };
  });
  const snapTotals = curveTotals(snapshot.baseXp, snapshot.curveExp);
  const liveTotals = curveTotals(live.baseXp, live.curveExp);
  return {
    rows,
    snapshot: snapTotals,
    live: liveTotals,
    totalPct: pctChange(snapTotals.totalXp, liveTotals.totalXp),
    hoursDiff: liveTotals.hoursToMax - snapTotals.hoursToMax,
  };
}

/** XP required per level for the Multi-Curve Overlay: x = 0, 5, …, cap (x = 0 plots level 1). */
export function xpOverlaySeries(baseXp: number, curveExp: number, maxLevel: number = MAX_LEVEL): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let x = 0; x <= maxLevel; x += 5) {
    points.push({ x, y: calculateXpForLevel(Math.max(x, 1), baseXp, curveExp) });
  }
  return points;
}
