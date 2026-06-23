/**
 * Animation critique scoring — pure, deterministic core (no model, no I/O).
 * Turns a VLM's per-dimension 0-100 scores into an overall verdict + score, the
 * fitness-function half of the aesthetic ruler. Sibling of visual-gen/mesh-critique's
 * `scoreMesh`, but for MOTION quality rather than mesh structure.
 */

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
  /** score >= passAt -> pass. */
  passAt: number;
  /** score >= warnAt (and < passAt) -> warn; below -> fail. */
  warnAt: number;
}

export const DEFAULT_THRESHOLDS: ScoreThresholds = { passAt: 70, warnAt: 45 };

export interface Scorecard {
  verdict: 'pass' | 'warn' | 'fail';
  score: number;
}

const DIMS: (keyof CritiqueDimensions)[] = [
  'anticipation', 'weight', 'timing', 'followThrough', 'silhouette', 'believability',
];

/** Average the dimensions into an overall 0-100 score + a pass/warn/fail verdict. Pure. */
export function scoreCard(dims: CritiqueDimensions, thresholds: Partial<ScoreThresholds> = {}): Scorecard {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const sum = DIMS.reduce((acc, k) => acc + dims[k], 0);
  const score = Math.round(sum / DIMS.length);
  const verdict = score >= t.passAt ? 'pass' : score >= t.warnAt ? 'warn' : 'fail';
  return { verdict, score };
}
