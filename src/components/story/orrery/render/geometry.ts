/**
 * Polar helpers the wheel needs on top of the pure layout core.
 *
 * `@/lib/story/orrery/layout` owns the trigonometry that decides WHERE a node sits — unit spans,
 * ring thickness, dock angles, the dial's tracks. Nothing here recomputes any of that. What this
 * module adds is the view-dependent part the layout deliberately left out: the re-rooted window
 * (`OrreryViewState`), the unit-to-angle mapping for that window, the annular bounding-box test the
 * culler uses, and the chord control point. All pure, all DOM-free.
 */

import { ORRERY_GEOMETRY, innerRadius, ringThicknessFor } from '@/lib/story/orrery/layout';
import type { NodeIx, OrreryModel, OrreryNode } from '@/lib/story/orrery';

export const TAU = Math.PI * 2;
/** Twelve o'clock, where the wheel starts. Matches the layout core's `TOP_ANGLE`. */
export const TOP_ANGLE = -Math.PI / 2;
const QUARTER = Math.PI / 2;

/**
 * The window the wheel is currently showing: which slice of unit space fills the turn, which ring
 * is the hub's edge, and how thick a ring is at this depth. Re-rooting is a change of this object,
 * and the one eased glide the owner chose this variant for is a `lerp` between two of them.
 */
export interface OrreryViewState {
  /** Unit-space window: `w0` is at twelve o'clock, `w1` closes the turn. */
  w0: number;
  w1: number;
  /** Containment depth sitting on the hub's edge. */
  base: number;
  /** Ring thickness in world units. */
  T: number;
  /** How many rings are visible below the focus. */
  L: number;
}

/** The view state that shows node `i` as the hub, with everything below it as rings. */
export function viewStateFor(model: OrreryModel, i: NodeIx): OrreryViewState {
  const f = model.R[i] ?? model.R[model.R.length - 1];
  const L = Math.max(1, f.maxd - f.depth);
  return { w0: f.u0, w1: f.u1, base: f.depth, T: ringThicknessFor(L), L };
}

/** Interpolate two view states. `t = 0` is `a`. */
export function lerpViewState(a: OrreryViewState, b: OrreryViewState, t: number): OrreryViewState {
  const m = (x: number, y: number) => x + (y - x) * t;
  return {
    w0: m(a.w0, b.w0),
    w1: m(a.w1, b.w1),
    base: m(a.base, b.base),
    T: m(a.T, b.T),
    L: m(a.L, b.L),
  };
}

/** Outer radius of the outermost visible ring (the prototype's `RRof`). */
export function wheelOuter(vs: OrreryViewState): number {
  return ORRERY_GEOMETRY.hubRadius + vs.L * vs.T;
}

/** Inner radius of ring `ring`, counted from the focus, under this view state. */
export function ringInner(ring: number, vs: OrreryViewState): number {
  return innerRadius(ring, vs.T);
}

/** How far the drawing reaches from the centre, rim furniture included. */
export function sceneExtent(model: OrreryModel, vs: OrreryViewState): number {
  if (model.flat) return model.flat.outer + ORRERY_GEOMETRY.rimExtent;
  return wheelOuter(vs) + ORRERY_GEOMETRY.rimExtent;
}

/** Width of the unit window. Never zero, so the angle mapping cannot divide by it. */
export function unitSpan(vs: OrreryViewState): number {
  const s = vs.w1 - vs.w0;
  return s > 1e-12 ? s : 1e-12;
}

/** Unit position to world angle, under the current window. The ONE place this mapping exists. */
export function angleAt(u: number, vs: OrreryViewState): number {
  return TOP_ANGLE + (TAU * (u - vs.w0)) / unitSpan(vs);
}

/** World angle back to a unit position. The exact inverse of {@link angleAt}. */
export function unitAt(angle: number, vs: OrreryViewState): number {
  let a = angle - TOP_ANGLE;
  while (a < 0) a += TAU;
  while (a >= TAU) a -= TAU;
  return vs.w0 + (a / TAU) * unitSpan(vs);
}

/** A node's angular span, clamped to the visible turn. */
export function sectorAngles(n: OrreryNode, vs: OrreryViewState): { a0: number; a1: number } {
  let a0 = angleAt(n.u0, vs);
  let a1 = angleAt(n.u1, vs);
  if (a0 < TOP_ANGLE) a0 = TOP_ANGLE;
  if (a1 > TOP_ANGLE + TAU) a1 = TOP_ANGLE + TAU;
  return { a0, a1 };
}

export interface WorldRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Does the annulus sector `a0..a1 x r0..r1` touch `rect`? The culling predicate.
 *
 * It bounds the sector by its four corners plus any axis crossing inside the sweep, which is what
 * makes a wide arc's box correct rather than merely conservative. A subtree is tested once with
 * `r1` set to its deepest descendant ring, so rejecting it rejects everything inside it.
 */
export function sectorTouchesRect(
  a0: number,
  a1: number,
  r0: number,
  r1: number,
  rect: WorldRect,
): boolean {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const add = (r: number, a: number) => {
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  add(r0, a0);
  add(r0, a1);
  add(r1, a0);
  add(r1, a1);
  for (let j = -1; j <= 3; j++) {
    const a = j * QUARTER;
    if (a > a0 && a < a1) add(r1, a);
  }
  return !(x1 < rect.x0 || x0 > rect.x1 || y1 < rect.y0 || y0 > rect.y1);
}

/**
 * Control point for a chord bundled through the interior: the nearer radius pulled toward the
 * centre by how far apart the two ends are, so short hops stay near the rim and long ones dive.
 * Lifted from the prototype so the bundle reads the same.
 */
export function chordControl(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { cx: number; cy: number } {
  const r1 = Math.hypot(x1, y1);
  const r2 = Math.hypot(x2, y2);
  const t1 = Math.atan2(y1, x1);
  const t2 = Math.atan2(y2, x2);
  let d = Math.abs(t1 - t2);
  if (d > Math.PI) d = TAU - d;
  let mid = Math.atan2(Math.sin(t1) + Math.sin(t2), Math.cos(t1) + Math.cos(t2));
  if (d > Math.PI - 1e-3) mid = t1;
  const rc = Math.min(r1, r2) * 0.85 * Math.pow(1 - d / Math.PI, 1.6);
  return { cx: Math.cos(mid) * rc, cy: Math.sin(mid) * rc };
}

/**
 * Impact-bar length for a value against the range present on screen, with the winner's contrast
 * stretch — raw spreads were "a uniform wall", so the floor is lifted and the curve bent.
 */
export function impactBarLength(value: number, vmin: number, vmax: number): number {
  const lo = vmin * 0.9;
  const span = vmax - lo || 1;
  const t = Math.min(1, Math.max(0, (value - lo) / span));
  return ORRERY_GEOMETRY.barMax * (0.12 + 0.88 * Math.pow(t, 0.85));
}

/** A dock's world position, given the hub radius it is a fraction of. */
export function dockPoint(
  pos: { a: number; rad: number; size: number },
  hub: number,
): { x: number; y: number; r: number } {
  return { x: Math.cos(pos.a) * pos.rad * hub, y: Math.sin(pos.a) * pos.rad * hub, r: pos.size * hub };
}

export { ORRERY_GEOMETRY };
