import { describe, it, expect } from 'vitest';
import {
  scoreLoopClosure, parseLoopMetrics, critiqueLoop, DEFAULT_LOOP_THRESHOLDS,
  type LoopMetrics,
} from '@/lib/motion-gate';

/** A clean cycle: poses line up, nothing jumps. */
const CLEAN: LoopMetrics = {
  poseGapMm: 3.2, worstJointMm: 8.1, velJumpMm: 4.0, rootTravelMm: 2100, frames: 90,
};

function markers(over: Partial<Record<string, number | string>> = {}): string {
  const base: Record<string, number | string> = {
    POSE_GAP_MM: 3.2, WORST_JOINT_MM: 8.1, VEL_JUMP_MM: 4.0, ROOT_TRAVEL_MM: 2100, FRAMES: 90,
  };
  return Object.entries({ ...base, ...over })
    .map(([k, v]) => `POF_LOOP_${k}=${v}`)
    .join('\n');
}

describe('scoreLoopClosure', () => {
  it('passes a clip whose poses and velocity line up across the seam', () => {
    const card = scoreLoopClosure(CLEAN);
    expect(card.verdict).toBe('pass');
    expect(card.worstAxis).toBe('poseGap');
    expect(card.reason).toContain('Loops cleanly');
  });

  it('does not grade a one-shot clip — returns n/a, never a pass', () => {
    // A generated attack is not supposed to loop. Reporting `pass` here would be the
    // "unmeasured reads as verified" lie the gate exists to prevent.
    const card = scoreLoopClosure({ ...CLEAN, poseGapMm: 900, worstJointMm: 1400 }, 'oneshot');
    expect(card.verdict).toBe('n/a');
    expect(card.worstAxis).toBeNull();
    expect(card.reason).toContain('not measured');
  });

  it('fails on pose drift and names the axis that decided it', () => {
    const card = scoreLoopClosure({ ...CLEAN, poseGapMm: 120 });
    expect(card.verdict).toBe('fail');
    expect(card.worstAxis).toBe('poseGap');
    expect(card.reason).toContain('Does not loop');
    expect(card.reason).toContain('120.0 mm');
  });

  it('catches one limb out of place even when the RMS looks clean', () => {
    // The whole point of tracking worst-joint separately: an average over ~27 joints
    // dilutes a single hand being 15 cm out into a passing RMS.
    const card = scoreLoopClosure({ ...CLEAN, poseGapMm: 4.0, worstJointMm: 150 });
    expect(card.verdict).toBe('fail');
    expect(card.worstAxis).toBe('worstJoint');
    expect(card.reason).toContain('worst joint');
  });

  it('catches a velocity hitch when the poses match exactly', () => {
    // Pose-only checking (what the source video describes) would call this a perfect loop.
    const card = scoreLoopClosure({ ...CLEAN, poseGapMm: 0, worstJointMm: 0, velJumpMm: 90 });
    expect(card.verdict).toBe('fail');
    expect(card.worstAxis).toBe('velJump');
    expect(card.reason).toContain('jumps');
  });

  it('takes the WORST axis, not an average', () => {
    // Two passing axes must not rescue one failing axis.
    const card = scoreLoopClosure({ ...CLEAN, poseGapMm: 1, worstJointMm: 1, velJumpMm: 200 });
    expect(card.verdict).toBe('fail');
  });

  it('warns in the band between pass and fail', () => {
    const mid = (DEFAULT_LOOP_THRESHOLDS.poseGapPassMm + DEFAULT_LOOP_THRESHOLDS.poseGapWarnMm) / 2;
    const card = scoreLoopClosure({ ...CLEAN, poseGapMm: mid });
    expect(card.verdict).toBe('warn');
    expect(card.reason).toContain('Loop is rough');
  });

  it('never grades root travel — a travelling walk cycle still loops', () => {
    // Root-relative measurement is the reason a 5 m run cycle is gradable at all.
    const inPlace = scoreLoopClosure({ ...CLEAN, rootTravelMm: 0 });
    const travelling = scoreLoopClosure({ ...CLEAN, rootTravelMm: 8300 });
    expect(inPlace.verdict).toBe('pass');
    expect(travelling.verdict).toBe('pass');
  });

  it('honours caller thresholds', () => {
    const strict = scoreLoopClosure(CLEAN, 'loop', { poseGapPassMm: 1, poseGapWarnMm: 2 });
    expect(strict.verdict).toBe('fail');
  });
});

