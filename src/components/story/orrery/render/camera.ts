/**
 * The ONE coordinate authority.
 *
 * Every screen-to-world and world-to-screen conversion in the stage passes through this module. No
 * draw pass, hit test, handler or hook does its own trigonometry; a second place doing it is the
 * defect this file exists to prevent, and the type contract (`OrreryCamera`) says so too.
 *
 * ── Reuse, and the one thing that could not be reused ───────────────────────────────────────────
 * `@/lib/audio-scene-viewport` is the repo's pure, tested viewport module and the camera speaks its
 * invariant exactly: `screen = pan + zoom * content`. The conversions, the fit centring and the
 * visible-rect predicate are taken from it verbatim (`screenToContent`, `panToCenter`,
 * `viewportRectInContent`) — `OrreryCamera` maps onto its `Viewport` one field at a time.
 *
 * What could NOT be reused is the clamp. `clampZoom` there is hard-wired to module constants
 * `MIN_ZOOM = 0.1` / `MAX_ZOOM = 4`, and `zoomAtPoint` applies it unconditionally. The Orrery's
 * limits are relative to the fit scale (0.4x fit to 36x fit on the containment wheel, 14x on the
 * dial) because the whole point of the wheel is to dive from a 10,739-node overview into one
 * conversation: at the synthetic document's fit scale of roughly 0.8, the wheel needs about 28x
 * absolute, which that clamp would cut to 4 and the dive would stop dead a third of the way in. So
 * {@link clampCameraScale} and {@link zoomAtScreenPoint} are fresh, and only the clamp is.
 */

import {
  panToCenter,
  screenToContent,
  type Viewport,
} from '@/lib/audio-scene-viewport';
import type { OrreryCamera } from '@/lib/story/orrery';
import type { WorldRect } from '@/components/story/orrery/render/geometry';

/** How far below the fit scale the camera may pull back, and how far past it it may dive. */
export const ZOOM_OUT_LIMIT = 0.4;
export const ZOOM_IN_LIMIT_WHEEL = 36;
export const ZOOM_IN_LIMIT_DIAL = 14;
/** Multiplicative step for the zoom buttons and the `+` / `-` keys. */
export const ZOOM_STEP = 1.6;

/**
 * Chrome at the top of the stage the wheel must not sit under: the breadcrumb row and the honesty
 * badges, which the theme places at `top: 10px` and `top: 44px` inside the stage. Verbatim from the
 * winner's `fitFor`.
 */
const TOP_RESERVE = 70;
const TOP_OFFSET = 58;
const SIDE_INSET = 16;

export interface ZoomLimits {
  lo: number;
  hi: number;
}

/** The camera as the repo's viewport type, so the shared pure helpers apply unchanged. */
export function toViewport(cam: OrreryCamera): Viewport {
  return { zoom: cam.scale, panX: cam.cx, panY: cam.cy };
}

/** World point to screen point. `screen = pan + zoom * world`. */
export function worldToScreen(cam: OrreryCamera, x: number, y: number): { x: number; y: number } {
  return { x: x * cam.scale + cam.cx, y: y * cam.scale + cam.cy };
}

/** Screen point to world point — the repo's `screenToContent`, with the camera's field names. */
export function screenToWorld(cam: OrreryCamera, sx: number, sy: number): { x: number; y: number } {
  return screenToContent(toViewport(cam), sx, sy);
}

/**
 * Polar to world. `rot` is the wheel's own rotation, carried by the camera contract and 0 in this
 * port (the winner has no rotation control); it is applied HERE and inverted in
 * {@link worldToPolar}, so if a rotation control is ever added nothing else has to learn about it.
 */
export function polarToWorld(cam: OrreryCamera, r: number, a: number): { x: number; y: number } {
  const t = a + cam.rot;
  return { x: Math.cos(t) * r, y: Math.sin(t) * r };
}

/** World to polar, the exact inverse of {@link polarToWorld}. */
export function worldToPolar(cam: OrreryCamera, x: number, y: number): { r: number; a: number } {
  return { r: Math.hypot(x, y), a: Math.atan2(y, x) - cam.rot };
}

/**
 * The camera that fits a scene of radius `extent` into a `w` x `h` stage.
 *
 * The vertical centre is pushed down by the top chrome's reserve rather than being the geometric
 * middle — the winner's choice, kept, because the breadcrumbs and badges live over the stage.
 */
export function fitCamera(
  extent: number,
  w: number,
  h: number,
  focus: number,
  rot = 0,
): OrreryCamera {
  const availH = Math.max(1, h - TOP_RESERVE);
  const size = Math.max(1, Math.min(w - SIDE_INSET, availH));
  const scale = size / 2 / Math.max(1, extent);
  const centred = panToCenter(scale, w, availH, 0, 0);
  return { cx: centred.panX, cy: TOP_OFFSET + centred.panY + 4, scale, focus, rot };
}

