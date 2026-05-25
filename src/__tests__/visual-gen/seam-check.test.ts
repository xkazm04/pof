import { describe, it, expect, vi, afterEach } from 'vitest';
import sharp from 'sharp';
import { detectSeams, detectSeamsSafe, detectSeamsFromUrl, DEFAULT_SEAM_THRESHOLD } from '@/lib/visual-gen/seam-check';

/** Build a WxH RGB PNG from a per-pixel color function. */
async function makePng(
  w: number,
  h: number,
  color: (x: number, y: number) => [number, number, number],
): Promise<Uint8Array> {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = color(x, y);
      const i = (y * w + x) * 3;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
  }
  const png = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  return new Uint8Array(png);
}

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

describe('detectSeams', () => {
  it('reports no seam for a uniform tile', async () => {
    const img = await makePng(16, 16, () => [120, 120, 120]);
    const r = await detectSeams(img);
    expect(r.hasSeam).toBe(false);
    expect(r.horizontal.delta).toBeLessThan(DEFAULT_SEAM_THRESHOLD);
    expect(r.vertical.delta).toBeLessThan(DEFAULT_SEAM_THRESHOLD);
    expect(r.worstEdge).toBeUndefined();
  });

  it('flags a horizontal seam when the left and right columns differ', async () => {
    // black left column, white right column → won't wrap left↔right
    const img = await makePng(16, 16, (x) => {
      const v = x === 0 ? 0 : x === 15 ? 255 : 128;
      return [v, v, v];
    });
    const r = await detectSeams(img);
    expect(r.horizontal.seam).toBe(true);
    expect(r.vertical.seam).toBe(false);
    expect(r.hasSeam).toBe(true);
    expect(r.worstEdge).toBe('left edge');
  });

  it('flags a vertical seam when the top and bottom rows differ', async () => {
    const img = await makePng(16, 16, (_x, y) => {
      const v = y === 0 ? 0 : y === 15 ? 255 : 128;
      return [v, v, v];
    });
    const r = await detectSeams(img);
    expect(r.vertical.seam).toBe(true);
    expect(r.horizontal.seam).toBe(false);
    expect(r.hasSeam).toBe(true);
    expect(r.worstEdge).toBe('top edge');
  });

  it('respects a custom threshold', async () => {
    // a ~0.12 normalized edge delta: under a lenient threshold, over a strict one
    const img = await makePng(16, 16, (x) => {
      const v = x === 0 ? 110 : x === 15 ? 140 : 128;
      return [v, v, v];
    });
    const lenient = await detectSeams(img, { threshold: 0.5 });
    expect(lenient.hasSeam).toBe(false);
    const strict = await detectSeams(img, { threshold: 0.01 });
    expect(strict.horizontal.seam).toBe(true);
  });
});

describe('detectSeamsSafe', () => {
  it('returns a result for valid image bytes', async () => {
    const img = await makePng(16, 16, () => [10, 10, 10]);
    const r = await detectSeamsSafe(img);
    expect(r).not.toBeNull();
    expect(r?.hasSeam).toBe(false);
  });

  it('returns null for undecodable bytes (never throws)', async () => {
    const r = await detectSeamsSafe(new Uint8Array([1, 2, 3]));
    expect(r).toBeNull();
  });
});

describe('detectSeamsFromUrl', () => {
  it('returns null when the fetch fails (never throws)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const r = await detectSeamsFromUrl('https://cdn/missing.png');
    expect(r).toBeNull();
  });

  it('returns null when fetch itself rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
    const r = await detectSeamsFromUrl('https://cdn/missing.png');
    expect(r).toBeNull();
  });

  it('runs the seam check on fetched bytes', async () => {
    const img = await makePng(16, 16, () => [120, 120, 120]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => img.buffer.slice(img.byteOffset, img.byteOffset + img.byteLength),
    }) as unknown as typeof fetch;
    const r = await detectSeamsFromUrl('https://cdn/albedo.png');
    expect(r).not.toBeNull();
    expect(r?.hasSeam).toBe(false);
  });
});
