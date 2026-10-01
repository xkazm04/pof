/**
 * Seam constraints — the ARDY constraint list for the loop fix, built in-process from the
 * clip's own `.npz` (via {@link readNpz}; no python, no scipy).
 *
 * The measured recipe (docs/research/motion-constraint-fix-path-spec.md, 2026-08-19):
 *  - pin frame 0's pose at BOTH endpoints `[0, T-1]` — pinning only the last frame made the
 *    seam worse (141.8 -> 153.5 mm), so a pin set without frame 0 is refused here;
 *  - plus a velocity-matched frame `T-2`: the seam pose stepped BACK by the frame 0->1
 *    per-joint rotation delta, `R = R0 · (R1ᵀ · R0)` (the left and right delta conventions
 *    give the same matrix), which halved the seam velocity jump (29.28 -> 15.73 mm).
 *
 * The serialized shape is ARDY's `FullBodyConstraintSet.from_dict`, NOT its constructor
 * (the spec's "trap"): `local_joints_rot` is AXIS-ANGLE per frame per joint, `root_positions`
 * are the clip's own (so the walk keeps its travel), and there is no global-positions key —
 * ARDY derives globals itself by FK. Pure.
 */
import { err, ok, type Result } from '@/types/result';
import { readNpz, npyNumbers } from './npz';
import type { SeamPins } from './loopRemedy';

export interface FullBodyConstraint {
  type: 'fullbody';
  frame_indices: number[];
  local_joints_rot: number[][][];
  root_positions: number[][];
}

type Vec3 = [number, number, number];
type Mat3 = number[];

/** Row-major 3x3 -> axis-angle (rotation vector), through a quaternion so the half-turn
 *  case, where the trace formula is singular, keeps its axis. Same result as scipy's
 *  `Rotation.from_matrix(m).as_rotvec()` for a proper rotation. */
export function rotationMatrixToAxisAngle(m: ArrayLike<number>, o = 0): Vec3 {
  const [a, b, c, d, e, f, g, h, i] = Array.from({ length: 9 }, (_, k) => m[o + k]);
  const tr = a + e + i;
  let w: number, x: number, y: number, z: number;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    [w, x, y, z] = [0.25 * s, (h - f) / s, (c - g) / s, (d - b) / s];
  } else if (a > e && a > i) {
    const s = Math.sqrt(1 + a - e - i) * 2;
    [w, x, y, z] = [(h - f) / s, 0.25 * s, (b + d) / s, (c + g) / s];
  } else if (e > i) {
    const s = Math.sqrt(1 + e - a - i) * 2;
    [w, x, y, z] = [(c - g) / s, (b + d) / s, 0.25 * s, (f + h) / s];
  } else {
    const s = Math.sqrt(1 + i - a - e) * 2;
    [w, x, y, z] = [(d - b) / s, (c + g) / s, (f + h) / s, 0.25 * s];
  }
  if (w < 0) [w, x, y, z] = [-w, -x, -y, -z];
  const n = Math.hypot(x, y, z);
  if (n === 0) return [0, 0, 0];
  const k = (2 * Math.atan2(n, w)) / n;
  // `+ 0` folds -0 into 0 so an identity joint serializes as a clean zero vector.
  return [x * k + 0, y * k + 0, z * k + 0];
}

function mul(p: Mat3, q: Mat3): Mat3 {
  const r: Mat3 = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      r.push(p[row * 3] * q[col] + p[row * 3 + 1] * q[3 + col] + p[row * 3 + 2] * q[6 + col]);
    }
  }
  return r;
}

function transpose(p: Mat3): Mat3 {
  return [p[0], p[3], p[6], p[1], p[4], p[7], p[2], p[5], p[8]];
}

