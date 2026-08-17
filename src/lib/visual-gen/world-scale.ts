/**
 * World-scale grading — holds a generated mesh to a real-world SIZE, the way
 * `face-budget.ts` holds it to a triangle budget.
 *
 * Every image/text→3D generator PoF runs normalises its output to a unit box: the
 * longest bounding-box extent comes back as ~1.0 (glTF metres) regardless of what the
 * asset is. Measured 2026-08-17 over every `.glb` under `generated/`: the Tripo-cloud
 * hero `jinx.glb` is 1.000 m tall, `props__crate.glb` 1.000 m, `saber_hilt.glb`
 * 1.017 m LONG, every TripoSR best-of ~1.0. Nothing downstream corrected it — the
 * import template defaults `scale: 1.0`, the Tier-1 gate only rejected a DEGENERATE box,
 * and mesh-finish never rescales — so a hero shipped at 100 cm next to a 180 cm
 * Mannequin and a sword hilt at a metre. The pro workflow's fix is manual (export the
 * UE reference skeleton into Blender "for size reference"); this module is the
 * automated version: measure, compare, and hand back the `ImportUniformScale` that
 * would make the delivery the size it was supposed to be.
 *
 * Honesty rules (the project's dominant one):
 *  - no target ⇒ `unmeasured`, never `matches` — silence must not read as compliance;
 *  - a class gets a nominal size only where one is HONEST (a character = the UE5
 *    Mannequin); a prop can be a coin or a wagon, so no class-wide number is invented;
 *  - the correction factor is reported even on a match, so callers can always apply it.
 */

/** The longest extent (m) every generator PoF drives normalises its output to. */
export const GENERATOR_NORMALIZED_EXTENT_M = 1.0;

/** Band around {@link GENERATOR_NORMALIZED_EXTENT_M} that reads as "generator-normalised". */
const NORMALIZED_BAND: readonly [number, number] = [0.9, 1.1];

/** Relative tolerance on the longest extent before a delivery is called `off`. */
export const SCALE_TOLERANCE = 0.1;

/**
 * Nominal longest extents (m) per asset class, ONLY where the class has one honest
 * answer. Character = UE5 Mannequin (Manny/Quinn) height, the skeleton every generated
 * character is retargeted to. Deliberately absent for weapon/prop/environment/modular-part.
 */
export const NOMINAL_EXTENT_M: Readonly<Record<string, number>> = Object.freeze({
  character: 1.8,
});

/** The size a mesh was supposed to be — its longest bounding-box extent, in metres. */
export interface SizeRequest {
  targetExtentM: number;
}

export type ScaleVerdict = 'matches' | 'off' | 'unmeasured';

export interface ScaleGrade {
  verdict: ScaleVerdict;
  /** Longest measured bbox extent (m), when the mesh was measured. */
  measuredExtentM?: number;
  /** Requested longest extent (m), when one was requested. */
  targetExtentM?: number;
  /** measured / target. Absent when either side is missing. */
  ratio?: number;
  /**
   * `target / measured` — the uniform scale that makes the delivery its intended size
   * (UE `ImportUniformScale` on top of the importer's own m→cm unit conversion, or a
   * Blender rescale). Present whenever both sides are known, even on `matches`.
   */
  importUniformScale?: number;
  /** True when the longest extent sits in the generator-normalised ~1 m band. */
  normalized?: boolean;
  /** Why the verdict is what it is — always set for `off` and `unmeasured`. */
  reason?: string;
}

const usable = (n: number | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Longest axis of a bbox triple. 0 for an empty/degenerate box. */
export function longestExtent(bbox: readonly number[] | undefined): number {
  if (!bbox || bbox.length === 0) return 0;
  const m = Math.max(...bbox.map((v) => (Number.isFinite(v) ? v : 0)));
  return m > 0 ? m : 0;
}

/** Whether a bbox looks like raw generator output (longest extent ≈ 1 m). */
export function isGeneratorNormalized(bbox: readonly number[] | undefined): boolean {
  const l = longestExtent(bbox);
  return l >= NORMALIZED_BAND[0] && l <= NORMALIZED_BAND[1];
}

/** The honest nominal extent for a class, or undefined when the class has none. */
export function nominalExtentFor(assetClass: string | undefined): number | undefined {
  if (!assetClass) return undefined;
  return NOMINAL_EXTENT_M[assetClass];
}

const fmt = (m: number) => `${m.toFixed(2)} m`;

/**
 * Grade a measured bbox against the size that was requested for it. Pure.
 *
 * `bbox` is the Tier-1 critique's `BBOX` (trimesh extents, glTF metres). The request is
 * the intended longest extent in metres.
 */
export function gradeWorldScale(
  bbox: readonly number[] | undefined,
  request: SizeRequest | undefined,
): ScaleGrade {
  const measured = longestExtent(bbox);
  const normalized = isGeneratorNormalized(bbox);
  const measuredExtentM = usable(measured) ? measured : undefined;

  if (!request || !usable(request.targetExtentM)) {
    return {
      verdict: 'unmeasured',
      measuredExtentM,
      normalized,
      reason:
        'no target size was requested for this mesh — nothing to hold the delivery to' +
        (normalized ? ` (longest extent ${fmt(measured)} is generator-normalised, so its real-world size is unknown until one is set)` : ''),
    };
  }
  const targetExtentM = request.targetExtentM;
  if (measuredExtentM === undefined) {
    return {
      verdict: 'unmeasured',
      targetExtentM,
      reason: `mesh was not measured — a ${fmt(targetExtentM)} target cannot be confirmed without a bounding box`,
    };
  }

  const ratio = measuredExtentM / targetExtentM;
  const importUniformScale = targetExtentM / measuredExtentM;
  if (Math.abs(ratio - 1) <= SCALE_TOLERANCE) {
    return { verdict: 'matches', measuredExtentM, targetExtentM, ratio, importUniformScale, normalized };
  }

  const reason =
    `delivered ${fmt(measuredExtentM)} longest extent against a ${fmt(targetExtentM)} target (${ratio.toFixed(2)}x)` +
    (normalized
      ? ' — generator-normalised output (every provider returns a ~1 m box regardless of the asset)'
      : '') +
    `; import with ImportUniformScale ${importUniformScale.toFixed(2)} or rescale before shipping`;

  return { verdict: 'off', measuredExtentM, targetExtentM, ratio, importUniformScale, normalized, reason };
}
