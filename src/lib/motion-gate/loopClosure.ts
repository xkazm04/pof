/**
 * Loop-closure gate — pure, deterministic Tier-1 motion check (no model, no I/O).
 *
 * A generated locomotion clip is only usable in a Blend Space if it LOOPS: the pose at
 * the last frame must line up with the pose at the first, and the motion must not jump
 * across the seam. Nothing in PoF asserted that — `anim-critique/` judges six aesthetic
 * dimensions with a VLM (anticipation, weight, timing, followThrough, silhouette,
 * believability) and none of them is a numeric loop check, so a clip that visibly hitches
 * every cycle could still score `pass`.
 *
 * This is the numeric sibling of `anim-critique/scoreCard`, in the same relationship that
 * `visual-gen/mesh-critique`'s geometry metrics have to the VLM mesh critique: cheap, exact,
 * and run BEFORE the expensive aesthetic tier. Marker extraction lives in
 * `scripts/visual-gen/ardy/pof_loop_closure.py`; this file is the pure half.
 *
 * Two honesty rules are load-bearing:
 *  - Measurements are ROOT-RELATIVE. A root-motion clip (a walk that travels 2 m) loops
 *    perfectly well; judging it on absolute joint positions would fail every travelling
 *    clip. Root travel is reported for context and never graded.
 *  - A clip that was never meant to loop (a one-shot attack) returns `n/a`, not `pass`.
 *    An unmeasured verdict must never read as a passed one.
 */

/** Root-relative seam measurements, in millimetres. Extracted from the motion data. */
export interface LoopMetrics {
  /** RMS distance between frame 0 and the last frame, over all joints, root-relative. */
  poseGapMm: number;
  /** Worst single-joint distance for that same frame pair. Catches "everything lines up
   *  except the sword arm" — an RMS average hides one limb being far out. */
  worstJointMm: number;
  /** Seam velocity discontinuity: |(pose[1] - pose[0]) - (pose[last] - pose[last-1])|,
   *  RMS over joints. Low means the motion flows through the wrap instead of hitching.
   *  Poses can match exactly while the clip still stutters, so this is a separate axis. */
  velJumpMm: number;
  /** Distance the root travelled from the first frame to the last. Context only, never
   *  graded — it distinguishes an in-place clip from a travelling one. */
  rootTravelMm: number;
  /** Frame count, for reporting. */
  frames: number;
}

export interface LoopThresholds {
  /** poseGapMm <= passAt (and the other two within their pass bands) -> pass. */
  poseGapPassMm: number;
  /** poseGapMm <= warnAt -> warn; above -> fail. */
  poseGapWarnMm: number;
  /** Worst-joint allowance. A single limb may sit further out than the RMS. */
  worstJointPassMm: number;
  worstJointWarnMm: number;
  /** Seam velocity allowance. */
  velJumpPassMm: number;
  velJumpWarnMm: number;
}

/**
 * Defaults in millimetres on a human-scale skeleton (~1.8 m). 10 mm of RMS pose drift is
 * invisible at 30 fps; 40 mm reads as a small pop. The worst-joint bands are wider than the
 * RMS bands because one extremity (a hand, a weapon-holding wrist) is allowed to be the
 * outlier without condemning the clip.
 */
export const DEFAULT_LOOP_THRESHOLDS: LoopThresholds = {
  poseGapPassMm: 10,
  poseGapWarnMm: 40,
  worstJointPassMm: 25,
  worstJointWarnMm: 80,
  velJumpPassMm: 15,
  velJumpWarnMm: 50,
};

/** Whether the clip was authored to loop. A one-shot is not graded on loop closure. */
export type LoopIntent = 'loop' | 'oneshot';

export type LoopVerdict = 'pass' | 'warn' | 'fail' | 'n/a';

export interface LoopScorecard {
  verdict: LoopVerdict;
  /** The axis that set the verdict — so a failure names its own cause. Null when `n/a`. */
  worstAxis: 'poseGap' | 'worstJoint' | 'velJump' | null;
  /** Human-readable one-liner naming the measurement that decided it. */
  reason: string;
  metrics: LoopMetrics;
}

type Band = { pass: number; warn: number };

/** Grade one axis. Narrower than LoopVerdict: an axis is never `n/a` — only a whole
 *  clip can be un-gradable, and that is decided before any axis is measured. */
function band(value: number, b: Band): GradedVerdict {
  if (value <= b.pass) return 'pass';
  if (value <= b.warn) return 'warn';
  return 'fail';
}

type GradedVerdict = Exclude<LoopVerdict, 'n/a'>;

const RANK: Record<GradedVerdict, number> = { pass: 0, warn: 1, fail: 2 };

