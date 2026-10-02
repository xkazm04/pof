// @vitest-environment node
/**
 * measureClip — Tier-1 loop closure measured from the clip's own bytes, in-process.
 *
 * The math is a port of `scripts/visual-gen/ardy/pof_loop_closure.py` (root-relative RMS
 * pose gap, worst joint, seam velocity jump, root travel), which stays as the offline
 * oracle. What changes is the transport: the gate reads the archive instead of a pasted
 * stdout transcript, and every verdict is bound to the sha256 of the bytes it measured.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { measureClip } from '@/lib/motion-gate';
import { resolveTier1, tier1Blocks } from '@/lib/anim-critique/tier1';
import { buildClipNpz, seamClip } from '@/__tests__/fixtures/npz';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

describe('measureClip: root-relative seam metrics from the archive', () => {
  it('90 frames x 27 joints, last frame 10 mm out on x -> 10 mm pose gap and worst joint', () => {
    const bytes = buildClipNpz({ ...seamClip(90, 27, 0.01), fps: 30 });
    const r = measureClip(bytes);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.metrics.poseGapMm).toBeCloseTo(10, 3);
    expect(r.data.metrics.worstJointMm).toBeCloseTo(10, 3);
    expect(r.data.metrics.frames).toBe(90);
    expect(r.data.metrics.rootTravelMm).toBeCloseTo(0, 3);
  });

  it('the SAME joints carried 8 m by the root -> 8000 mm travel, pose gap still 10 mm', () => {
    const bytes = buildClipNpz({ ...seamClip(90, 27, 0.01, 8), fps: 30 });
    const r = measureClip(bytes);
    if (!r.ok) throw new Error(r.error);
    expect(Math.abs(r.data.metrics.rootTravelMm - 8000)).toBeLessThanOrEqual(1e-3);
    expect(Math.abs(r.data.metrics.poseGapMm - 10)).toBeLessThanOrEqual(1e-3);
  });

  it('falls back to joint 0 as the root when root_positions is absent (as the extractor does)', () => {
    const { joints } = seamClip(10, 4, 0.02);
    const r = measureClip(buildClipNpz({ joints }));
    if (!r.ok) throw new Error(r.error);
    expect(r.data.metrics.frames).toBe(10);
  });
});

describe('measureClip: the extractor’s diagnoses, now in the gate path', () => {
  it('no posed_joints member -> names it and lists what the archive does have', () => {
    const { joints, root } = seamClip(10, 4, 0);
    const r = measureClip(buildClipNpz({ joints, root, omit: ['posed_joints'] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing member 'posed_joints' (have: root_positions,fps)");
  });

  it('2 frames -> need >=3 frames', () => {
    const r = measureClip(buildClipNpz(seamClip(2, 4, 0)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('need >=3 frames');
  });

  it("skeleton 'core-27' on a 24-joint archive -> the archive-contract mismatch", () => {
    const r = measureClip(buildClipNpz({ ...seamClip(10, 24, 0), skeleton: 'core-27' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('skeleton core-27 but 24 joints');
  });

  it('a matching skeleton and applied_ops travel on the source', () => {
    const bytes = buildClipNpz({ ...seamClip(10, 27, 0), skeleton: 'core-27', appliedOps: ['concat:reanchor-root-xz'] });
    const r = measureClip(bytes, { path: 'C:/m/montage.npz' });
    if (!r.ok) throw new Error(r.error);
    expect(r.data.source).toEqual({
      path: 'C:/m/montage.npz', sha256: sha(bytes), frames: 10, fps: 30,
      skeleton: 'core-27', appliedOps: ['concat:reanchor-root-xz'],
    });
  });
});

describe('resolveTier1 binds the verdict to the clip it measured', () => {
  it('a clip with a 141.8 mm seam -> fail on poseGap, source = measured + sha256 of the bytes', () => {
    const bytes = buildClipNpz({ ...seamClip(80, 27, 0.1418, 2.1), fps: 30 });
    const report = resolveTier1({ clip: { path: 'C:/m/walk.npz', bytes } });
    expect(report.status).toBe('fail');
    expect(report.card?.worstAxis).toBe('poseGap');
    expect(report.card?.metrics.poseGapMm).toBeCloseTo(141.8, 2);
    expect(report.source).toEqual({ kind: 'measured', path: 'C:/m/walk.npz', sha256: sha(bytes), frames: 80, fps: 30 });
    expect(tier1Blocks(report)).toBe(true);
  });

  it('caller-pasted markers are labelled as such — the unbound input is stated, not hidden', () => {
    const markers = ['POSE_GAP_MM=3.2', 'WORST_JOINT_MM=8.1', 'VEL_JUMP_MM=4', 'ROOT_TRAVEL_MM=2100', 'FRAMES=90']
      .map((l) => `POF_LOOP_${l}`).join('\n');
    const report = resolveTier1({ markers });
    expect(report.status).toBe('pass');
    expect(report.source?.kind).toBe('caller-markers');
  });

  it('an unreadable clip is an `error` with the reader’s own reason — never a pass, never not-run', () => {
    const bytes = Buffer.from('not an archive');
    const report = resolveTier1({ clip: { path: 'C:/m/broken.npz', bytes } });
    expect(report.status).toBe('error');
    expect(report.error).toMatch(/zip|central directory/i);
    expect(report.source).toEqual({ kind: 'unreadable-clip', path: 'C:/m/broken.npz', sha256: sha(bytes) });
    expect(tier1Blocks(report)).toBe(false);
  });

  it('a one-shot clip is measured and graded n/a, still bound to its bytes', () => {
    const bytes = buildClipNpz(seamClip(20, 27, 0.5));
    const report = resolveTier1({ clip: { bytes }, intent: 'oneshot' });
    expect(report.status).toBe('n/a');
    expect(report.source?.kind).toBe('measured');
  });
});
