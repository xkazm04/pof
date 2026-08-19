import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  ASSET_DIRS,
  buildMultiDirAssetList,
  readListingCache,
  writeListingCache,
  type AssetDirListing,
  type AssetDirSpec,
} from '@/lib/visual-gen/generated-assets';

/**
 * GET /api/visual-gen/assets — list the generated meshes (+ preview thumbnails) across
 * EVERY whitelisted provider dir under `generated/` (see `ASSET_DIRS`), newest first.
 *
 * It listed only `generated/triposr` while the generate route writes
 * `generated/<providerId>/` and mesh-finish writes `generated/mesh-finish/`, so no Tripo
 * cloud mesh, Hunyuan mesh or finished low-poly was reachable by any gallery. Each entry
 * carries its `provider`, and its `url` names the dir, so a repeated basename across two
 * dirs stays two distinct assets.
 *
 * Every 3D-gallery mount used to pay a `readdir` + one `stat` per `.glb` across ALL five
 * dirs. Each dir's listing is now cached in-process against that dir's own mtime with a
 * short TTL (`LISTING_TTL_MS`); see `readListingCache` for how the cache learns about the
 * out-of-process mesh jobs that write these dirs. Caching is PER DIR, so a write to one
 * provider never invalidates the other four.
 */
export async function GET() {
  try {
    const listings = (await Promise.all(ASSET_DIRS.map(listOneDir))).filter(
      (l): l is AssetDirListing => l !== null,
    );
    return apiSuccess({ assets: buildMultiDirAssetList(listings) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to list assets', 500);
  }
}

/** The directory's own mtime — the stamp the listing cache revalidates against. */
async function dirStamp(dir: string): Promise<number | null> {
  try {
    return (await stat(dir)).mtimeMs;
  } catch {
    return null;
  }
}

/** One whitelisted dir's shaped listing, from cache when the dir is provably unchanged. */
async function listOneDir(spec: AssetDirSpec): Promise<AssetDirListing | null> {
  const dir = join(process.cwd(), 'generated', spec.dir);
  const key = `assets:${spec.dir}`;
  const stamp = await dirStamp(dir);
  const cached = readListingCache<AssetDirListing>(key, stamp);
  if (cached) return cached;
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return null; // dir absent → that source contributes nothing, not an error
  }
  const previewNames = new Set(files.filter((f) => f.toLowerCase().endsWith('.preview.png')));
  const glbNames = files.filter((f) => f.toLowerCase().endsWith('.glb'));
  const glb = (
    await Promise.all(
      glbNames.map(async (name) => {
        try {
          const s = await stat(join(dir, name));
          return { name, sizeBytes: s.size, mtimeMs: s.mtimeMs };
        } catch {
          return null; // vanished between readdir and stat — skip it, don't fail the list
        }
      }),
    )
  ).filter((g): g is { name: string; sizeBytes: number; mtimeMs: number } => g !== null);
  const listing: AssetDirListing = { dir: spec.dir, label: spec.label, glb, previewNames };
  writeListingCache(key, listing, stamp);
  return listing;
}