function mm(value: number): string {
  return `${value.toFixed(1)} mm`;
}

/**
 * Grade a clip's loop closure. Pure.
 *
 * The verdict is the WORST of the three axes — a clip whose poses match perfectly but whose
 * velocity jumps still hitches on every cycle, so an average would hide the defect.
 */
export function scoreLoopClosure(
  metrics: LoopMetrics,
  intent: LoopIntent = 'loop',
  thresholds: Partial<LoopThresholds> = {},
): LoopScorecard {
  if (intent === 'oneshot') {
    return {
      verdict: 'n/a',
      worstAxis: null,
      reason: 'One-shot clip — loop closure not applicable (not measured, not a pass).',
      metrics,
    };
  }

  const t = { ...DEFAULT_LOOP_THRESHOLDS, ...thresholds };
  const axes = [
    {
      key: 'poseGap' as const,
      value: metrics.poseGapMm,
      verdict: band(metrics.poseGapMm, { pass: t.poseGapPassMm, warn: t.poseGapWarnMm }),
      label: (v: number) => `first/last pose differ by ${mm(v)} RMS`,
    },
    {
      key: 'worstJoint' as const,
      value: metrics.worstJointMm,
      verdict: band(metrics.worstJointMm, { pass: t.worstJointPassMm, warn: t.worstJointWarnMm }),
      label: (v: number) => `worst joint is ${mm(v)} out at the seam`,
    },
    {
      key: 'velJump' as const,
      value: metrics.velJumpMm,
      verdict: band(metrics.velJumpMm, { pass: t.velJumpPassMm, warn: t.velJumpWarnMm }),
      label: (v: number) => `motion jumps ${mm(v)} across the seam`,
    },
  ];

  let worst = axes[0];
  for (const a of axes) {
    if (RANK[a.verdict] > RANK[worst.verdict]) worst = a;
  }

  const reason =
    worst.verdict === 'pass'
      ? `Loops cleanly — ${axes.map((a) => a.label(a.value)).join('; ')}.`
      : `${worst.verdict === 'fail' ? 'Does not loop' : 'Loop is rough'} — ${worst.label(worst.value)}.`;

  return { verdict: worst.verdict, worstAxis: worst.key, reason, metrics };
}

/** Marker prefix written by `scripts/visual-gen/ardy/pof_loop_closure.py`. */
const MARKER = 'POF_LOOP_';

export interface ParsedLoopMetrics {
  ok: boolean;
  metrics?: LoopMetrics;
  error?: string;
}

const NUMERIC_KEYS: Record<string, keyof LoopMetrics> = {
  POSE_GAP_MM: 'poseGapMm',
  WORST_JOINT_MM: 'worstJointMm',
  VEL_JUMP_MM: 'velJumpMm',
  ROOT_TRAVEL_MM: 'rootTravelMm',
  FRAMES: 'frames',
};

/**
 * Parse the extractor's marker block out of a script's stdout. Mirrors
 * `mesh-critique.parseCritiqueMetrics`: tolerant of surrounding log noise, strict about
 * completeness — a missing marker is an error, never a silent zero, because a zero here
 * would read as a perfect loop.
 */
export function parseLoopMetrics(stdout: string): ParsedLoopMetrics {
  const found = new Map<keyof LoopMetrics, number>();

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith(MARKER)) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(MARKER.length, eq);
    const raw = line.slice(eq + 1).trim();
    const field = NUMERIC_KEYS[key];
    if (!field) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return { ok: false, error: `${MARKER}${key} is not a finite number: "${raw}"` };
    }
    found.set(field, value);
  }

  const missing = Object.values(NUMERIC_KEYS).filter((f) => !found.has(f));
  if (missing.length > 0) {
    return { ok: false, error: `missing loop marker(s): ${missing.join(', ')}` };
  }

  return {
    ok: true,
    metrics: {
      poseGapMm: found.get('poseGapMm')!,
      worstJointMm: found.get('worstJointMm')!,
      velJumpMm: found.get('velJumpMm')!,
      rootTravelMm: found.get('rootTravelMm')!,
      frames: found.get('frames')!,
    },
  };
}

/** Parse + score in one call. Returns the parse error verbatim when extraction failed. */
export function critiqueLoop(
  stdout: string,
  intent: LoopIntent = 'loop',
  thresholds: Partial<LoopThresholds> = {},
): { ok: boolean; error?: string; card?: LoopScorecard } {
  const parsed = parseLoopMetrics(stdout);
  if (!parsed.ok || !parsed.metrics) return { ok: false, error: parsed.error };
  return { ok: true, card: scoreLoopClosure(parsed.metrics, intent, thresholds) };
}
