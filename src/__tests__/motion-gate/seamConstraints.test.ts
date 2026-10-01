// @vitest-environment node
/**
 * seamConstraints — the ARDY constraint file for the loop fix, built in-process from the
 * clip's own `.npz` (no python): frame 0's `local_rot_mats` as AXIS-ANGLE pinned at BOTH
 * endpoints with the clip's own root positions, plus the velocity-matched frame T-2 (the
 * seam pose stepped back by the frame 0->1 per-joint rotation delta).
 *
 * The schema is ARDY's `FullBodyConstraintSet.from_dict` shape, not its constructor's
 * (docs/research/motion-constraint-fix-path-spec.md "the trap"): `local_joints_rot` is
 * axis-angle and there is NO global-positions key — ARDY derives the globals by FK.
 */
import { describe, it, expect } from 'vitest';
import { buildNpz, type NpyMember } from '@/__tests__/fixtures/npz';
import {
  buildSeamConstraintArgs,
  buildSeamConstraints,
  parseSeamConstraintArgs,
  rotationMatrixToAxisAngle,
} from '@/lib/motion-gate/seamConstraints';

const DEG = Math.PI / 180;
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const rz = (deg: number) => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};

/** Rodrigues: axis-angle -> row-major 3x3. Independent of the code under test. */
function rodrigues(v: number[]): number[] {
  const th = Math.hypot(v[0], v[1], v[2]);
  if (th === 0) return [...I3];
  const [x, y, z] = v.map((n) => n / th);
  const c = Math.cos(th);
  const s = Math.sin(th);
  const C = 1 - c;
  return [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C,
  ];
}

/** 80 frames x 3 joints: joint 1 is Rz(90) at frame 0 and Rz(100) at frame 1, every other
 *  joint/frame identity except a Rz(30) mid-clip; the root travels 70 mm/frame along x. */
function clip(T = 80, omit: string[] = []): Uint8Array {
  const rots: number[] = [];
  const root: number[] = [];
  for (let t = 0; t < T; t++) {
    const j1 = t === 0 ? rz(90) : t === 1 ? rz(100) : rz(30);
    rots.push(...I3, ...j1, ...I3);
    root.push(0.07 * t, 0.9, 0.25);
  }
  const members: NpyMember[] = [
    { name: 'local_rot_mats', descr: '<f4', shape: [T, 3, 3, 3], values: rots },
    { name: 'root_positions', descr: '<f4', shape: [T, 3], values: root },
    { name: 'fps', descr: '<i8', shape: [], values: [20] },
  ];
  return buildNpz(members.filter((m) => !omit.includes(m.name)));
}

const f32 = (n: number) => Math.fround(n);

describe('rotationMatrixToAxisAngle', () => {
  it('identity -> [0,0,0]; Rz(90) -> [0,0,pi/2]', () => {
    expect(rotationMatrixToAxisAngle(I3)).toEqual([0, 0, 0]);
    const v = rotationMatrixToAxisAngle(rz(90));
    expect(v[0]).toBeCloseTo(0, 6);
    expect(v[1]).toBeCloseTo(0, 6);
    expect(v[2]).toBeCloseTo(Math.PI / 2, 6);
  });

  it('a half turn about x keeps its axis and angle (the trace formula is singular there)', () => {
    const v = rotationMatrixToAxisAngle([1, 0, 0, 0, -1, 0, 0, 0, -1]);
    expect(Math.abs(v[0])).toBeCloseTo(Math.PI, 6);
    expect(v[1]).toBeCloseTo(0, 6);
    expect(v[2]).toBeCloseTo(0, 6);
  });

  it('round-trips an arbitrary rotation through Rodrigues', () => {
    const v0 = [0.3, -1.1, 0.7];
    const v = rotationMatrixToAxisAngle(rodrigues(v0));
    v.forEach((n, i) => expect(n).toBeCloseTo(v0[i], 9));
  });
});

