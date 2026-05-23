// @vitest-environment node
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { deriveNormalFromAlbedo } from '@/lib/texture-maps';

async function rawRGB(png: Uint8Array) {
  return sharp(Buffer.from(png)).raw().toBuffer({ resolveWithObject: true });
}

describe('deriveNormalFromAlbedo', () => {
  it('a flat albedo yields a flat normal (~128,128,255) and preserves dimensions', async () => {
    const flat = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();

    const normal = await deriveNormalFromAlbedo(new Uint8Array(flat));
    const { data, info } = await rawRGB(normal);

    expect(info.width).toBe(8);
    expect(info.height).toBe(8);
    const i = (4 * 8 + 4) * info.channels; // center pixel
    expect(data[i]).toBe(128);
    expect(data[i + 1]).toBe(128);
    expect(data[i + 2]).toBe(255);
  });

  it('a left-dark/right-bright step bends the normal X channel below 128 at the rising edge', async () => {
    const w = 8, h = 8;
    const buf = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = x < 4 ? 40 : 200;
        const i = (y * w + x) * 3;
        buf[i] = buf[i + 1] = buf[i + 2] = v;
      }
    }
    const albedo = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    const normal = await deriveNormalFromAlbedo(new Uint8Array(albedo), { strength: 4 });
    const { data, info } = await rawRGB(normal);

    const i = (4 * w + 3) * info.channels; // row 4, col 3 — the rising edge
    expect(data[i]).toBeLessThan(128);
  });
});
