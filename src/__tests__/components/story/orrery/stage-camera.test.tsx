import { describe, it, expect } from 'vitest';
import {
  ZOOM_IN_LIMIT_WHEEL,
  ZOOM_OUT_LIMIT,
  clampCameraScale,
  cullRect,
  drawFrameRect,
  ease,
  fitCamera,
  lerpCamera,
  polarToWorld,
  screenToWorld,
  worldToPolar,
  worldToScreen,
  zoomAtScreenPoint,
  zoomLimits,
} from '@/components/story/orrery/render/camera';
import {
  angleAt,
  lerpViewState,
  sectorTouchesRect,
  unitAt,
  viewStateFor,
  wheelOuter,
} from '@/components/story/orrery/render/geometry';
import { MAX_ZOOM, clampZoom, zoomAtPoint } from '@/lib/audio-scene-viewport';
import type { OrreryCamera } from '@/lib/story/orrery';

const cam = (over: Partial<OrreryCamera> = {}): OrreryCamera => ({
  cx: 640,
  cy: 400,
  scale: 0.8,
  focus: 0,
  rot: 0,
  ...over,
});

describe('the camera is one coordinate authority', () => {
  it('round-trips screen and world through the shared viewport invariant', () => {
    const c = cam({ cx: 123, cy: -45, scale: 1.7 });
    for (const [x, y] of [
      [0, 0],
      [800, 600],
      [-200, 90],
      [17.5, 913.25],
    ]) {
      const w = screenToWorld(c, x, y);
      const back = worldToScreen(c, w.x, w.y);
      expect(back.x).toBeCloseTo(x, 9);
      expect(back.y).toBeCloseTo(y, 9);
    }
  });

  it('round-trips polar and world, rotation included', () => {
    for (const rot of [0, 0.4, -1.9]) {
      const c = cam({ rot });
      const p = polarToWorld(c, 310, 1.2);
      const back = worldToPolar(c, p.x, p.y);
      expect(back.r).toBeCloseTo(310, 9);
      expect(Math.cos(back.a)).toBeCloseTo(Math.cos(1.2), 9);
      expect(Math.sin(back.a)).toBeCloseTo(Math.sin(1.2), 9);
    }
  });

  it('round-trips a unit position through the angle mapping', () => {
    const vs = { w0: 0.25, w1: 0.75, base: 2, T: 92, L: 3 };
    for (const u of [0.25, 0.3, 0.5, 0.7499]) {
      expect(unitAt(angleAt(u, vs), vs)).toBeCloseTo(u, 9);
    }
  });
});

describe('zoom is anchored to the cursor and does not drift', () => {
  it('keeps the world point under the cursor fixed, in and out, over many steps', () => {
    const limits = zoomLimits(0.8, false);
    let c = cam();
    const anchor = { x: 311, y: 207 };
    const before = screenToWorld(c, anchor.x, anchor.y);
    for (const factor of [1.3, 1.3, 1.3, 0.7, 1.9, 0.5, 1.1]) {
      c = zoomAtScreenPoint(c, factor, anchor.x, anchor.y, limits);
      const after = screenToWorld(c, anchor.x, anchor.y);
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
    }
  });

  it('still anchors when the scale saturates at either limit', () => {
    const limits = zoomLimits(0.8, false);
    const anchor = { x: 55, y: 700 };
    for (const factor of [1e6, 1e-6]) {
      const start = cam();
      const before = screenToWorld(start, anchor.x, anchor.y);
      const next = zoomAtScreenPoint(start, factor, anchor.x, anchor.y, limits);
      const after = screenToWorld(next, anchor.x, anchor.y);
      // The pan is recomputed from the scale actually applied, so the anchor holds at the clamp.
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
      expect(next.scale).toBeGreaterThanOrEqual(limits.lo - 1e-12);
      expect(next.scale).toBeLessThanOrEqual(limits.hi + 1e-12);
    }
  });

  it('clamps relative to the fit scale, which is why the shared clamp could not be reused', () => {
    // The wheel dives to 36x fit. At the synthetic document's fit scale (~0.8) that is ~28
    // absolute, and `clampZoom` in @/lib/audio-scene-viewport caps at 4 — so a reused
    // `zoomAtPoint` would stop the dive about a seventh of the way in. This is the evidence.
    const fit = 0.8;
    const limits = zoomLimits(fit, false);
    expect(limits.hi).toBeCloseTo(fit * ZOOM_IN_LIMIT_WHEEL, 10);
    expect(limits.lo).toBeCloseTo(fit * ZOOM_OUT_LIMIT, 10);
    expect(limits.hi).toBeGreaterThan(MAX_ZOOM);
    expect(clampZoom(limits.hi)).toBe(MAX_ZOOM);
    expect(zoomAtPoint({ zoom: fit, panX: 0, panY: 0 }, limits.hi, 10, 10).zoom).toBe(MAX_ZOOM);
    // The Orrery clamp admits it.
    expect(clampCameraScale(limits.hi, limits)).toBeCloseTo(limits.hi, 10);
  });

  it('clamps a non-finite scale to the floor rather than propagating NaN', () => {
    const limits = zoomLimits(1, false);
    expect(clampCameraScale(Number.NaN, limits)).toBe(limits.lo);
  });
});

