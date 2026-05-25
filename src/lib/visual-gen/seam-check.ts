/**
 * Tileability / seam detection — server-side only.
 *
 * AI "tiling:true" outputs (Leonardo) and "seamless PBR" tiles (Scenario) are
 * best-effort: roughly 1 in 4 has a visible seam that only becomes obvious once
 * the tile is repeated across a surface in-engine — costing a full import → build
 * → look cycle to discover. This runs a wrap-around edge diff with sharp (the same
 * dependency texture-maps.ts already uses) right after generation:
 *
 *   - horizontal wrap: the left column (x=0) is compared against the right column
 *     (x=w-1). When tiled, those columns sit next to each other, so a large mean
 *     color/luma delta there shows up as a vertical seam at the left/right edge.
 *   - vertical wrap: the top row (y=0) is compared against the bottom row (y=h-1)
 *     — a mismatch is a horizontal seam at the top/bottom edge.
 *
 * Deltas are mean absolute per-channel differences normalized to 0..1 (0 = the
 * edges wrap perfectly). An axis above the threshold is flagged.
 */
import sharp from 'sharp';
import { logger } from '@/lib/logger';

/** Which wrap-around edge a seam shows up on. */
export type SeamAxis = 'left' | 'top';

export interface SeamAxisResult {
  /** 'left' = horizontal wrap (left↔right columns); 'top' = vertical wrap (top↔bottom rows). */
  axis: SeamAxis;
  /** Mean per-pixel edge delta, normalized 0..1 (0 = a perfect wrap). */
  delta: number;
  /** True when `delta` exceeds the threshold. */
  seam: boolean;
}

export interface SeamCheckResult {
  /** Horizontal wrap — a mismatch is a vertical seam at the left/right edge. */
  horizontal: SeamAxisResult;
  /** Vertical wrap — a mismatch is a horizontal seam at the top/bottom edge. */
  vertical: SeamAxisResult;
  /** True when either axis is above threshold. */
  hasSeam: boolean;
  /** The normalized 0..1 threshold used. */
  threshold: number;
  /** Friendly label of the worst seam edge ("left edge" / "top edge"); undefined when clean. */
  worstEdge?: string;
}

export interface SeamCheckOptions {
  /** Normalized 0..1 mean-delta threshold above which an axis is flagged. Default 0.08. */
  threshold?: number;
}

/** ~20/255 mean per-channel edge difference — a conservative "visible seam" cutoff. */
export const DEFAULT_SEAM_THRESHOLD = 0.08;

/**
 * Run a wrap-around edge diff on an encoded image (PNG/JPG/WebP bytes).
 * Pure analysis — never mutates or re-uploads the image.
 */
export async function detectSeams(
  image: Uint8Array,
  opts: SeamCheckOptions = {},
): Promise<SeamCheckResult> {
  const threshold = opts.threshold ?? DEFAULT_SEAM_THRESHOLD;

  const { data, info } = await sharp(Buffer.from(image))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels; // RGB → 3 after removeAlpha (1 for greyscale)

  const channelAt = (x: number, y: number, c: number): number => data[(y * w + x) * ch + c];

  // Horizontal wrap: left column (x=0) vs right column (x=w-1), averaged over rows.
  let hSum = 0;
  for (let y = 0; y < h; y++) {
    let d = 0;
    for (let c = 0; c < ch; c++) d += Math.abs(channelAt(0, y, c) - channelAt(w - 1, y, c));
    hSum += d / ch;
  }
  const horizontalDelta = h > 0 ? hSum / h / 255 : 0;

  // Vertical wrap: top row (y=0) vs bottom row (y=h-1), averaged over columns.
  let vSum = 0;
  for (let x = 0; x < w; x++) {
    let d = 0;
    for (let c = 0; c < ch; c++) d += Math.abs(channelAt(x, 0, c) - channelAt(x, h - 1, c));
    vSum += d / ch;
  }
  const verticalDelta = w > 0 ? vSum / w / 255 : 0;

  const horizontal: SeamAxisResult = { axis: 'left', delta: horizontalDelta, seam: horizontalDelta > threshold };
  const vertical: SeamAxisResult = { axis: 'top', delta: verticalDelta, seam: verticalDelta > threshold };
  const hasSeam = horizontal.seam || vertical.seam;

  const worstEdge = hasSeam
    ? (horizontalDelta >= verticalDelta ? 'left edge' : 'top edge')
    : undefined;

  return { horizontal, vertical, hasSeam, threshold, worstEdge };
}

/**
 * Like {@link detectSeams} but returns `null` on any decode/analysis failure
 * instead of throwing — a seam check must never break the generation flow it
 * augments. Use this when the image bytes are already in hand (e.g. a downloaded
 * Leonardo generation).
 */
export async function detectSeamsSafe(
  image: Uint8Array,
  opts: SeamCheckOptions = {},
): Promise<SeamCheckResult | null> {
  try {
    return await detectSeams(image, opts);
  } catch (error) {
    logger.warn(`[seam-check] detectSeamsSafe failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Fetch an image by URL and run the seam check on its bytes. Returns `null` on any
 * failure (bad response, network error, decode error).
 */
export async function detectSeamsFromUrl(
  url: string,
  opts: SeamCheckOptions = {},
): Promise<SeamCheckResult | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await detectSeamsSafe(bytes, opts);
  } catch (error) {
    logger.warn(`[seam-check] detectSeamsFromUrl failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
