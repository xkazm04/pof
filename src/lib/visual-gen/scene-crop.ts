/**
 * Scene cropping — what makes the Tier-0 input gate usable on a SCENE image.
 *
 * `gateInputImage` scores an image against "exactly one subject, no scene clutter, plain
 * background". A reference photograph of a trading post fails that by construction, so the
 * gate cannot be pointed at the very input the decomposer starts from. Cropping each
 * decomposed prop out of the scene restores the gate's premise: each crop is a
 * single-subject concept again, and a crop that still fails (occluded, clipped, too small
 * to read) is exactly the prop whose image→3D job would have produced a fragmented mesh.
 *
 * Real pixels via sharp — a crop is an artifact, not an argv.
 */
import sharp from 'sharp';
import type { VisionImage } from '@/lib/anim-critique/critique';
import type { NormalizedBox } from './generators/scene-decompose';

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CropOptions {
  /** Extra context around the box, as a fraction of the box's own size. Default 0.08. */
  padding?: number;
  /** Upscale so the long side reaches at least this many px. Default 256. */
  minPx?: number;
}

const DEFAULT_PADDING = 0.08;
const DEFAULT_MIN_PX = 256;

/**
 * Map a normalized box onto pixel coordinates, padded and clamped to the image. Pure.
 *
 * Clamping rather than letting sharp reject out-of-bounds extraction matters because the
 * boxes come from a VLM: a prop against the frame edge routinely pads past it, and that is
 * a normal input, not an error worth failing the whole scene over.
 */
export function boxToPixelRect(
  box: NormalizedBox,
  imageWidth: number,
  imageHeight: number,
  padding: number = DEFAULT_PADDING,
): PixelRect {
  const rawW = (box.x1 - box.x0) * imageWidth;
  const rawH = (box.y1 - box.y0) * imageHeight;
  const padX = rawW * padding;
  const padY = rawH * padding;

  const left = Math.max(0, Math.round(box.x0 * imageWidth - padX));
  const top = Math.max(0, Math.round(box.y0 * imageHeight - padY));
  const right = Math.min(imageWidth, Math.round(box.x1 * imageWidth + padX));
  const bottom = Math.min(imageHeight, Math.round(box.y1 * imageHeight + padY));

  return {
    left: Math.min(left, imageWidth - 1),
    top: Math.min(top, imageHeight - 1),
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

/**
 * Crop one prop region out of a scene image, returning a PNG buffer.
 *
 * Small crops are upscaled to {@link CropOptions.minPx}: a 12px sliver tells a VLM nothing,
 * and a gate that scores an unreadable thumbnail produces a confident meaningless verdict —
 * worse than no gate.
 */
export async function cropPropRegion(
  scene: Buffer,
  box: NormalizedBox,
  opts: CropOptions = {},
): Promise<Buffer> {
  const padding = opts.padding ?? DEFAULT_PADDING;
  const minPx = opts.minPx ?? DEFAULT_MIN_PX;

  let width: number | undefined;
  let height: number | undefined;
  try {
    ({ width, height } = await sharp(scene).metadata());
  } catch (e) {
    throw new Error(`crop failed: unreadable scene image — ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!width || !height) throw new Error('crop failed: scene image has no readable dimensions');

  const rect = boxToPixelRect(box, width, height, padding);
  let pipeline = sharp(scene).extract(rect);

  const longSide = Math.max(rect.width, rect.height);
  if (longSide < minPx) {
    const scale = minPx / longSide;
    pipeline = pipeline.resize({
      width: Math.round(rect.width * scale),
      height: Math.round(rect.height * scale),
      fit: 'fill',
    });
  }

  try {
    return await pipeline.png().toBuffer();
  } catch (e) {
    throw new Error(`crop failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Wrap a PNG buffer in the shape the vision seam consumes. Pure. */
export function cropToVisionImage(png: Buffer): VisionImage {
  return { mime: 'image/png', base64: png.toString('base64') };
}