/** Zoom bounds, relative to the scale that fits the whole scene. */
export function zoomLimits(fitScale: number, isDial: boolean): ZoomLimits {
  const f = fitScale > 0 ? fitScale : 1;
  return { lo: f * ZOOM_OUT_LIMIT, hi: f * (isDial ? ZOOM_IN_LIMIT_DIAL : ZOOM_IN_LIMIT_WHEEL) };
}

/** Clamp a scale into fit-relative limits. The Orrery's replacement for a fixed-range clamp. */
export function clampCameraScale(scale: number, limits: ZoomLimits): number {
  if (!Number.isFinite(scale)) return limits.lo;
  return Math.min(limits.hi, Math.max(limits.lo, scale));
}

/**
 * Zoom by `factor`, keeping the world point under screen point (`sx`, `sy`) exactly where it is.
 *
 * This is the invariant acceptance criterion 4 asks for: `screenToWorld` of the anchor is the same
 * before and after, to float precision, which is what "content must not drift toward a corner"
 * means in arithmetic. It holds at the clamp too — when the scale saturates, the pan is recomputed
 * from the scale that was actually applied, not the one that was requested.
 */
export function zoomAtScreenPoint(
  cam: OrreryCamera,
  factor: number,
  sx: number,
  sy: number,
  limits: ZoomLimits,
): OrreryCamera {
  const scale = clampCameraScale(cam.scale * factor, limits);
  const ratio = scale / cam.scale;
  return {
    ...cam,
    scale,
    cx: sx - (sx - cam.cx) * ratio,
    cy: sy - (sy - cam.cy) * ratio,
  };
}

/** A camera that puts world point (`wx`, `wy`) at the centre of a `w` x `h` stage at `scale`. */
export function centreOn(
  cam: OrreryCamera,
  scale: number,
  w: number,
  h: number,
  wx: number,
  wy: number,
): OrreryCamera {
  const p = panToCenter(scale, w, h, wx, wy);
  return { ...cam, scale, cx: p.panX, cy: p.panY };
}

/**
 * The world region to draw, with an overscan margin so a pan can blit from a bitmap wider than the
 * stage instead of re-baking. Culling tests against this rect.
 *
 * Expressed as two `screenToWorld` calls at the overscanned corners, so the culler and the pointer
 * read the same conversion and cannot disagree about where the viewport is.
 */
export function cullRect(
  cam: OrreryCamera,
  w: number,
  h: number,
  overscanX: number,
  overscanY: number,
): WorldRect {
  const tl = screenToWorld(cam, -overscanX, -overscanY);
  const br = screenToWorld(cam, w + overscanX, h + overscanY);
  return { x0: tl.x, y0: tl.y, x1: br.x, y1: br.y };
}

/**
 * The cull rect expressed in the frame the draw passes work in.
 *
 * A draw pass works in POLAR terms (`ctx.arc` around the origin) and the camera's `rot` is applied
 * once, as a rotation in the canvas transform — so the rect the culler compares against has to be
 * un-rotated too. At `rot = 0`, which is this port, that is the identity; for any other rotation it
 * returns the axis-aligned bound of the rotated rect, which is conservative (it can only draw more
 * than needed, never cull something visible).
 */
export function drawFrameRect(
  cam: OrreryCamera,
  w: number,
  h: number,
  overscanX: number,
  overscanY: number,
): WorldRect {
  const rect = cullRect(cam, w, h, overscanX, overscanY);
  if (cam.rot === 0) return rect;
  const c = Math.cos(-cam.rot);
  const s = Math.sin(-cam.rot);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of [
    [rect.x0, rect.y0],
    [rect.x1, rect.y0],
    [rect.x0, rect.y1],
    [rect.x1, rect.y1],
  ]) {
    const rx = x * c - y * s;
    const ry = x * s + y * c;
    if (rx < x0) x0 = rx;
    if (rx > x1) x1 = rx;
    if (ry < y0) y0 = ry;
    if (ry > y1) y1 = ry;
  }
  return { x0, x1, y0, y1 };
}

/** Linear camera interpolation, with the scale moving in log space so a glide feels even. */
export function lerpCamera(a: OrreryCamera, b: OrreryCamera, t: number, logScale: boolean): OrreryCamera {
  const m = (x: number, y: number) => x + (y - x) * t;
  const scale =
    logScale && a.scale > 0 && b.scale > 0 ? a.scale * Math.pow(b.scale / a.scale, t) : m(a.scale, b.scale);
  return { cx: m(a.cx, b.cx), cy: m(a.cy, b.cy), scale, focus: b.focus, rot: m(a.rot, b.rot) };
}

/** The winner's one easing curve: cubic in, cubic out. */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
