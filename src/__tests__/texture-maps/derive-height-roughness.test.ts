// @vitest-environment node
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { deriveHeightFromAlbedo, deriveRoughnessFromAlbedo } from '@/lib/texture-maps';

async function rawGrey(png: Uint8Array) {
  return sharp(Buffer.from(png)).greyscale().raw().toBuffer({ resolveWithObject: true });
}

async function stepAlbedo(w: number, h: number, dark: number, bright: number) {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x < w / 2 ? dark : bright;
      const i = (y * w + x) * 3;
      buf[i] = buf[i + 1] = buf[i + 2] = v;
    }
  }
  return new Uint8Array(await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer());
}

describe('deriveHeightFromAlbedo', () => {
  it('exports the luminance heightfield: bright albedo → high height, dark → low, dims preserved', async () => {
    const albedo = await stepAlbedo(8, 8, 40, 200);
    const height = await deriveHeightFromAlbedo(albedo);
    const { data, info } = await rawGrey(height);

    expect(info.width).toBe(8);
    expect(info.height).toBe(8);
    const dark = data[(4 * 8 + 1) * info.channels];
    const bright = data[(4 * 8 + 6) * info.channels];
    expect(bright).toBeGreaterThan(dark);
    expect(bright).toBeGreaterThan(150);
    expect(dark).toBeLessThan(100);
  });
});

describe('deriveRoughnessFromAlbedo', () => {
  it('defaults to inverted luminance: dark crevices read rougher than bright faces', async () => {
    const albedo = await stepAlbedo(8, 8, 40, 200);
    const rough = await deriveRoughnessFromAlbedo(albedo);
    const { data, info } = await rawGrey(rough);

    expect(info.width).toBe(8);
    expect(info.height).toBe(8);
    const overDark = data[(4 * 8 + 1) * info.channels];
    const overBright = data[(4 * 8 + 6) * info.channels];
    expect(overDark).toBeGreaterThan(overBright);
  });

  it('invert:false tracks luminance directly', async () => {
    const albedo = await stepAlbedo(8, 8, 40, 200);
    const rough = await deriveRoughnessFromAlbedo(albedo, { invert: false });
    const { data, info } = await rawGrey(rough);

    const overDark = data[(4 * 8 + 1) * info.channels];
    const overBright = data[(4 * 8 + 6) * info.channels];
    expect(overBright).toBeGreaterThan(overDark);
  });
});
