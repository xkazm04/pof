/**
 * Texel-density budget — the TEXTURE analog of `face-budget.ts`.
 *
 * PoF already knows this failure in prose. `ue-gotchas.ts` (`ai-generated-environment-
 * assembly`) warns that generating a whole space as one mesh collapses its texel density,
 * "even an 8K bake goes blurry once the player walks up to a wall". Nothing measured it.
 *
 * The gap is mechanical and sits between two modules that never met:
 *
 *  - `world-scale.ts` knows how big the asset is SUPPOSED to be in metres — and proved
 *    every generator PoF drives normalises its output to a ~1.0 m box regardless of
 *    subject, so the measured extent is not the intended one;
 *  - `mesh-finish.ts` bakes at a FLAT `--bake-size 1024` default (`buildMeshFinishArgs`)
 *    with no reference to size at all.
 *
 * So a 10 cm coin and a 12 m cave chunk receive the same 1024² map. The coin spends 10x
 * the pixels it can ever show; the cave wall gets 85 px/m and goes blurry the moment the
 * player approaches it — exactly the documented failure, undetected because a bake either
 * produced a file or did not, and a file always read as success.
 *
 * This module fixes ONE unit (px per real-world metre), derives the bake size an asset's
 * size actually earns, and grades a bake that already happened. It also plans the KIT
 * case the pro workflow uses — many props sharing one atlas and one material, which is a
 * draw-call decision that only texel density can size honestly.
 *
 * Honesty rules (the project's dominant one), inherited from `face-budget.ts`:
 *  - a missing measurement yields `unmeasured`, never `matches`;
 *  - when the atlas ceiling forces a density below target, the plan says `starved` and
 *    reports the density it ACHIEVED — it never quietly returns an oversized atlas.
 */

/** The unit every texel-density budget in PoF is written in. */
export const TEXEL_DENSITY_UNIT = 'px/m' as const;

/**
 * Target texture pixels per real-world metre. 1024 px/m (≈10 px/cm) is the density a
 * 1 m prop gets from the existing flat 1024 default — chosen so the generator-normalised
 * ~1 m asset that PoF produces today grades as `matches` and nothing regresses.
 */
export const DEFAULT_TARGET_PX_PER_M = 1024;

/** Smallest bake the ladder will recommend. Below this a map costs more than it carries. */
export const MIN_BAKE_SIZE = 256;

/** Largest bake the ladder will recommend, and the atlas ceiling. */
export const MAX_BAKE_SIZE = 4096;

/**
 * How far density may drift from target and still read as `matches`. Bake sizes are
 * powers of two, so one full rung either way is the natural tolerance — anything the
 * ladder could not have fixed is not a finding.
 */
export const DENSITY_TOLERANCE = 2;

