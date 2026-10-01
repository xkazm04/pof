/**
 * Loop remedy map — routes a Tier-1 loop failure to the fix that was MEASURED to address it.
 *
 * The motion sibling of the mesh gate's `FINISH_RESOLVES` / `REROLL_RESOLVES`
 * (`@/lib/visual-gen/critique-stage`): remedy -> defect classes as data, built only from
 * measured before/after pairs, with the measured traps kept as anti-entries and every defect
 * no remedy names returned in `unaddressed` (ai-registry
 * `game-production/regeneration-vs-repair-economics#defect-class-to-remedy-map`).
 *
 * The one remedy is the recipe proven end to end on 2026-08-19
 * (docs/research/motion-constraint-fix-path-spec.md): regenerate THIS clip — same prompt,
 * same seed — with frame 0's pose pinned at BOTH endpoints plus ONE velocity-matched frame
 * at T-2. Seed-1 walk: fail 141.8 mm -> poseGap 0.0001 mm, velJump 15.73 mm = `warn`. The
 * plan states that honest partial cure; it never promises a pass. Pure.
 */
import { DEFAULT_LOOP_THRESHOLDS, type LoopScorecard } from './loopClosure';

export type LoopAxis = 'poseGap' | 'worstJoint' | 'velJump';

export interface LoopAntiEntry {
  id: string;
  /** The measured before -> after that rules it out. */
  measured: string;
  why: string;
}

export interface LoopRemedyEntry {
  remedy: 'seam-pin';
  /** Axes measured to land inside their pass band after the remedy. */
  cures: LoopAxis[];
  /** Axes measured to improve but NOT reach pass. */
  partial: LoopAxis[];
  /** The verdict the measured run reached — what a plan may promise, no more. */
  expected: 'warn';
  expectedAxis: LoopAxis;
  measured: string;
  antiEntries: LoopAntiEntry[];
}

export type LoopRemedyTable = readonly LoopRemedyEntry[];

export const LOOP_REMEDIES: LoopRemedyTable = [
  {
    remedy: 'seam-pin',
    cures: ['poseGap', 'worstJoint'],
    partial: ['velJump'],
    expected: 'warn',
    expectedAxis: 'velJump',
    measured:
      'seed-1 walk, 80 frames: poseGap 141.80 -> 0.0001 mm, worstJoint 381.01 -> 0.0002 mm, '
      + 'velJump 25.94 -> 15.73 mm (pass band 15 mm)',
    antiEntries: [
      {
        id: 'pin-last-only',
        measured: 'poseGap 141.8 -> 153.5 mm',
        why: 'the pin lands, but regeneration moves the new first frame, so the seam opens at the other end',
      },
      {
        id: 'raise cfg_weight constraint component',
        measured: 'velJump 15.73 -> 15.85 -> 18.39 mm (cfg 2 -> 4 -> 8)',
        why: 'the pin is already exact; extra weight only bends the surrounding motion',
      },
    ],
  },
];

export interface LoopRemedyContext {
  frames: number;
  seed?: number;
  prompt: string;
}

export interface SeamPins {
  /** Frames pinned to the seam pose (frame 0's): always BOTH endpoints. */
  fullbody: number[];
  /** Velocity-matched frames: the seam pose stepped back by the frame 0->1 delta. */
  velocity: number[];
}

export type LoopRemedyPlan =
  | {
      remedy: 'seam-pin';
      pins: SeamPins;
      expected: 'warn';
      expectedAxis: LoopAxis;
      seed: number;
      prompt: string;
      frames: number;
      reason: string;
      unaddressed: LoopAxis[];
    }
  | { remedy: 'none'; reason: string; unaddressed: LoopAxis[] };

/** Axes outside their pass band — every defect, not only the worst one. */
function defects(card: LoopScorecard): LoopAxis[] {
  const t = DEFAULT_LOOP_THRESHOLDS;
  const m = card.metrics;
  const out: LoopAxis[] = [];
  if (m.poseGapMm > t.poseGapPassMm) out.push('poseGap');
  if (m.worstJointMm > t.worstJointPassMm) out.push('worstJoint');
  if (m.velJumpMm > t.velJumpPassMm) out.push('velJump');
  if (out.length === 0 && card.worstAxis && card.verdict !== 'pass') out.push(card.worstAxis);
  return out;
}

/** Route a scorecard to its measured remedy, or to `none` with the reason. Pure. */
export function routeLoopRemedy(
  card: LoopScorecard,
  ctx: LoopRemedyContext,
  table: LoopRemedyTable = LOOP_REMEDIES,
): LoopRemedyPlan {
  const none = (reason: string, unaddressed: LoopAxis[] = []): LoopRemedyPlan => ({ remedy: 'none', reason, unaddressed });
  if (card.verdict === 'n/a') return none('one-shot clip — loop closure is not graded, so there is nothing to fix');
  if (card.verdict === 'pass') return none('already loops — no remedy needed');

  const found = defects(card);
  const unaddressed = found.filter((a) => !table.some((r) => r.cures.includes(a) || r.partial.includes(a)));
  const entry = table.find((r) => found.some((a) => r.cures.includes(a)));
  if (!entry) {
    const partialOnly = found.length > 0 && unaddressed.length === 0;
    return none(
      partialOnly
        ? `only ${found.join(', ')} is off, and the measured remedy is a partial cure for it (still warn) — re-taking buys nothing proven`
        : `no measured remedy for ${unaddressed.join(', ') || 'this defect'}`,
      unaddressed,
    );
  }
  if (ctx.seed === undefined) {
    return none('seed unknown — a pinned regeneration without the original seed is a re-roll, not a correction of THIS clip', unaddressed);
  }
  if (!ctx.prompt.trim()) return none('prompt unknown — the re-take must use the original prompt', unaddressed);
  if (!Number.isInteger(ctx.frames) || ctx.frames < 4) {
    return none(`need >= 4 frames to place the seam pins, got ${ctx.frames}`, unaddressed);
  }

  const last = ctx.frames - 1;
  return {
    remedy: entry.remedy,
    pins: { fullbody: [0, last], velocity: [last - 1] },
    expected: entry.expected,
    expectedAxis: entry.expectedAxis,
    seed: ctx.seed,
    prompt: ctx.prompt,
    frames: ctx.frames,
    reason:
      `${entry.remedy}: pin frame 0's pose at 0 and ${last} + velocity frame ${last - 1}, seed ${ctx.seed}; `
      + `measured to reach ${entry.expected} (${entry.expectedAxis}), not pass — ${entry.measured}`,
    unaddressed,
  };
}
