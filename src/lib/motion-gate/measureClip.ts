/**
 * Tier-1 loop closure measured from the clip ITSELF — the in-process port of
 * `scripts/visual-gen/ardy/pof_loop_closure.py` (which stays as the offline oracle).
 *
 * The gate used to read only the extractor's stdout, pasted in by the caller: five numbers
 * and no identity, so a verdict measured on `walk_v1.npz` passed silently beside frames of
 * `walk_v2`, and a caller who pasted nothing sent the clip to the billed vision tier. Here
 * the archive's bytes are read with {@link readNpz}, measured with the same root-relative
 * math, and the result carries the sha256 of exactly those bytes.
 *
 * The archive contract (task 2026-09-02-motion-archive-contract, step 2) is checked in the
 * gate path: a `skeleton` member (`core-27`) must agree with the joint count it labels, and
 * `applied_ops` travels on the source so a converted archive is distinguishable from a
 * native one. Server-only (node:crypto, node:zlib via the reader).
 */
import { createHash } from 'node:crypto';
import { err, ok, type Result } from '@/types/result';
import { readNpz, npyNumbers, type NpzArchive } from './npz';
import type { LoopMetrics } from './loopClosure';

/** ARDY/Kimodo exports are in metres; the gate speaks millimetres. */
const MM = 1000;

/** What was measured — the identity a pasted marker block never had. */
export interface ClipSource {
  path: string | null;
  /** Hex sha256 of the archive bytes the metrics were computed from. */
  sha256: string;
  frames: number;
  /** The archive's `fps` member; null when absent. */
  fps: number | null;
  skeleton?: string;
  appliedOps?: string[];
}

export interface MeasuredClip {
  metrics: LoopMetrics;
  source: ClipSource;
}

export interface MeasureClipOptions {
  path?: string;
  jointsKey?: string;
  rootKey?: string;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function scalarString(a: NpzArchive, key: string): string | undefined {
  const m = a.arrays.get(key);
  return m && m.dtype === 'unicode' ? (m.data as string[])[0] : undefined;
}

/** Root-mean-square of per-joint vector magnitudes over J joints at flat offsets. */
function rms(d: (j: number, k: number) => number, J: number): number {
  let sum = 0;
  for (let j = 0; j < J; j++) for (let k = 0; k < 3; k++) sum += d(j, k) ** 2;
  return Math.sqrt(sum / J);
}

/** Measure a clip's seam. Pure apart from hashing; every refusal names its cause. */
export function measureClip(bytes: Uint8Array, opts: MeasureClipOptions = {}): Result<MeasuredClip> {
  const jointsKey = opts.jointsKey ?? 'posed_joints';
  const rootKey = opts.rootKey ?? 'root_positions';
  const read = readNpz(bytes);
  if (!read.ok) return read;
  const a = read.data;

  const jm = a.arrays.get(jointsKey);
  if (!jm) return err(`missing member '${jointsKey}' (have: ${a.names.join(',')})`);
  const joints = npyNumbers(jm);
  if (!joints || jm.shape.length !== 3 || jm.shape[2] !== 3) {
    return err(`expected [T,J,3] numeric joints, got ${jm.descr} (${jm.shape.join(', ')})`);
  }
  const [T, J] = jm.shape;
  if (T < 3) return err(`need >=3 frames to measure a seam, got ${T}`);
  if (J < 1) return err('posed_joints has 0 joints');

  const skeleton = scalarString(a, 'skeleton');
  const declared = skeleton?.match(/^[A-Za-z]\w*-(\d+)$/);
  if (skeleton !== undefined && declared && Number(declared[1]) !== J) {
    return err(`archive contract: skeleton ${skeleton} but ${J} joints`);
  }

  // Prefer the exported root track; fall back to joint 0 (the root in Core-27 and SOMA).
  let root: (t: number, k: number) => number;
  const rm = a.arrays.get(rootKey);
  if (rm) {
    const r = npyNumbers(rm);
    if (!r || rm.shape.length !== 2 || rm.shape[1] !== 3) return err(`expected [T,3] ${rootKey}, got (${rm.shape.join(', ')})`);
    if (rm.shape[0] !== T) return err(`root track has ${rm.shape[0]} frames, joints have ${T}`);
    root = (t, k) => r[t * 3 + k];
  } else {
    root = (t, k) => joints[(t * J) * 3 + k];
  }
  const rel = (t: number, j: number, k: number) => joints[(t * J + j) * 3 + k] - root(t, k);

  const last = T - 1;
  const gap = (j: number, k: number) => rel(last, j, k) - rel(0, j, k);
  let worst = 0;
  for (let j = 0; j < J; j++) worst = Math.max(worst, Math.hypot(gap(j, 0), gap(j, 1), gap(j, 2)));
  const velJump = (j: number, k: number) => (rel(1, j, k) - rel(0, j, k)) - (rel(last, j, k) - rel(last - 1, j, k));
  const travel = Math.hypot(root(last, 0) - root(0, 0), root(last, 1) - root(0, 1), root(last, 2) - root(0, 2));

  const fpsMember = a.arrays.get('fps');
  const fpsValues = fpsMember ? npyNumbers(fpsMember) : null;
  const opsMember = a.arrays.get('applied_ops');
  const source: ClipSource = {
    path: opts.path ?? null,
    sha256: sha256Hex(bytes),
    frames: T,
    fps: fpsValues && fpsValues.length > 0 ? fpsValues[0] : null,
    ...(skeleton !== undefined ? { skeleton } : {}),
    ...(opsMember?.dtype === 'unicode' ? { appliedOps: [...(opsMember.data as string[])] } : {}),
  };
  return ok({
    metrics: {
      poseGapMm: rms(gap, J) * MM,
      worstJointMm: worst * MM,
      velJumpMm: rms(velJump, J) * MM,
      rootTravelMm: travel * MM,
      frames: T,
    },
    source,
  });
}
