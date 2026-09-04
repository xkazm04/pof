/**
 * Animation critique scoring — pure, deterministic core (no model, no I/O).
 * Turns a VLM's per-dimension 0-100 scores into an overall verdict + score, the
 * fitness-function half of the aesthetic ruler. Sibling of visual-gen/mesh-critique's
 * `scoreMesh`, but for MOTION quality rather than mesh structure.
 *
 * AGGREGATION: the verdict is the WORST dimension's band, never the mean — the
 * "three questions, and they do not average" rule (ai-registry
 * game-production/motion-quality-gating). A single broken dimension caps the asset,
 * and the card NAMES it (`worstDimension`), exactly as motion-gate's
 * `scoreLoopClosure` reports its `worstAxis`.
 */
import { BANDS } from '@/lib/judge/rubrics';

/** The six dimensions a combat/locomotion motion is judged on (each 0-100). */
export interface CritiqueDimensions {
  /** Windup / preparation before the action. */
  anticipation: number;
  /** Sense of mass and force behind the motion. */
  weight: number;
  /** Slow-in/slow-out spacing; the strike snaps, the recovery settles. */
  timing: number;
  /** Overshoot + settle after the peak (not a dead stop). */
  followThrough: number;
  /** Pose readability — a clear silhouette at the key moments. */
  silhouette: number;
  /** Overall: does it read as a real, trained motion (vs stiff/robotic)? */
  believability: number;
}

export interface ScoreThresholds {
  /** dimension >= passAt -> that dimension passes. */
  passAt: number;
  /** dimension >= warnAt (and < passAt) -> warn; below -> fail. */
  warnAt: number;
}

/**
 * The bands this ruler grades against. `passAt` is `BANDS.placeholder` — the same 70
 * line the whole program uses — so there is no third private threshold set here.
 *
 * DIVERGENCE FROM THE STRICT JUDGE, stated deliberately: the judge's pass line is
 * `BANDS.shippable` (90) because it answers "would this ship as-is?", and it is binary.
 * This ruler is the autonomous loop's three-band gate — it must distinguish "keep
 * iterating" (warn) from "throw it away" (fail) — and the critique prompt's own 0-100
 * scale defines 70 as "acceptable for ship", so re-banding at 90 would contradict the
 * scale the model was given. `warnAt` (45) has no BANDS counterpart because BANDS has
 * no warn band; it is the prompt's "50 = amateur/placeholder" line rounded down.
 */
export const DEFAULT_THRESHOLDS: ScoreThresholds = { passAt: BANDS.placeholder, warnAt: 45 };

export type AnimVerdict = 'pass' | 'warn' | 'fail';

export interface Scorecard {
  /** The band of the WORST dimension. Never derived from `score`. */
  verdict: AnimVerdict;
  /**
   * The MEAN of the six dimensions, kept for trend telemetry and display.
   * It is NOT the verdict and must never be re-banded by a consumer: a card can
   * legitimately read `fail` at score 77 when one dimension is broken.
   */
  score: number;
  /** The dimension that capped the verdict (the lowest-scoring one). */
  worstDimension: keyof CritiqueDimensions;
  /** That dimension's 0-100 score. */
  worstScore: number;
  /** One sentence naming the capping dimension and the line it missed. */
  reason: string;
}

const DIMS: (keyof CritiqueDimensions)[] = [
  'anticipation', 'weight', 'timing', 'followThrough', 'silhouette', 'believability',
];

/** Band one 0-100 dimension. Pure. */
function band(value: number, t: ScoreThresholds): AnimVerdict {
  if (value >= t.passAt) return 'pass';
  if (value >= t.warnAt) return 'warn';
  return 'fail';
}

/**
 * Grade a critique's six dimensions. Pure.
 *
 * The verdict is the WORST dimension's band — a motion with perfect timing, weight and
 * silhouette that does not READ as believable is not shippable, and an average would
 * hide exactly that. `score` remains the mean, for trend only.
 */
export function scoreCard(dims: CritiqueDimensions, thresholds: Partial<ScoreThresholds> = {}): Scorecard {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const sum = DIMS.reduce((acc, k) => acc + dims[k], 0);
  const score = Math.round(sum / DIMS.length);

  let worstDimension = DIMS[0];
  for (const k of DIMS) {
    if (dims[k] < dims[worstDimension]) worstDimension = k;
  }
  const worstScore = dims[worstDimension];
  const verdict = band(worstScore, t);
  const reason =
    verdict === 'pass'
      ? `all six dimensions clear the ${t.passAt} pass line (weakest: ${worstDimension} at ${worstScore}; mean ${score}).`
      : `${verdict} — capped by ${worstDimension} at ${worstScore}/100 (below the ${verdict === 'fail' ? t.warnAt : t.passAt} line); the mean of ${score} does not lift it, a single broken dimension caps the asset.`;

  return { verdict, score, worstDimension, worstScore, reason };
}
