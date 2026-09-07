/**
 * Tier-1 rig gate — the free, deterministic check that a produced rig is STRUCTURALLY
 * usable, in the same spirit as `mesh-critique.ts` for geometry.
 *
 * The question it answers is narrow and worth stating plainly: *can this skeleton
 * actually deform this mesh?* A vertex with no weight will not follow any bone; weights
 * that do not sum to 1 scale the vertex as the skeleton moves; a negative or NaN weight
 * corrupts the skin. Those are DEFINITIONAL failures, not tuned thresholds — which is
 * what makes them safe to gate on.
 *
 * What it explicitly does NOT judge is whether the skeleton is ANATOMICALLY sensible for
 * the creature: whether 28 joints land at plausible limbs, whether the spine bends where
 * a spine should. That needs a posed render and a critique pass, and calling a
 * structurally-valid rig a "good rig" would be exactly the overclaim this gate exists to
 * avoid.
 *
 * Baseline captured from real `skin-tokens.cpp` output on 2026-09-07 (see
 * docs/research/skintokens-rigging-spec.md):
 *
 *   bestiary_grunt  28 joints / 26,788 verts  weight sums min=max=mean=1.0  0 orphans
 *   cube            6 joints  /     24 verts  weight sums min=max=mean=1.0  0 orphans
 *
 * Parsing is done here rather than through Blender or trimesh: a rig lives entirely in
 * the glTF JSON chunk plus two accessors, so a spawn would cost seconds and a dependency
 * for something that is a few hundred bytes of buffer reading.
 */
import { readFileSync } from 'node:fs';

/** Structural facts read off a GLB. No judgement — {@link scoreRig} does that. */
export interface RigFacts {
  hasSkin: boolean;
  /** Joints the skin DECLARES. */
  jointCount: number;
  /** Distinct joints any vertex actually has a non-zero weight for. */
  referencedJoints: number;
  hasInverseBindMatrices: boolean;
  vertexCount: number;
  /** Vertices whose weights sum to ~0 — they follow nothing. */
  zeroWeightVertices: number;
  negativeWeights: number;
  /** NaN/Infinity weights. */
  nonFiniteWeights: number;
  /** Largest number of non-zero influences on any single vertex. */
  maxInfluences: number;
  weightSumMin: number;
  weightSumMax: number;
  weightSumMean: number;
}

export interface RigVerdict {
  pass: boolean;
  /** 0-100. 100 is a clean rig; warnings deduct, failures floor it at 0. */
  score: number;
  /** Reasons the rig is unusable. Non-empty means `pass: false`. */
  failures: string[];
  /** Real defects that do not make the rig unusable. */
  warnings: string[];
}

export interface RigGateResult {
  /** Whether the file could be READ and parsed — not whether the rig passed. */
  ok: boolean;
  error?: string;
  facts?: RigFacts;
  verdict?: RigVerdict;
}

const GLTF_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** glTF componentType → typed-array reader. */
const COMPONENT = {
  5120: { size: 1, read: (d: DataView, o: number) => d.getInt8(o) },
  5121: { size: 1, read: (d: DataView, o: number) => d.getUint8(o) },
  5122: { size: 2, read: (d: DataView, o: number) => d.getInt16(o, true) },
  5123: { size: 2, read: (d: DataView, o: number) => d.getUint16(o, true) },
  5125: { size: 4, read: (d: DataView, o: number) => d.getUint32(o, true) },
  5126: { size: 4, read: (d: DataView, o: number) => d.getFloat32(o, true) },
} as const;

const NCOMP: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

interface Gltf {
  meshes?: { primitives: { attributes: Record<string, number> }[] }[];
  skins?: { joints: number[]; inverseBindMatrices?: number }[];
  accessors?: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[];
  bufferViews?: { byteOffset?: number; byteLength: number; byteStride?: number }[];
}

/**
 * Read rig facts from GLB bytes. Throws only when the bytes are not a GLB at all — an
 * unrigged mesh is a legitimate answer (`hasSkin: false`), not an error, because
 * "this asset was never rigged" is precisely one of the things the gate must report.
 */