describe('parseLoopMetrics', () => {
  it('parses a marker block surrounded by log noise', () => {
    const out = ['loading npz...', markers(), 'done in 0.4s'].join('\n');
    const r = parseLoopMetrics(out);
    expect(r.ok).toBe(true);
    expect(r.metrics?.poseGapMm).toBeCloseTo(3.2);
    expect(r.metrics?.frames).toBe(90);
  });

  it('errors on a missing marker rather than defaulting it to zero', () => {
    // A defaulted 0 would read as a flawless loop — the exact failure this guards.
    const out = markers().split('\n').filter((l) => !l.includes('VEL_JUMP')).join('\n');
    const r = parseLoopMetrics(out);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('velJumpMm');
  });

  it('errors on a non-finite value', () => {
    const r = parseLoopMetrics(markers({ POSE_GAP_MM: 'nan' }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('POSE_GAP_MM');
  });

  it('ignores unknown POF_LOOP_ keys', () => {
    const r = parseLoopMetrics([markers(), 'POF_LOOP_FUTURE_METRIC=7'].join('\n'));
    expect(r.ok).toBe(true);
  });
});

describe('parseLoopMetrics against real extractor output', () => {
  // Captured verbatim from `python scripts/visual-gen/ardy/pof_loop_closure.py` on synthetic
  // 27-joint / 90-frame fixtures. Pinning the real stdout keeps the parser honest about the
  // script's actual formatting (4dp floats, integer frame count) rather than only about a
  // hand-written fixture that could drift from it.
  const CLEAN_OUT = [
    'POF_LOOP_POSE_GAP_MM=6.0411',
    'POF_LOOP_WORST_JOINT_MM=6.0411',
    'POF_LOOP_VEL_JUMP_MM=0.0294',
    'POF_LOOP_ROOT_TRAVEL_MM=8300.0000',
    'POF_LOOP_FRAMES=90',
  ].join('\n');

  const HITCH_OUT = [
    'POF_LOOP_POSE_GAP_MM=6.0411',
    'POF_LOOP_WORST_JOINT_MM=6.0411',
    'POF_LOOP_VEL_JUMP_MM=8393.2584',
    'POF_LOOP_ROOT_TRAVEL_MM=8300.0000',
    'POF_LOOP_FRAMES=90',
  ].join('\n');

  it('passes a real cycling clip that travels 8.3 m', () => {
    const r = critiqueLoop(CLEAN_OUT);
    expect(r.ok).toBe(true);
    expect(r.card?.verdict).toBe('pass');
  });

  it('fails the seam-hitch clip that a pose-only check calls perfect', () => {
    // Both fixtures have the SAME 6.0411 mm pose gap. Checking only "does the first frame
    // match the last" — the criterion the source video states — passes this clip.
    const pose = critiqueLoop(CLEAN_OUT).card!.metrics.poseGapMm;
    expect(critiqueLoop(HITCH_OUT).card!.metrics.poseGapMm).toBe(pose);

    const r = critiqueLoop(HITCH_OUT);
    expect(r.card?.verdict).toBe('fail');
    expect(r.card?.worstAxis).toBe('velJump');
  });
});

describe('critiqueLoop', () => {
  it('parses and scores in one call', () => {
    const r = critiqueLoop(markers());
    expect(r.ok).toBe(true);
    expect(r.card?.verdict).toBe('pass');
  });

  it('surfaces the extraction error verbatim instead of a verdict', () => {
    const r = critiqueLoop('nothing here');
    expect(r.ok).toBe(false);
    expect(r.card).toBeUndefined();
    expect(r.error).toContain('missing loop marker');
  });

  it('passes the one-shot intent through', () => {
    const r = critiqueLoop(markers({ POSE_GAP_MM: 500 }), 'oneshot');
    expect(r.card?.verdict).toBe('n/a');
  });
});