describe('buildSeamConstraints: the measured recipe as an ARDY constraint list', () => {
  it('pins frame 0 pose (axis-angle) at [0,T-1] with the clip own root positions; no global positions', () => {
    const r = buildSeamConstraints(clip(), { fullbody: [0, 79], velocity: [78] });
    if (!r.ok) throw new Error(r.error);
    const [pin] = r.data;
    expect(r.data).toHaveLength(2);
    expect(pin.type).toBe('fullbody');
    expect(pin.frame_indices).toEqual([0, 79]);
    expect(pin.local_joints_rot).toHaveLength(2);
    for (const frame of pin.local_joints_rot) {
      expect(frame).toHaveLength(3);
      expect(frame[0]).toEqual([0, 0, 0]);
      expect(frame[2]).toEqual([0, 0, 0]);
      expect(frame[1][0]).toBeCloseTo(0, 5);
      expect(frame[1][1]).toBeCloseTo(0, 5);
      expect(frame[1][2]).toBeCloseTo(1.5708, 4);
    }
    expect(pin.root_positions).toEqual([
      [f32(0), f32(0.9), f32(0.25)],
      [f32(0.07 * 79), f32(0.9), f32(0.25)],
    ]);
    for (const c of r.data) {
      expect(Object.keys(c).sort()).toEqual(['frame_indices', 'local_joints_rot', 'root_positions', 'type']);
    }
    expect(JSON.stringify(r.data)).not.toMatch(/global/);
  });

  it('velocity frame T-2 = seam pose stepped BACK by the frame 0->1 delta (90 - (100-90) = 80 deg)', () => {
    const r = buildSeamConstraints(clip(), { fullbody: [0, 79], velocity: [78] });
    if (!r.ok) throw new Error(r.error);
    const vel = r.data[1];
    expect(vel.type).toBe('fullbody');
    expect(vel.frame_indices).toEqual([78]);
    expect(vel.local_joints_rot[0][1][2]).toBeCloseTo(80 * DEG, 4);
    expect(vel.local_joints_rot[0][0]).toEqual([0, 0, 0]);
    expect(vel.root_positions).toEqual([[f32(0.07 * 78), f32(0.9), f32(0.25)]]);
  });

  it('refuses the measured anti-entry (last frame pinned alone) and out-of-range frames, naming why', () => {
    const last = buildSeamConstraints(clip(), { fullbody: [79], velocity: [] });
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.error).toMatch(/both endpoints/);
    const wide = buildSeamConstraints(clip(), { fullbody: [0, 99], velocity: [98] });
    expect(wide.ok).toBe(false);
    if (!wide.ok) expect(wide.error).toMatch(/80 frames/);
    const head = buildSeamConstraints(clip(), { fullbody: [0, 79], velocity: [0] });
    expect(head.ok).toBe(false);
  });

  it('a clip without local_rot_mats or root_positions is refused by member name', () => {
    const noRot = buildSeamConstraints(clip(80, ['local_rot_mats']), { fullbody: [0, 79], velocity: [78] });
    expect(noRot.ok).toBe(false);
    if (!noRot.ok) expect(noRot.error).toContain('local_rot_mats');
    const noRoot = buildSeamConstraints(clip(80, ['root_positions']), { fullbody: [0, 79], velocity: [78] });
    expect(noRoot.ok).toBe(false);
    if (!noRoot.ok) expect(noRoot.error).toContain('root_positions');
  });
});

describe('buildSeamConstraintArgs / parseSeamConstraintArgs', () => {
  const plan = { pins: { fullbody: [0, 79], velocity: [78] } };

  it('emits the exact argv for the constraint step', () => {
    expect(buildSeamConstraintArgs('pof_loop_fix.ts', 'C:/m/walk.npz', 'C:/m/walk_loopfix_a1.constraints.json', plan))
      .toEqual(['pof_loop_fix.ts', 'C:/m/walk.npz', 'C:/m/walk_loopfix_a1.constraints.json', '--pin', '0,79', '--velocity', '78']);
  });

  it('parses its own argv back (minus the script) and refuses a missing --pin', () => {
    const argv = buildSeamConstraintArgs('s', 'a.npz', 'b.json', plan).slice(1);
    expect(parseSeamConstraintArgs(argv)).toEqual({
      ok: true,
      data: { npzPath: 'a.npz', outPath: 'b.json', pins: { fullbody: [0, 79], velocity: [78] } },
    });
    expect(parseSeamConstraintArgs(['a.npz', 'b.json']).ok).toBe(false);
  });
});
