// ── Pan / zoom / minimap math for the Audio Scene Painter ──
//
// Pure, DOM-free geometry so the painter's viewport behaviour (zoom-around-cursor,
// fit-to-content, minimap projection) is unit-testable in isolation. The painter
// keeps a single {@link Viewport} in state and applies it as a `translate … scale`
// transform on the inner SVG `<g>`; everything here operates in that same space.
//
// Coordinate spaces:
//   • content — the scene's own units (zone/emitter x/y).
//   • screen  — pixels inside the SVG, with the painter transform applied:
//                 screen = pan + zoom · content    ⇒    content = (screen − pan) / zoom

import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Zoom limits — small floor so a 20+-zone level still fits, modest ceiling for detail work. */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
/** Multiplicative step for the +/- buttons and keyboard shortcuts. */
export const ZOOM_STEP = 1.2;

export const IDENTITY_VIEW: Viewport = { zoom: 1, panX: 0, panY: 0 };

/** Clamp a zoom factor into the supported range. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Content-space bounding box that encloses every zone and emitter, or `null` when
 * the scene is empty. Circle zones are bounded by their radius, rect zones by their
 * extent, and emitters by a small glyph margin so their dots never sit on the edge.
 */
export function contentBounds(zones: AudioZone[], emitters: SoundEmitter[]): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x0: number, y0: number, x1: number, y1: number) => {
    if (x0 < minX) minX = x0;
    if (y0 < minY) minY = y0;
    if (x1 > maxX) maxX = x1;
    if (y1 > maxY) maxY = y1;
  };

  for (const z of zones) {
    if (z.shape === 'circle') {
      const r = z.width / 2;
      acc(z.x - r, z.y - r, z.x + r, z.y + r);
    } else {
      acc(z.x, z.y, z.x + z.width, z.y + z.height);
    }
  }
  for (const e of emitters) {
    acc(e.x - 10, e.y - 10, e.x + 10, e.y + 10);
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/** Width of a bounds rect (≥1 to avoid divide-by-zero on degenerate scenes). */
export function boundsWidth(b: Bounds): number {
  return Math.max(1, b.maxX - b.minX);
}

/** Height of a bounds rect (≥1 to avoid divide-by-zero on degenerate scenes). */
export function boundsHeight(b: Bounds): number {
  return Math.max(1, b.maxY - b.minY);
}

/** Smallest bounds containing both inputs; passes through whichever side is `null`. */
export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/**
 * Zoom to `nextZoom` while keeping the content point currently under screen point
 * (`screenX`, `screenY`) anchored there — the basis for wheel-zoom-around-cursor.
 */
export function zoomAtPoint(view: Viewport, nextZoom: number, screenX: number, screenY: number): Viewport {
  const zoom = clampZoom(nextZoom);
  const contentX = (screenX - view.panX) / view.zoom;
  const contentY = (screenY - view.panY) / view.zoom;
  return {
    zoom,
    panX: screenX - contentX * zoom,
    panY: screenY - contentY * zoom,
  };
}

/** {@link zoomAtPoint} expressed as a multiply of the current zoom (button / wheel step). */
export function zoomByFactor(view: Viewport, factor: number, screenX: number, screenY: number): Viewport {
  return zoomAtPoint(view, view.zoom * factor, screenX, screenY);
}

/** Convert a screen point to content coordinates under the given viewport. */
export function screenToContent(view: Viewport, screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: (screenX - view.panX) / view.zoom,
    y: (screenY - view.panY) / view.zoom,
  };
}

/** Pan that centres content point (`contentX`, `contentY`) in a `viewW`×`viewH` viewport. */
export function panToCenter(
  zoom: number,
  viewW: number,
  viewH: number,
  contentX: number,
  contentY: number,
): { panX: number; panY: number } {
  return {
    panX: viewW / 2 - contentX * zoom,
    panY: viewH / 2 - contentY * zoom,
  };
}

/**
 * Viewport+zoom that fits `bounds` inside a `viewW`×`viewH` canvas with `padding`
 * pixels of breathing room, centred. Returns identity when there is nothing to fit.
 */
export function fitView(bounds: Bounds | null, viewW: number, viewH: number, padding = 48): Viewport {
  if (!bounds || viewW <= 0 || viewH <= 0) return IDENTITY_VIEW;
  const w = boundsWidth(bounds);
  const h = boundsHeight(bounds);
  const zoom = clampZoom(Math.min((viewW - 2 * padding) / w, (viewH - 2 * padding) / h));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const { panX, panY } = panToCenter(zoom, viewW, viewH, cx, cy);
  return { zoom, panX, panY };
}

/** The region currently visible in the canvas, expressed in content coordinates. */
export function viewportRectInContent(view: Viewport, viewW: number, viewH: number): Bounds {
  const tl = screenToContent(view, 0, 0);
  return {
    minX: tl.x,
    minY: tl.y,
    maxX: tl.x + viewW / view.zoom,
    maxY: tl.y + viewH / view.zoom,
  };
}

export interface MinimapProjection {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Uniform fit of world `bounds` into a `mapW`×`mapH` minimap with `pad` pixels of
 * inset, centred on the shorter axis. Project a content point with:
 *   mapX = offsetX + contentX · scale     mapY = offsetY + contentY · scale
 */
export function minimapProjection(bounds: Bounds, mapW: number, mapH: number, pad = 6): MinimapProjection {
  const w = boundsWidth(bounds);
  const h = boundsHeight(bounds);
  const scale = Math.min((mapW - 2 * pad) / w, (mapH - 2 * pad) / h);
  const extraX = ((mapW - 2 * pad) - w * scale) / 2;
  const extraY = ((mapH - 2 * pad) - h * scale) / 2;
  return {
    scale,
    offsetX: pad - bounds.minX * scale + extraX,
    offsetY: pad - bounds.minY * scale + extraY,
  };
}

/** Inverse of a {@link MinimapProjection}: minimap-local point → content coordinates. */
export function minimapToContent(proj: MinimapProjection, mapX: number, mapY: number): { x: number; y: number } {
  return {
    x: (mapX - proj.offsetX) / proj.scale,
    y: (mapY - proj.offsetY) / proj.scale,
  };
}
