/**
 * Tune by pace: fit the Curves-tab XP curve to milestone-hour targets.
 *
 * Designers state pace ("L10 by hour 1, the cap by hour 20"); this inverts
 * those targets into a (baseXp, curveExp) pair the sliders can actually hold.
 * Hours come from the ONE pacing clock (`rewardPacing.cumulativeMinutes`, the
 * Rewards tab's "Hours to max"), never a private rate.
 *
 * The search is exhaustive over the slider lattice (BASE_XP_RANGE x
 * CURVE_EXP_RANGE = 46 x 29 = 1334 settings) and minimises
 * sum(ln(achieved / target)^2), ties going to the lower base, then the lower
 * exponent. The verdict is honest about what the best point means:
 *   - 'fit'   every target is met within FIT_TOLERANCE_PCT
 *   - 'range' the best point sits on a slider bound (`limitedBy` names it):
 *             the targets want a value past the slider
 *   - 'shape' the best point is interior and still misses: no curve of this
 *             family meets the targets; change the targets or the formula,
 *             do not tune.
 *
 * Also hosts `curveTuningReducer`, the Curves tab's live / snapshot / compare
 * state with explicit preview, apply and revert. DOM-free for unit tests.
 */
import { err, ok, type Result } from '@/types/result';
import { BASE_XP_RANGE, CURVE_EXP_RANGE, MAX_LEVEL } from './data';
import type { CurveParams } from './curveModel';
import { cumulativeMinutes, pacingModel } from './rewardPacing';

export interface PaceTarget {
  level: number;
  hours: number;
}

export interface PaceResidual {
  level: number;
  targetHours: number;
  /** Hours to clear `level` on the Rewards-tab clock: cumulativeMinutes[level] / 60. */
  achievedHours: number;
  /** 100 * (achieved - target) / target; positive = slower than the target. */
  errPct: number;
}

export type FitVerdict = 'fit' | 'range' | 'shape';
export type FitBound = 'baseXp.min' | 'baseXp.max' | 'curveExp.min' | 'curveExp.max';

export interface CurveFit extends CurveParams {
  /** One per target, in input order. */
  residuals: PaceResidual[];
  /** The residual with the largest |errPct|. */
  worst: PaceResidual;
  verdict: FitVerdict;
  /** Slider bounds the best point sits on (empty when interior). */
  limitedBy: FitBound[];
}

/** A fit is a fit when every target is met within this many percent. */
export const FIT_TOLERANCE_PCT = 10;

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Every reachable value of a slider, min..max on its step. */
function sliderValues(range: { min: number; max: number; step: number }): number[] {
  const n = Math.round((range.max - range.min) / range.step);
  return Array.from({ length: n + 1 }, (_, k) => round2(range.min + k * range.step));
}

function residualsFor(targets: readonly PaceTarget[], baseXp: number, curveExp: number): PaceResidual[] {
  const cum = cumulativeMinutes(pacingModel(baseXp, curveExp));
  return targets.map(({ level, hours }) => {
    const achievedHours = cum[level] / 60;
    return { level, targetHours: hours, achievedHours, errPct: (100 * (achievedHours - hours)) / hours };
  });
}

/** Hours to clear `level` under `params` on the Rewards-tab clock. */
export function hoursToLevel(params: CurveParams, level: number): number {
  return cumulativeMinutes(pacingModel(params.baseXp, params.curveExp))[level] / 60;
}

function boundsHit(baseXp: number, curveExp: number): FitBound[] {
  const hit: FitBound[] = [];
  if (baseXp === BASE_XP_RANGE.min) hit.push('baseXp.min');
  if (baseXp === BASE_XP_RANGE.max) hit.push('baseXp.max');
  if (curveExp === CURVE_EXP_RANGE.min) hit.push('curveExp.min');
  if (curveExp === CURVE_EXP_RANGE.max) hit.push('curveExp.max');
  return hit;
}

