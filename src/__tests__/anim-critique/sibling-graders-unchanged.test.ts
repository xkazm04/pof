/**
 * Guard: moving anim-critique's `scoreCard` to worst-of aggregation must not disturb the
 * two sibling graders it shares a convention with — visual-gen's `scoreMesh` (structure)
 * and motion-gate's `scoreLoopClosure` (loop closure, already worst-of via `worstAxis`).
 * These pin their behaviour from OUTSIDE their own suites, so a future edit to the shared
 * grading vocabulary cannot quietly re-band them.
 */
import { describe, it, expect } from 'vitest';
import { scoreMesh, type MeshMetrics } from '@/lib/visual-gen/mesh-critique';
import { scoreLoopClosure, type LoopMetrics } from '@/lib/motion-gate/loopClosure';
import { scoreCard } from '@/lib/anim-critique/score';

const CLEAN_MESH: MeshMetrics = {
  verts: 42000, faces: 84000, watertight: true, windingConsistent: true,
  components: 1, euler: 2, bbox: [1, 1.2, 0.9], volume: 0.5, area: 3.2, degenerateFaces: 0,
};

describe('sibling graders are unchanged by the anim-critique verdict floor', () => {
  it('scoreMesh still passes a clean mesh and reports no findings', () => {
    const r = scoreMesh(CLEAN_MESH);
    expect(r.verdict).toBe('pass');
    expect(r.findings.filter((f) => f.severity === 'fail')).toHaveLength(0);
  });

  it('scoreMesh still fails a degenerate mesh', () => {
    const r = scoreMesh({ ...CLEAN_MESH, verts: 0, faces: 0 });
    expect(r.verdict).toBe('fail');
  });

  it('scoreLoopClosure still grades worst-of and names the worst axis', () => {
    const tight: LoopMetrics = { poseGapMm: 3.2, worstJointMm: 8.1, velJumpMm: 4.0, rootTravelMm: 2100, frames: 90 };
    expect(scoreLoopClosure(tight).verdict).toBe('pass');

    const hitching: LoopMetrics = { poseGapMm: 0, worstJointMm: 0, velJumpMm: 90, rootTravelMm: 2100, frames: 90 };
    const bad = scoreLoopClosure(hitching);
    expect(bad.verdict).toBe('fail');
    expect(bad.worstAxis).toBe('velJump');
  });

  it('scoreLoopClosure still reports a one-shot clip as n/a, not a pass', () => {
    const r = scoreLoopClosure({ poseGapMm: 900, worstJointMm: 1400, velJumpMm: 900, rootTravelMm: 0, frames: 90 }, 'oneshot');
    expect(r.verdict).toBe('n/a');
    expect(r.worstAxis).toBeNull();
  });

  it('anim-critique now speaks the same worst-of vocabulary as its siblings', () => {
    const r = scoreCard({
      anticipation: 90, weight: 90, timing: 90, followThrough: 90, silhouette: 90, believability: 10,
    });
    expect(r.verdict).toBe('fail');
    expect(r.worstDimension).toBe('believability');
  });
});
