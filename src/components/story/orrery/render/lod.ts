/**
 * Level of detail, and what a sector is filled with. Pure, so both can be unit-tested without a
 * canvas — which is the point: these are the two decisions that make or break the wheel at 10,739
 * nodes, and neither is observable from a screenshot.
 *
 * Rule 5 of the brief: detail is a function of zoom, read as a BAND settled at rest, never per
 * event. {@link detailBands} is that read. It is called once per bake, from the scale the bitmap is
 * being baked at — so during a gesture the bands are frozen at the last settled value and a pan
 * cannot make the wheel think.
 */

import type { NodeIx, OrreryModel, OrreryNode, ReachRow } from '@/lib/story/orrery';
import { depthCounts } from '@/components/story/orrery/render/derive';
import {
  TAU,
  ringInner,
  unitSpan,
  wheelOuter,
  type OrreryViewState,
} from '@/components/story/orrery/render/geometry';
import type { OrreryPalette } from '@/components/story/orrery/render/palette';

/**
 * Below this many pixels of average child width, a node's children are not drawn one at a time —
 * the node draws as one folded block tinted by what is inside it. The winner's `AGG`.
 */
export const AGGREGATE_PX = 1.2;
/** A ring is drawn unit-by-unit on the rim while each unit clears this many pixels. */
const RIM_UNIT_PX = 6;
/** Chords aggregate at the deepest ring whose members still clear this many pixels. */
const CHORD_UNIT_PX = 3.2;

export interface DetailBands {
  /** Deepest depth whose nodes still get their own rim unit. */
  rimDepth: number;
  /** Depth the chord layer aggregates to. */
  chordDepth: number;
}

/**
 * The two LOD bands for a focus at a given scale. Both walk outward from the focus and stop at the
 * first ring too crowded to resolve, so a band is always a contiguous range and never flickers
 * between two depths at one scale.
 */
export function detailBands(
  model: OrreryModel,
  focus: NodeIx,
  vs: OrreryViewState,
  scale: number,
): DetailBands {
  const f = model.R[focus];
  const counts = depthCounts(model, focus);
  const outer = wheelOuter(vs);
  const first = f.depth + 1;
  let rimDepth = first;
  let chordDepth = first;
  for (let d = first; d <= f.maxd; d++) {
    const n = counts[d] ?? 0;
    if (n > 0 && (TAU * outer * scale) / n >= RIM_UNIT_PX) rimDepth = d;
    else break;
  }
  for (let d = first; d <= f.maxd; d++) {
    const n = counts[d] ?? 0;
    if (n > 0 && (TAU * ringInner(d - vs.base, vs) * scale) / n >= CHORD_UNIT_PX) chordDepth = d;
    else break;
  }
  return { rimDepth, chordDepth };
}

/**
 * Would this node's children be too small to draw separately at `scale`? True means the node folds
 * into one block, which is how 9,700 dialogue lines become 384 honest blocks instead of a smear.
 */
export function foldsAtScale(n: OrreryNode, vs: OrreryViewState, scale: number): boolean {
  const nk = n.kids.length;
  if (nk === 0) return false;
  const ring = n.depth - vs.base;
  const mid = (ringInner(ring + 1, vs) + ringInner(ring + 2, vs)) * 0.5;
  const avg = (((n.u1 - n.u0) / unitSpan(vs)) * TAU * mid * scale) / nk;
  return avg < AGGREGATE_PX;
}

/**
 * The reserved lens value that tints by how far the cohorts DISAGREE rather than by one cohort.
 *
 * `OrreryStageProps.lens` is a `string | null`, so the cohort lenses are cohort names and this is
 * the one value that is not one. The value is the same string the chrome package publishes as
 * `COHORT_DIVERGENCE`, and a document declaring a cohort literally called `__diverge` still wins:
 * {@link lensModeOf} checks the model's own cohort list first.
 */
export const DIVERGE_LENS = '__diverge';

export type LensMode =
  | { mode: 'kind' }
  | { mode: 'cohort'; cohort: string }
  | { mode: 'diverge' };

/** Resolve the `lens` prop against the model's cohorts. An unknown name falls back to kind. */
export function lensModeOf(model: OrreryModel, lens: string | null): LensMode {
  if (!lens) return { mode: 'kind' };
  if (model.cohorts.includes(lens)) return { mode: 'cohort', cohort: lens };
  if (lens === DIVERGE_LENS && model.cohorts.length > 1) return { mode: 'diverge' };
  return { mode: 'kind' };
}