/** Fit (baseXp, curveExp) to valid targets (see `parsePaceTargets`). Throws on an empty or invalid set. */
export function fitCurveToTargets(targets: readonly PaceTarget[]): CurveFit {
  if (targets.length === 0) throw new RangeError('fitCurveToTargets needs at least one target');
  for (const t of targets) {
    if (!Number.isInteger(t.level) || t.level < 1 || t.level > MAX_LEVEL || !(t.hours > 0) || !Number.isFinite(t.hours)) {
      throw new RangeError(`invalid pace target L${t.level} = ${t.hours}h`);
    }
  }
  let best: CurveParams & { cost: number } = { baseXp: BASE_XP_RANGE.min, curveExp: CURVE_EXP_RANGE.min, cost: Infinity };
  const exps = sliderValues(CURVE_EXP_RANGE);
  for (const baseXp of sliderValues(BASE_XP_RANGE)) {
    for (const curveExp of exps) {
      const cum = cumulativeMinutes(pacingModel(baseXp, curveExp));
      let cost = 0;
      for (const t of targets) cost += Math.log(cum[t.level] / 60 / t.hours) ** 2;
      if (cost < best.cost) best = { baseXp, curveExp, cost };
    }
  }
  const residuals = residualsFor(targets, best.baseXp, best.curveExp);
  const worst = residuals.reduce((w, r) => (Math.abs(r.errPct) > Math.abs(w.errPct) ? r : w));
  const limitedBy = boundsHit(best.baseXp, best.curveExp);
  const verdict: FitVerdict = Math.abs(worst.errPct) <= FIT_TOLERANCE_PCT
    ? 'fit'
    : limitedBy.length > 0 ? 'range' : 'shape';
  return { baseXp: best.baseXp, curveExp: best.curveExp, residuals, worst, verdict, limitedBy };
}

/** Text rows from the panel -> validated targets, or the first reason they cannot be fitted. */
export function parsePaceTargets(rows: readonly { level: string; hours: string }[]): Result<PaceTarget[]> {
  if (rows.length === 0) return err('Add at least one target.');
  const seen = new Set<number>();
  const targets: PaceTarget[] = [];
  for (const row of rows) {
    const level = Number(row.level);
    const hours = Number(row.hours);
    if (row.level.trim() === '' || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
      return err(`Level "${row.level}" must be a whole number from 1 to ${MAX_LEVEL}.`);
    }
    if (row.hours.trim() === '' || !Number.isFinite(hours) || hours <= 0) {
      return err(`L${level}: hours must be a number above 0.`);
    }
    if (seen.has(level)) return err(`L${level} has two targets; keep one.`);
    seen.add(level);
    targets.push({ level, hours });
  }
  return ok(targets);
}

/* -- Curve tuning state: live / snapshot / compare + preview, apply, revert -- */

export interface CurveTuningState {
  live: CurveParams;
  snapshot: CurveParams;
  compareMode: boolean;
  /** A fit is on screen against `snapshot` (the pre-fit curve) awaiting Apply / Revert. */
  previewing: boolean;
}

export type CurveTuningAction =
  | { type: 'setLive'; params: Partial<CurveParams> }
  | { type: 'toggleCompare' }
  | { type: 'previewFit'; params: CurveParams }
  | { type: 'apply' }
  | { type: 'revert' };

export function initialCurveTuning(params: CurveParams): CurveTuningState {
  return { live: { ...params }, snapshot: { ...params }, compareMode: false, previewing: false };
}

export function curveTuningReducer(state: CurveTuningState, action: CurveTuningAction): CurveTuningState {
  switch (action.type) {
    case 'setLive':
      return { ...state, live: { ...state.live, ...action.params } };
    case 'toggleCompare':
      // A previewed fit leaves only through Apply or Revert, never a silent toggle.
      if (state.previewing) return state;
      return state.compareMode
        ? { ...state, compareMode: false }
        : { ...state, compareMode: true, snapshot: { ...state.live } };
    case 'previewFit':
      return {
        live: { ...action.params },
        // A re-fit during a preview keeps the original pre-fit curve to revert to.
        snapshot: state.previewing ? state.snapshot : { ...state.live },
        compareMode: true,
        previewing: true,
      };
    case 'apply':
      return state.previewing ? { ...state, compareMode: false, previewing: false } : state;
    case 'revert':
      return state.previewing
        ? { ...state, live: { ...state.snapshot }, compareMode: false, previewing: false }
        : state;
  }
}