/** Build the constraint list for a seam pin set. Every refusal names its cause. */
export function buildSeamConstraints(bytes: Uint8Array, pins: SeamPins): Result<FullBodyConstraint[]> {
  const read = readNpz(bytes);
  if (!read.ok) return read;
  const a = read.data;
  const rm = a.arrays.get('local_rot_mats');
  const rots = rm ? npyNumbers(rm) : null;
  if (!rm || !rots) return err(`missing numeric member 'local_rot_mats' (have: ${a.names.join(',')})`);
  if (rm.shape.length !== 4 || rm.shape[2] !== 3 || rm.shape[3] !== 3) {
    return err(`expected [T,J,3,3] local_rot_mats, got (${rm.shape.join(', ')})`);
  }
  const [T, J] = rm.shape;
  const pm = a.arrays.get('root_positions');
  const root = pm ? npyNumbers(pm) : null;
  if (!pm || !root) return err(`missing numeric member 'root_positions' (have: ${a.names.join(',')})`);
  if (pm.shape.length !== 2 || pm.shape[0] !== T || pm.shape[1] !== 3) {
    return err(`expected [${T},3] root_positions, got (${pm.shape.join(', ')})`);
  }

  const last = T - 1;
  for (const f of [...pins.fullbody, ...pins.velocity]) {
    if (!Number.isInteger(f) || f < 0 || f > last) return err(`pin frame ${f} is outside the clip's ${T} frames`);
  }
  const ends = [...new Set(pins.fullbody)].sort((p, q) => p - q);
  if (ends.length !== 2 || ends[0] !== 0 || ends[1] !== last) {
    return err(
      `fullbody pins must be both endpoints [0, ${last}], got [${pins.fullbody.join(', ')}] — `
      + 'pinning the last frame alone is a measured anti-entry (141.8 -> 153.5 mm)',
    );
  }
  for (const v of pins.velocity) {
    if (v <= 0 || v >= last) return err(`velocity frame ${v} must lie strictly inside (0, ${last})`);
  }

  const mat = (t: number, j: number): Mat3 => Array.from(rots.subarray((t * J + j) * 9, (t * J + j) * 9 + 9));
  const rootAt = (t: number): number[] => [root[t * 3], root[t * 3 + 1], root[t * 3 + 2]];
  const seamPose = Array.from({ length: J }, (_, j) => rotationMatrixToAxisAngle(mat(0, j)));

  const out: FullBodyConstraint[] = [
    { type: 'fullbody', frame_indices: [0, last], local_joints_rot: [seamPose, seamPose], root_positions: [rootAt(0), rootAt(last)] },
  ];
  if (pins.velocity.length > 0) {
    const poses = pins.velocity.map((v) =>
      Array.from({ length: J }, (_, j) => {
        const r0 = mat(0, j);
        const back = mul(transpose(mat(1, j)), r0);
        let r = r0;
        for (let k = 0; k < last - v; k++) r = mul(r, back);
        return rotationMatrixToAxisAngle(r);
      }),
    );
    out.push({ type: 'fullbody', frame_indices: [...pins.velocity], local_joints_rot: poses, root_positions: pins.velocity.map(rootAt) });
  }
  return ok(out);
}

/** The argv of the constraint step (`pof_loop_fix.ts <npz> <out> --pin … --velocity …`). Pure. */
export function buildSeamConstraintArgs(script: string, npzPath: string, outPath: string, plan: { pins: SeamPins }): string[] {
  const args = [script, npzPath, outPath, '--pin', plan.pins.fullbody.join(',')];
  if (plan.pins.velocity.length > 0) args.push('--velocity', plan.pins.velocity.join(','));
  return args;
}

/** Parse {@link buildSeamConstraintArgs}' argv back (without the script). Pure. */
export function parseSeamConstraintArgs(argv: string[]): Result<{ npzPath: string; outPath: string; pins: SeamPins }> {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) flags.set(argv[i], argv[++i] ?? '');
    else positional.push(argv[i]);
  }
  const list = (s: string | undefined) => (s ? s.split(',').map(Number) : []);
  if (positional.length !== 2) return err('usage: <clip.npz> <out.constraints.json> --pin 0,T-1 [--velocity T-2]');
  const fullbody = list(flags.get('--pin'));
  if (fullbody.length === 0) return err('--pin is required (both endpoints, e.g. --pin 0,79)');
  return ok({ npzPath: positional[0], outPath: positional[1], pins: { fullbody, velocity: list(flags.get('--velocity')) } });
}
