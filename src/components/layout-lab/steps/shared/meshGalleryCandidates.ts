import type { GenAssetRef, RawGenCandidate } from '@/lib/catalog/stepSpec';
import { genericGalleryCandidates } from './genericGalleryCandidates';
import { fnv1a } from './hash';

/**
 * Candidate generator for a generic gallery step that can surface REAL generated
 * 3D meshes. Given a pre-fetched manifest of on-disk `.glb` assets (`assets`, where
 * each `url` is the served `/api/visual-gen/asset/<name>.glb`), each candidate carries
 * that URL as `payload.glbUrl` — so selecting it renders the real mesh in ArchetypeStep's
 * interactive GlbViewer (orbit / zoom), the first generic 3D preview that isn't a swatch.
 * `seq` rotates the window so each re-roll surfaces a different slice of the library.
 *
 * HONEST fallback: when `assets` is empty (nothing on disk yet) it delegates to
 * `genericGalleryCandidates` — the deterministic swatch preview with no `glbUrl` — so
 * no fake "3D" preview is ever shown (the GlbViewer only appears for a real `.glb`).
 * Pure + framework-free.
 *
 * Payload also carries `{ [field]: i }` (identical to the swatch generator), so a step's
 * `selected(field)` acceptance is unchanged whichever branch runs. The swatch is a
 * subtle deterministic 2D placeholder (visible in the gallery thumbnail); the real
 * mesh only ever renders through `glbUrl` in the 3D viewer.
 */
export function meshGalleryCandidates(
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
    // Muted metallic swatch behind the thumbnail (a mesh has no 2D preview here).
    const hue = fnv1a(`${direction}|${field}|${asset.name}`) % 360;
    return {
      swatch: `linear-gradient(135deg, hsl(${hue} 14% 30%), hsl(${(hue + 24) % 360} 12% 52%))`,
      caption: asset.name,
      payload: { [field]: i, glbUrl: asset.url },
    };
  });
}
