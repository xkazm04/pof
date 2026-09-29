import type { GenAssetRef, RawGenCandidate } from '@/lib/catalog/stepSpec';
import { meshMatches } from '@/lib/visual-gen/generated-assets';
import { genericGalleryCandidates } from './genericGalleryCandidates';
import { fnv1a } from './hash';
import { slotRealAssets } from './realAssetSlots';

/** The per-step artifact a 3D gallery belongs to — the identity a mesh must re-encode to fill it. */
export interface MeshGalleryScope {
  catalogId: string;
  step: string;
}

/**
 * Candidate generator for a generic gallery step that can surface REAL generated
 * 3D meshes. `assets` is the on-disk `.glb` manifest (`useGeneratedMeshAssets`, where
 * each `url` is the served `/api/visual-gen/asset/<name>.glb` and `slug` the identity its
 * filename encodes); a slotted candidate carries that URL as `payload.glbUrl` — so
 * selecting it renders the real mesh in ArchetypeStep's interactive GlbViewer.
 *
 * IDENTITY-SCOPED: the manifest lists every mesh on disk (a /3d-studio chair, another
 * catalog's hero), so only refs whose `slug` re-encodes `scope` — `meshMatches`, the icon
 * library's `iconSlug` rule — are eligible. An unrelated mesh used to be auto-selected into
 * candidate 0 and graded `pass`; now it never reaches a slot, and a ref with no slug has no
 * identity. HONEST counts via `slotRealAssets`: one matching mesh fills ONE slot, the rest
 * are `genericGalleryCandidates` swatches (no `glbUrl`), and no matching mesh at all means
 * the whole batch is the swatch fallback — which acceptance defers with its reason.
 * `seq` rotates the window when the step owns more meshes than slots. Pure.
 *
 * Payload also carries `{ [field]: i }` (identical to the swatch generator), so a step's
 * `selected(field)` acceptance is unchanged whichever branch fills a slot. The swatch is a
 * subtle deterministic 2D placeholder (visible in the gallery thumbnail); the real
 * mesh only ever renders through `glbUrl` in the 3D viewer.
 */
export function meshGalleryCandidates(
  field: string,
  count: number,
  assets: GenAssetRef[],
  direction: string,
  seq: number,
  scope: MeshGalleryScope,
): RawGenCandidate[] {
  const n = Math.max(0, count);
  const own = assets.filter((a) => a.slug !== undefined && meshMatches(a.slug, scope.catalogId, scope.step));
  if (own.length === 0 || n === 0) return genericGalleryCandidates(field, count, direction, seq);
  const swatches = genericGalleryCandidates(field, n, direction, seq);
  return slotRealAssets(n, own, seq, (asset, i): RawGenCandidate => {
    // Muted metallic swatch behind the thumbnail (a mesh has no 2D preview here).
    const hue = fnv1a(`${direction}|${field}|${asset.name}`) % 360;
    return {
      swatch: `linear-gradient(135deg, hsl(${hue} 14% 30%), hsl(${(hue + 24) % 360} 12% 52%))`,
      caption: asset.name,
      payload: { [field]: i, glbUrl: asset.url },
    };
  }, (i) => swatches[i]);
}
