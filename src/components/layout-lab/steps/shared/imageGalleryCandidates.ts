import type { GenAssetRef, RawGenCandidate } from '@/lib/catalog/stepSpec';
import { genericGalleryCandidates } from './genericGalleryCandidates';
import { fnv1a } from './hash';

/**
 * Candidate generator for a generic gallery step that can surface REAL generated
 * thumbnails. Given a pre-fetched manifest of on-disk assets (`assets`), each candidate
 * carries the served image `url` as its `imageUrl` so the gallery renders the real
 * asset — the first generic step that isn't a deterministic swatch. `seq` rotates the
 * window so each re-roll surfaces a different slice of the library.
 *
 * HONEST fallback: when `assets` is empty (nothing on disk yet), it delegates to
 * `genericGalleryCandidates` — the existing swatch preview + its "not the generated
 * asset" copy — so no fake "real" preview is ever shown. Pure + framework-free.
 *
 * Payload is `{ [field]: i }` (identical to the swatch generator), so the step's
 * `selected(field)` acceptance is unchanged whichever branch runs.
 */
export function imageGalleryCandidates(
  field: string,
  count: number,
  assets: GenAssetRef[],
  direction: string,
  seq: number,
): RawGenCandidate[] {
  const n = Math.max(0, count);
  if (assets.length === 0) return genericGalleryCandidates(field, count, direction, seq);
  return Array.from({ length: n }, (_, i) => {
    const asset = assets[(seq + i) % assets.length];
    // A subtle deterministic swatch sits behind the image (visible while it loads / if 404).
    const hue = fnv1a(`${direction}|${field}|${asset.name}`) % 360;
    return {
      swatch: `linear-gradient(135deg, hsl(${hue} 20% 40%), hsl(${(hue + 24) % 360} 22% 26%))`,
      imageUrl: asset.url,
      caption: asset.name,
      payload: { [field]: i },
    };
  });
}