const usable = (n: number | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Smallest power of two ≥ n. */
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Texture pixels per real-world metre across an asset's longest extent. Pure.
 * Undefined when either side is unmeasured — never 0, which would read as "measured,
 * and there is none".
 */
export function texelDensity(bakeSize: number | undefined, extentM: number | undefined): number | undefined {
  if (!usable(bakeSize) || !usable(extentM)) return undefined;
  return bakeSize / extentM;
}

/**
 * The bake size an asset's real-world size earns, snapped UP to a power of two so the
 * target is met rather than missed, and clamped to the ladder. Pure.
 */
export function bakeSizeForExtent(extentM: number, target: number = DEFAULT_TARGET_PX_PER_M): number {
  if (!usable(extentM) || !usable(target)) return MIN_BAKE_SIZE;
  const ideal = nextPow2(Math.ceil(extentM * target));
  return Math.min(MAX_BAKE_SIZE, Math.max(MIN_BAKE_SIZE, ideal));
}

export type DensityVerdict = 'matches' | 'starved' | 'wasted' | 'unmeasured';

export interface DensityRequest {
  /** The bake resolution that was used, in pixels (square maps). */
  bakeSize: number | undefined;
  /** The asset's longest real-world extent, in metres. */
  extentM: number | undefined;
  /** Target density; defaults to {@link DEFAULT_TARGET_PX_PER_M}. */
  targetPxPerM?: number;
}

export interface DensityGrade {
  verdict: DensityVerdict;
  /** Measured density, when both sides were known. */
  densityPxPerM?: number;
  targetPxPerM?: number;
  /** density / target. Below 1 is starved, above 1 is wasted. */
  ratio?: number;
  /** The bake size the asset's size earns — reported even on a match. */
  recommendedBakeSize?: number;
  /** Why the verdict is what it is — always set except on `matches`. */
  reason?: string;
}

/** Grade a bake that already happened against the real-world size it has to cover. Pure. */
export function gradeTexelDensity(request: DensityRequest): DensityGrade {
  const target = usable(request.targetPxPerM) ? request.targetPxPerM : DEFAULT_TARGET_PX_PER_M;
  const density = texelDensity(request.bakeSize, request.extentM);

  if (density === undefined) {
    const missing = !usable(request.bakeSize)
      ? 'nothing was baked for this mesh'
      : 'the mesh has no real-world size — every generator PoF drives normalises to a ~1 m box, so the extent must come from the size REQUEST, not the delivery';
    return {
      verdict: 'unmeasured',
      targetPxPerM: target,
      reason: `${missing} — a ${target} ${TEXEL_DENSITY_UNIT} target cannot be confirmed`,
    };
  }

  const extentM = request.extentM!;
  const recommendedBakeSize = bakeSizeForExtent(extentM, target);
  const ratio = density / target;
  const base = { densityPxPerM: density, targetPxPerM: target, ratio, recommendedBakeSize };

  if (ratio < 1 / DENSITY_TOLERANCE) {
    return {
      ...base,
      verdict: 'starved',
      reason:
        `${density.toFixed(0)} ${TEXEL_DENSITY_UNIT} across ${extentM.toFixed(2)} m is ` +
        `${(1 / ratio).toFixed(1)}x below the ${target} ${TEXEL_DENSITY_UNIT} target — ` +
        `the map goes blurry as the player approaches. Bake at ${recommendedBakeSize} px` +
        (recommendedBakeSize === MAX_BAKE_SIZE && recommendedBakeSize < Math.ceil(extentM * target)
          ? `, the ceiling — past it the surface must be split into a kit or carry a seamless tiling material instead of a unique bake`
          : ''),
    };
  }
  if (ratio > DENSITY_TOLERANCE) {
    return {
      ...base,
      verdict: 'wasted',
      reason:
        `${density.toFixed(0)} ${TEXEL_DENSITY_UNIT} across ${extentM.toFixed(2)} m is ` +
        `${ratio.toFixed(1)}x the ${target} ${TEXEL_DENSITY_UNIT} target — pixels the asset ` +
        `can never show. Bake at ${recommendedBakeSize} px`,
    };
  }
  return { ...base, verdict: 'matches' };
}

/** One asset in a kit that is a candidate for a shared atlas. */
export interface KitMember {
  name: string;
  /** Longest real-world extent, in metres. */
  extentM: number;
}

export interface AtlasMember extends KitMember {
  /** Square cell allocated in the atlas, in pixels. */
  cellPx: number;
  /** Density this member actually gets from its cell. */
  densityPxPerM: number;
}

export interface AtlasPlan {
  ok: boolean;
  /** Square atlas side, in pixels. */
  atlasSize?: number;
  members?: AtlasMember[];
  /** `matches` when every member reaches target; `starved` when the ceiling forced a cut. */
  verdict?: 'matches' | 'starved';
  /** The WORST density any member ends up with — the honest headline number. */
  achievedPxPerM?: number;
  targetPxPerM?: number;
  /** Materials before atlassing — one per member; the draw-call cost the atlas removes. */
  materialsBefore?: number;
  /** Materials after — an atlas is one. */
  materialsAfter?: number;
  reason?: string;
}

/**
 * Plan one shared atlas for a kit of props — the pro workflow's "why not have them use
 * one material" step, sized by texel density rather than by eye.
 *
 * Every cell is a power of two, so the greedy quadtree packing an atlas baker performs
 * is exact: any multiset of power-of-two squares tiles a power-of-two square whose side
 * is at least the largest cell and whose area is at least their total. That is why the
 * atlas side below is derived from those two bounds alone and needs no packer to be
 * truthful.
 *
 * Pure — no Blender, no files. The Blender side (join → UV pack → bake to the atlas)
 * consumes this plan; see `docs/research/kit-atlas-bake-spec.md`.
 */
export function planKitAtlas(members: KitMember[], targetPxPerM: number = DEFAULT_TARGET_PX_PER_M): AtlasPlan {
  const target = usable(targetPxPerM) ? targetPxPerM : DEFAULT_TARGET_PX_PER_M;
  if (!members || members.length === 0) {
    return { ok: false, reason: 'an atlas needs at least one member — nothing to plan' };
  }
  const unmeasured = members.filter((m) => !usable(m.extentM));
  if (unmeasured.length > 0) {
    return {
      ok: false,
      reason:
        `cannot plan an atlas from unmeasured members (${unmeasured.map((m) => m.name).join(', ')}) — ` +
        'a cell is sized from the real-world extent, so an unknown extent has no honest cell',
    };
  }

  let cells = members.map((m) => bakeSizeForExtent(m.extentM, target));
  const sideFor = (cs: number[]): number =>
    Math.max(
      ...cs,
      nextPow2(Math.ceil(Math.sqrt(cs.reduce((s, c) => s + c * c, 0)))),
    );

  let atlasSize = sideFor(cells);
  let cut = false;
  while (atlasSize > MAX_BAKE_SIZE) {
    cells = cells.map((c) => Math.max(1, c / 2));
    atlasSize = sideFor(cells);
    cut = true;
  }

  const planned: AtlasMember[] = members.map((m, i) => ({
    ...m,
    cellPx: cells[i],
    densityPxPerM: cells[i] / m.extentM,
  }));
  const achievedPxPerM = Math.min(...planned.map((m) => m.densityPxPerM));
  /**
   * A kit plan is held to the TARGET, not to the grading tolerance. `gradeTexelDensity`
   * forgives a rung because the ladder could not have done better; a plan that lands a
   * rung low did so because the atlas ceiling took the rung away, and the caller has to
   * be told — that is the whole decision (split the kit, or accept the loss).
   */
  const starved = achievedPxPerM < target;

  return {
    ok: true,
    atlasSize,
    members: planned,
    verdict: starved ? 'starved' : 'matches',
    achievedPxPerM,
    targetPxPerM: target,
    materialsBefore: members.length,
    materialsAfter: 1,
    reason: cut
      ? `the kit wanted more atlas than the ${MAX_BAKE_SIZE} px ceiling allows, so every cell was ` +
        `reduced to fit — the worst member now gets ${achievedPxPerM.toFixed(0)} ${TEXEL_DENSITY_UNIT} ` +
        `against a ${target} target. Split the kit across two atlases to hold the target.`
      : undefined,
  };
}