export function parseGlbRig(buffer: Buffer): RigFacts {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (buffer.byteLength < 12 || view.getUint32(0, true) !== GLTF_MAGIC) {
    throw new Error('not a binary glTF (.glb): missing glTF magic');
  }
  let json: Gltf | undefined;
  let bin: Buffer | undefined;
  let off = 12;
  while (off + 8 <= buffer.byteLength) {
    const len = view.getUint32(off, true);
    const type = view.getUint32(off + 4, true);
    const start = off + 8;
    if (start + len > buffer.byteLength) break;
    if (type === CHUNK_JSON) json = JSON.parse(buffer.subarray(start, start + len).toString('utf8')) as Gltf;
    else if (type === CHUNK_BIN) bin = buffer.subarray(start, start + len);
    off = start + len;
  }
  if (!json) throw new Error('not a binary glTF (.glb): no JSON chunk');

  const empty: RigFacts = {
    hasSkin: false, jointCount: 0, referencedJoints: 0, hasInverseBindMatrices: false,
    vertexCount: 0, zeroWeightVertices: 0, negativeWeights: 0, nonFiniteWeights: 0,
    maxInfluences: 0, weightSumMin: 0, weightSumMax: 0, weightSumMean: 0,
  };

  const prim = json.meshes?.[0]?.primitives?.[0];
  if (!prim) return empty;

  const readAccessor = (index: number | undefined): number[][] | null => {
    if (index === undefined || !json.accessors || !json.bufferViews || !bin) return null;
    const a = json.accessors[index];
    const bv = json.bufferViews[a.bufferView];
    const comp = COMPONENT[a.componentType as keyof typeof COMPONENT];
    const n = NCOMP[a.type];
    if (!comp || !n) return null;
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const stride = bv.byteStride ?? comp.size * n;
    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const rows: number[][] = [];
    for (let i = 0; i < a.count; i++) {
      const row: number[] = [];
      for (let c = 0; c < n; c++) row.push(comp.read(dv, base + i * stride + c * comp.size));
      rows.push(row);
    }
    return rows;
  };

  const position = readAccessor(prim.attributes.POSITION);
  const vertexCount = position?.length ?? 0;

  const skin = json.skins?.[0];
  const weights = readAccessor(prim.attributes.WEIGHTS_0);
  const joints = readAccessor(prim.attributes.JOINTS_0);
  if (!skin || !weights || !joints) return { ...empty, vertexCount };

  // Integer weight encodings are normalized fractions of their max; float ones are used
  // as-is. Without this an 8-bit-weight rig would read as sums of ~255 and fail.
  const wAcc = json.accessors![prim.attributes.WEIGHTS_0];
  const scale =
    wAcc.componentType === 5121 ? 1 / 255 : wAcc.componentType === 5123 ? 1 / 65535 : 1;

  let zeroWeightVertices = 0;
  let negativeWeights = 0;
  let nonFiniteWeights = 0;
  let maxInfluences = 0;
  let sumMin = Number.POSITIVE_INFINITY;
  let sumMax = Number.NEGATIVE_INFINITY;
  let sumTotal = 0;
  const referenced = new Set<number>();

  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    const j = joints[i] ?? [];
    let sum = 0;
    let influences = 0;
    for (let c = 0; c < w.length; c++) {
      const value = w[c] * scale;
      if (!Number.isFinite(value)) { nonFiniteWeights++; continue; }
      if (value < 0) negativeWeights++;
      sum += value;
      if (value > 0) { influences++; if (j[c] !== undefined) referenced.add(j[c]); }
    }
    if (sum < 1e-6) zeroWeightVertices++;
    if (influences > maxInfluences) maxInfluences = influences;
    if (sum < sumMin) sumMin = sum;
    if (sum > sumMax) sumMax = sum;
    sumTotal += sum;
  }
  const n = weights.length || 1;

  return {
    hasSkin: true,
    jointCount: skin.joints.length,
    referencedJoints: referenced.size,
    hasInverseBindMatrices: skin.inverseBindMatrices !== undefined,
    vertexCount: vertexCount || weights.length,
    zeroWeightVertices,
    negativeWeights,
    nonFiniteWeights,
    maxInfluences,
    weightSumMin: Number.isFinite(sumMin) ? sumMin : 0,
    weightSumMax: Number.isFinite(sumMax) ? sumMax : 0,
    weightSumMean: sumTotal / n,
  };
}

/**
 * Tolerance on the weight sum. Both captured rigs sum to exactly 1.0, so this is loose
 * on purpose: it is here to survive 8/16-bit weight quantization, not to accommodate a
 * sloppy rig.
 */
const WEIGHT_SUM_TOLERANCE = 1e-3;

/** A skeleton this thin is more likely a degenerate prediction than a real rig. */
const THIN_SKELETON_JOINTS = 2;

/** Grade the facts. Pure. */
export function scoreRig(facts: RigFacts): RigVerdict {
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!facts.hasSkin) {
    return {
      pass: false,
      score: 0,
      failures: ['no skin: the asset has no joints or vertex weights, so it is not rigged'],
      warnings: [],
    };
  }
  if (facts.jointCount === 0) failures.push('the skin declares no joints');
  if (facts.referencedJoints === 0) {
    failures.push('no joint is referenced by any weighted vertex — the skeleton drives nothing');
  }
  if (facts.zeroWeightVertices > 0) {
    failures.push(
      `${facts.zeroWeightVertices} of ${facts.vertexCount} vertices carry no weight — they cannot follow the skeleton`,
    );
  }
  if (
    Math.abs(facts.weightSumMin - 1) > WEIGHT_SUM_TOLERANCE ||
    Math.abs(facts.weightSumMax - 1) > WEIGHT_SUM_TOLERANCE
  ) {
    failures.push(
      `weights are not normalized (sums ${facts.weightSumMin.toFixed(4)}–${facts.weightSumMax.toFixed(4)}, expected 1) — vertices will scale as the skeleton moves`,
    );
  }
  if (facts.negativeWeights > 0) failures.push(`${facts.negativeWeights} negative weight(s)`);
  if (facts.nonFiniteWeights > 0) failures.push(`${facts.nonFiniteWeights} non-finite weight(s)`);

  const orphans = facts.jointCount - facts.referencedJoints;
  if (orphans > 0) warnings.push(`${orphans} orphan joint(s): declared but deforming no vertex`);
  if (!facts.hasInverseBindMatrices) {
    warnings.push('no inverse bind matrices — viewers must assume identity binds, which often mangles the rest pose');
  }
  if (facts.jointCount > 0 && facts.jointCount <= THIN_SKELETON_JOINTS) {
    warnings.push(`only ${facts.jointCount} joint(s) — likely a degenerate prediction rather than a usable skeleton`);
  }

  const score = failures.length > 0 ? 0 : Math.max(0, 100 - warnings.length * 10);
  return { pass: failures.length === 0, score, failures, warnings };
}

/** Read a GLB from disk and gate it. `ok:false` means unreadable, NOT "failed the gate". */
export function gateRig(path: string, read: (p: string) => Buffer = readFileSync): RigGateResult {
  let buffer: Buffer;
  try {
    buffer = read(path);
  } catch (e) {
    return { ok: false, error: `could not read ${path}: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    const facts = parseGlbRig(buffer);
    return { ok: true, facts, verdict: scoreRig(facts) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
