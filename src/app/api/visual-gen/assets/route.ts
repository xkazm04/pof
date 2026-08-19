import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { ASSET_DIRS, buildMultiDirAssetList, type AssetDirListing } from '@/lib/visual-gen/generated-assets';

/**
 * GET /api/visual-gen/assets — list the generated meshes (+ preview thumbnails) across
 * EVERY whitelisted provider dir under `generated/` (see `ASSET_DIRS`), newest first.
 *
 * It listed only `generated/triposr` while the generate route writes
 * `generated/<providerId>/` and mesh-finish writes `generated/mesh-finish/`, so no Tripo
 * cloud mesh, Hunyuan mesh or finished low-poly was reachable by any gallery. Each entry
 * carries its `provider`, and its `url` names the dir, so a repeated basename across two
 * dirs stays two distinct assets.
 */
export async function GET() {
  try {
    const listings: AssetDirListing[] = [];
    for (const spec of ASSET_DIRS) {
      const dir = join(process.cwd(), 'generated', spec.dir);
      let files: string[];
      try {
        files = await readdir(dir);
      } catch {
        continue; // dir absent → that source contributes nothing, not an error
      }
      const previewNames = new Set(files.filter((f) => f.toLowerCase().endsWith('.preview.png')));
      const glbNames = files.filter((f) => f.toLowerCase().endsWith('.glb'));
      const glb = (await Promise.all(
        glbNames.map(async (name) => {
          try {
            const s = await stat(join(dir, name));
            return { name, sizeBytes: s.size, mtimeMs: s.mtimeMs };
          } catch {
            return null; // vanished between readdir and stat — skip it, don't fail the list
          }
        }),
      )).filter((g): g is { name: string; sizeBytes: number; mtimeMs: number } => g !== null);
      listings.push({ dir: spec.dir, label: spec.label, glb, previewNames });
    }
    return apiSuccess({ assets: buildMultiDirAssetList(listings) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to list assets', 500);
  }
}