/**
 * What the lens has to say about one node.
 *
 * The three states that look alike if they are conflated are kept apart here, once, so no draw pass
 * can lose the distinction: `unmeasured` has no reach row and no measured descendant (hatched),
 * `measured` carries a real figure and a 0 there is a REAL zero (drawn dark, outlined), and
 * `derived` is a container's mean over its measured descendants (tinted, and said to be derived).
 */
export type LensValue =
  | { state: 'kind' }
  | { state: 'unmeasured' }
  | { state: 'measured'; value: number }
  | { state: 'derived'; value: number };

function spanOf(row: ReachRow, cohorts: readonly string[]): number | null {
  if (!row) return null;
  let lo = Infinity;
  let hi = -Infinity;
  let seen = 0;
  for (const c of cohorts) {
    const v = row[c];
    if (typeof v !== 'number') continue;
    seen++;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return seen > 0 ? hi - lo : null;
}

/** Read the lens for one node. Pure; the honesty rule lives here and nowhere else. */
export function lensValue(model: OrreryModel, n: OrreryNode, lens: LensMode): LensValue {
  if (lens.mode === 'kind') return { state: 'kind' };
  if (lens.mode === 'cohort') {
    const direct = n.reach?.[lens.cohort];
    if (typeof direct === 'number') return { state: 'measured', value: direct };
    const mean = n.reachMean?.[lens.cohort];
    if (typeof mean === 'number') return { state: 'derived', value: mean };
    return { state: 'unmeasured' };
  }
  const direct = spanOf(n.reach, model.cohorts);
  if (direct !== null) return { state: 'measured', value: direct };
  const mean = spanOf(n.reachMean, model.cohorts);
  if (mean !== null) return { state: 'derived', value: mean };
  return { state: 'unmeasured' };
}

/** `true` only for a node whose reach was MEASURED and is zero — never for an unmeasured one. */
export function isMeasuredZero(model: OrreryModel, n: OrreryNode, lens: LensMode): boolean {
  if (lens.mode !== 'cohort') return false;
  const v = lensValue(model, n, lens);
  return v.state === 'measured' && v.value === 0;
}

/** A fill the draw pass can use: a colour string, or the hatch pattern for unmeasured. */
export type Fill = { kind: 'solid'; css: string } | { kind: 'hatch' };

const REACH_MAX = 100;

function rampAt(ramp: string[], value: number): string {
  const i = Math.round((Math.min(REACH_MAX, Math.max(0, value)) / REACH_MAX) * (ramp.length - 1));
  return ramp[i] ?? ramp[ramp.length - 1] ?? '';
}

/** Fill for one node's own ring segment. */
export function fillFor(
  model: OrreryModel,
  n: OrreryNode,
  lens: LensMode,
  palette: OrreryPalette,
): Fill {
  const v = lensValue(model, n, lens);
  if (v.state === 'kind') {
    if (n.kind === 'container') {
      const row = palette.container[Math.min(n.depth, palette.container.length - 1)];
      return { kind: 'solid', css: row[n.sib & 1] ?? row[0] };
    }
    return { kind: 'solid', css: palette.kind[n.kind] ?? palette.kind.event };
  }
  if (v.state === 'unmeasured') return { kind: 'hatch' };
  const ramp = lens.mode === 'diverge' ? palette.diverge : palette.reach;
  return { kind: 'solid', css: rampAt(ramp, v.value) };
}

/**
 * Fill for a FOLDED block — a node standing for everything inside it. Without a lens it is tinted
 * by choice density (how many decisions per node are in there), which is the winner's
 * "slate to amber" legend entry.
 */
export function blockFillFor(
  model: OrreryModel,
  n: OrreryNode,
  lens: LensMode,
  palette: OrreryPalette,
): Fill {
  const v = lensValue(model, n, lens);
  if (v.state === 'kind') {
    const density = (n.nChoice / Math.max(n.w, 1)) * 2.4;
    const i = Math.min(palette.density.length - 1, Math.max(0, Math.round(density * (palette.density.length - 1))));
    return { kind: 'solid', css: palette.density[i] ?? palette.density[0] };
  }
  if (v.state === 'unmeasured') return { kind: 'hatch' };
  const ramp = lens.mode === 'diverge' ? palette.diverge : palette.reach;
  return { kind: 'solid', css: rampAt(ramp, v.value) };
}
