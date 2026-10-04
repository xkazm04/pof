/**
 * Canvas primitives shared by the draw passes, and the one bitmap the wheel owns besides its layers:
 * the hatch pattern that means "never measured".
 *
 * Everything here takes its colours as arguments. The hatch is a pattern, not a colour, which is why
 * `Fill` in `lod.ts` is a two-case union rather than a string — an unmeasured sector has to be
 * visibly a different KIND of thing from a measured one, not a darker shade of it, or the single
 * easiest honesty rule in this port is lost.
 */

import { TAU } from '@/components/story/orrery/render/geometry';
import type { Fill } from '@/components/story/orrery/render/lod';
import type { OrreryPalette } from '@/components/story/orrery/render/palette';

export interface DrawStats {
  /** Ring segments actually painted after culling. */
  drawn: number;
  /** Folded blocks painted, each standing for a whole subtree. */
  blocks: number;
  /** Chord lines painted. */
  chords: number;
  /** Rim units considered. */
  units: number;
  /** Labels that fitted and were drawn. */
  labels: number;
  /** The LOD bands this bake used. */
  rimDepth: number;
  chordDepth: number;
  /** The scale the bake was taken at. */
  scale: number;
  /** Milliseconds the bake took. */
  ms: number;
}

export function emptyStats(): DrawStats {
  return {
    drawn: 0,
    blocks: 0,
    chords: 0,
    units: 0,
    labels: 0,
    rimDepth: 0,
    chordDepth: 0,
    scale: 1,
    ms: 0,
  };
}

/** An annulus sector as a closed path: out along `r1`, back along `r0`. */
export function segmentPath(
  ctx: CanvasRenderingContext2D,
  a0: number,
  a1: number,
  r0: number,
  r1: number,
): void {
  ctx.beginPath();
  ctx.arc(0, 0, r1, a0, a1);
  ctx.arc(0, 0, r0, a1, a0, true);
  ctx.closePath();
}

/** Apply a `Fill`, substituting the hatch pattern for the unmeasured case. */
export function applyFill(
  ctx: CanvasRenderingContext2D,
  fill: Fill,
  hatch: CanvasPattern | null,
  fallback: string,
): string {
  if (fill.kind === 'hatch') {
    ctx.fillStyle = hatch ?? fallback;
    return fallback;
  }
  ctx.fillStyle = fill.css;
  return fill.css;
}

/**
 * The "never measured" hatch: diagonal strokes on the theme's deepest surface, built at the device
 * pixel ratio so it does not soften on a retina display. Rebuilt only when the ratio or the theme
 * changes.
 */
export function makeHatchPattern(
  ctx: CanvasRenderingContext2D,
  palette: OrreryPalette,
  dpr: number,
): CanvasPattern | null {
  const size = Math.max(4, Math.round(8 * dpr));
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const g = tile.getContext('2d');
  if (!g) return null;
  g.fillStyle = palette.hatch.ground;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = palette.hatch.ink;
  g.lineWidth = 1.4 * dpr;
  g.beginPath();
  g.moveTo(0, size);
  g.lineTo(size, 0);
  g.moveTo(-size / 2, size / 2);
  g.lineTo(size / 2, -size / 2);
  g.moveTo(size / 2, size * 1.5);
  g.lineTo(size * 1.5, size / 2);
  g.stroke();
  return ctx.createPattern(tile, 'repeat');
}

/**
 * Keep the hatch at a constant SCREEN size while the world transform scales. Without this the
 * pattern zooms with the wheel and a hatched sector at 30x reads as a solid block.
 */
export function rescaleHatch(pattern: CanvasPattern | null, scale: number, dpr: number): void {
  if (!pattern || typeof pattern.setTransform !== 'function' || typeof DOMMatrix === 'undefined') return;
  const k = 1 / (scale * dpr);
  try {
    pattern.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  } catch {
    // A DOM that cannot take a pattern matrix simply gets a scaling hatch; it is still a hatch.
  }
}

/**
 * Draw text bent along an arc, one glyph at a time. Each glyph is measured so the run is centred on
 * `angle` rather than drifting, and the whole string flips when it would otherwise read upside down
 * in the lower half of the wheel.
 */
export function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): void {
  if (radius <= 0) return;
  const flip = Math.sin(angle) > 0;
  const width = ctx.measureText(text).width;
  let pos = -width / 2;
  const half = Math.PI / 2;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    const mid = pos + w / 2;
    const t = flip ? angle - mid / radius : angle + mid / radius;
    ctx.save();
    ctx.translate(cx + Math.cos(t) * radius, cy + Math.sin(t) * radius);
    ctx.rotate(flip ? t - half : t + half);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    pos += w;
  }
}

/** A filled triangle head at (`x`, `y`), pointing away from (`fromX`, `fromY`). */
export function arrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  x: number,
  y: number,
  size: number,
): void {
  const a = Math.atan2(y - fromY, x - fromX);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(a - 0.4) * size, y - Math.sin(a - 0.4) * size);
  ctx.lineTo(x - Math.cos(a + 0.4) * size, y - Math.sin(a + 0.4) * size);
  ctx.closePath();
  ctx.fill();
}

/** A full circle path. */
export function circlePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}
