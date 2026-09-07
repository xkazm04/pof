/**
 * Scene cropping — the step that makes the existing Tier-0 input gate usable on a SCENE.
 *
 * `gateInputImage` scores an image against "exactly one subject, no scene clutter". A
 * scene photograph fails that by construction, so the gate is unusable on the very input
 * the decomposer starts from. Cropping each decomposed prop out first is what makes the
 * per-prop gate meaningful: each crop is a single-subject concept again.
 *
 * These tests run REAL sharp against REAL pixel buffers — the assertions are on the
 * produced image's own metadata, not on a mock's argv.
 */
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  boxToPixelRect,
  cropPropRegion,
  cropToVisionImage,
} from '@/lib/visual-gen/scene-crop';

/** A 400x200 solid-colour PNG to crop out of. */
async function scene(width = 400, height = 200): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 90, b: 140 } },
  })
    .png()
    .toBuffer();
}

const BOX = { x0: 0.25, y0: 0.5, x1: 0.5, y1: 1 };

describe('boxToPixelRect', () => {
  it('maps a normalized box onto pixel coordinates', () => {
    expect(boxToPixelRect(BOX, 400, 200, 0)).toEqual({ left: 100, top: 100, width: 100, height: 100 });
  });

  it('grows the rect by the padding fraction of its own size', () => {
    // 10% of a 100px-wide rect = 10px each side.
    const r = boxToPixelRect(BOX, 400, 200, 0.1);
    expect(r.left).toBe(90);
    expect(r.width).toBe(120);
  });

  it('clamps padding at the image edge instead of asking sharp for out-of-bounds pixels', () => {
    const r = boxToPixelRect({ x0: 0, y0: 0.9, x1: 0.1, y1: 1 }, 400, 200, 0.5);
    expect(r.left).toBe(0);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.left + r.width).toBeLessThanOrEqual(400);
    expect(r.top + r.height).toBeLessThanOrEqual(200);
  });

  it('never produces a zero-size rect for a degenerate box', () => {
    const r = boxToPixelRect({ x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.5 }, 400, 200, 0);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});

describe('cropPropRegion', () => {
  // `minPx` is pinned below the crop size in these two so the default 256px upscale
  // (asserted on its own further down) does not confound the geometry assertions.
  it('produces a real PNG of the requested region', async () => {
    const out = await cropPropRegion(await scene(), BOX, { padding: 0, minPx: 64 });
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it('honours the padding fraction in the produced pixels', async () => {
    const out = await cropPropRegion(await scene(), BOX, { padding: 0.1, minPx: 64 });
    expect((await sharp(out).metadata()).width).toBe(120);
  });

  it('upscales a tiny crop to the gate-legible floor', async () => {
    // A 4x4 crop tells a VLM nothing; the crop must be at least MIN_CROP_PX on its long side.
    const out = await cropPropRegion(await scene(), { x0: 0, y0: 0, x1: 0.01, y1: 0.02 }, { padding: 0, minPx: 128 });
    const meta = await sharp(out).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeGreaterThanOrEqual(128);
  });

  it('does not upscale a crop that is already large enough', async () => {
    const out = await cropPropRegion(await scene(), BOX, { padding: 0, minPx: 64 });
    expect((await sharp(out).metadata()).width).toBe(100);
  });

  it('rejects a buffer that is not an image with a reason rather than throwing raw', async () => {
    await expect(cropPropRegion(Buffer.from('not an image'), BOX, {})).rejects.toThrow(/crop/i);
  });
});

describe('cropToVisionImage', () => {
  it('returns the shape the input gate seam consumes', async () => {
    const img = cropToVisionImage(await cropPropRegion(await scene(), BOX, {}));
    expect(img.mime).toBe('image/png');
    expect(img.base64.length).toBeGreaterThan(0);
    // Must be decodable base64 of a real PNG (\x89PNG magic).
    expect(Buffer.from(img.base64, 'base64').subarray(1, 4).toString()).toBe('PNG');
  });
});
