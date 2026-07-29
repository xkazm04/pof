import type { GenAssetRef, RawGenCandidate } from '@/lib/catalog/stepSpec';
import { genericGalleryCandidates } from './genericGalleryCandidates';
import { fnv1a } from './hash';

/**
 * Candidate generator for a generic gallery step that can surface REAL generated
 * thumbnails. `assets` is the pre-fetched manifest of the art generated FOR THIS STEP
 * (see `useGeneratedImageAssets`), so each candidate that carries an `imageUrl` genuinely
 * is this step's asset. `seq` rotates the window so each re-roll surfaces a different
 * slice when the step owns more art than the gallery has slots.
 *
 * HONEST counts: only `min(count, assets.length)` candidates carry a real image — the
 * remaining slots come from `genericGalleryCandidates`, the deterministic swatch preview
 * that labels itself as such. A step with ONE generated icon therefore shows one real
 * thumbnail and three honest placeholders, never the same image repeated to fill the
 * grid. `assets` empty → the whole batch is the swatch fallback. Pure + framework-free.
 *
 * Payload is `{ [field]: i }` (identical to the swatch generator) for every slot, so the
 * step's `selected(field)` acceptance is unchanged whichever branch fills a slot.
 */
export function imageGalleryCandidates(
  field: string,
  count: number,
  assets: GenAssetRef[],
  direction: string,
  seq: number,
): RawGenCandidate[] {
  const n = Math.max(0, count);
  if (assets.length === 0 || n === 0) return genericGalleryCandidates(field, count, direction, seq);
  const real = Math.min(n, assets.length);
  const out: RawGenCandidate[] = Array.from({ length: real }, (_, i) => {
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
  // Fill the rest with the honest swatch candidates, keeping each slot's payload index.
  if (real < n) out.push(...genericGalleryCandidates(field, n, direction, seq).slice(real));
  return out;
}
