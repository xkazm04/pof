/**
 * Texture-map derivation — server-side only.
 *
 * Derives a tangent-space normal map from an albedo by treating luminance as a
 * height field and running a wrap-around Sobel filter. Wrap-around sampling
 * keeps a tileable albedo's normal map tileable too.
 */
import sharp from 'sharp';

export interface DeriveNormalOptions {
  /** Bump intensity. Higher = stronger relief. Default 2. */
  strength?: number;
}

export async function deriveNormalFromAlbedo(
  albedo: Uint8Array,
  opts: DeriveNormalOptions = {},
): Promise<Uint8Array> {
  const strength = opts.strength ?? 2;

  const { data, info } = await sharp(Buffer.from(albedo))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels; // greyscale → 1

  // height at (x,y) in 0..1, with wrap-around sampling
  const at = (x: number, y: number): number => {
    const xx = ((x % w) + w) % w;
    const yy = ((y % h) + h) % h;
    return data[(yy * w + xx) * ch] / 255;
  };

  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx =
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;

      const i = (y * w + x) * 3;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }

  const png = await sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  return new Uint8Array(png);
}