describe('fit', () => {
  it('fits the scene inside the stage and reserves the top chrome', () => {
    const extent = 526;
    const c = fitCamera(extent, 1280, 800, 0);
    // The whole scene fits across the stage.
    expect(extent * 2 * c.scale).toBeLessThanOrEqual(1280);
    // The wheel's centre sits below the geometric middle, where the winner put it, because the
    // breadcrumbs and badges float over the top of the stage.
    expect(c.cx).toBeCloseTo(640, 6);
    expect(c.cy).toBeGreaterThan(400);
  });

  it('never divides by a zero extent or a zero stage', () => {
    for (const [e, w, h] of [
      [0, 1280, 800],
      [500, 0, 0],
    ]) {
      const c = fitCamera(e, w, h, 0);
      expect(Number.isFinite(c.scale)).toBe(true);
      expect(Number.isFinite(c.cx)).toBe(true);
      expect(Number.isFinite(c.cy)).toBe(true);
    }
  });
});

describe('culling', () => {
  it('expands the visible rect by the overscan, in world units', () => {
    const c = cam({ scale: 2 });
    const tight = cullRect(c, 1000, 600, 0, 0);
    const loose = cullRect(c, 1000, 600, 100, 50);
    expect(loose.x0).toBeCloseTo(tight.x0 - 100 / 2, 9);
    expect(loose.x1).toBeCloseTo(tight.x1 + 100 / 2, 9);
    expect(loose.y0).toBeCloseTo(tight.y0 - 50 / 2, 9);
    expect(loose.y1).toBeCloseTo(tight.y1 + 50 / 2, 9);
  });

  it('is the identity at rot 0 and conservative otherwise', () => {
    const plain = drawFrameRect(cam(), 1000, 600, 60, 40);
    expect(plain).toEqual(cullRect(cam(), 1000, 600, 60, 40));
    const spun = drawFrameRect(cam({ rot: 0.7 }), 1000, 600, 60, 40);
    const area = (r: typeof spun) => (r.x1 - r.x0) * (r.y1 - r.y0);
    expect(area(spun)).toBeGreaterThanOrEqual(area(plain) - 1e-6);
  });

  it('rejects a sector outside the rect and keeps one that crosses an axis inside it', () => {
    const rect = { x0: -100, x1: 100, y0: -100, y1: 100 };
    // Far away, and on the far side.
    expect(sectorTouchesRect(0, 0.2, 400, 420, rect)).toBe(false);
    // Spanning the top of the circle: its bounding box must include the y extreme at -r, which a
    // corners-only box would miss.
    expect(sectorTouchesRect(-Math.PI / 2 - 0.3, -Math.PI / 2 + 0.3, 90, 95, rect)).toBe(true);
  });
});

describe('the glide', () => {
  it('eases from 0 to 1 and is monotonic', () => {
    expect(ease(0)).toBeCloseTo(0, 9);
    expect(ease(1)).toBeCloseTo(1, 9);
    let last = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = ease(Math.min(1, t));
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('moves the scale in log space for a focus glide, so the dive feels even', () => {
    const from = cam({ scale: 0.8 });
    const to = cam({ scale: 0.8 * 16, cx: 10, cy: 20 });
    const half = lerpCamera(from, to, 0.5, true);
    expect(half.scale).toBeCloseTo(0.8 * 4, 9);
    const linear = lerpCamera(from, to, 0.5, false);
    expect(linear.scale).toBeCloseTo((0.8 + 0.8 * 16) / 2, 9);
  });

  it('interpolates a view state end to end', () => {
    const a = { w0: 0, w1: 1, base: 0, T: 136, L: 1 };
    const b = { w0: 0.2, w1: 0.4, base: 2, T: 78, L: 4 };
    expect(lerpViewState(a, b, 0)).toEqual(a);
    expect(lerpViewState(a, b, 1)).toEqual(b);
    const mid = lerpViewState(a, b, 0.5);
    expect(mid.w0).toBeCloseTo(0.1, 9);
    expect(mid.T).toBeCloseTo(107, 9);
  });
});

describe('geometry agrees with the layout core', () => {
  it('derives the outer radius from the hub and the ring thickness', () => {
    const model = {
      R: [{ u0: 0, u1: 1, depth: 0, maxd: 3 }],
    } as unknown as Parameters<typeof viewStateFor>[0];
    const vs = viewStateFor(model, 0);
    expect(vs.L).toBe(3);
    expect(vs.T).toBe(92);
    expect(wheelOuter(vs)).toBe(118 + 3 * 92);
  });
});
