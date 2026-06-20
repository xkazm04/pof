import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildAssetList } from '@/lib/visual-gen/generated-assets';

/** GET /api/visual-gen/assets — list the generated TripoSR meshes (+ preview thumbnails). */
export async function GET() {
  const dir = join(process.cwd(), 'generated', 'triposr');
  try {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return apiSuccess({ assets: [] }); // dir absent → empty gallery, not an error
    }
    const previewNames = new Set(files.filter((f) => f.toLowerCase().endsWith('.preview.png')));
    const glbNames = files.filter((f) => f.toLowerCase().endsWith('.glb'));
    const glb = await Promise.all(
      glbNames.map(async (name) => {
        const s = await stat(join(dir, name));
        return { name, sizeBytes: s.size, mtimeMs: s.mtimeMs };
      }),
    );
    return apiSuccess({ assets: buildAssetList(glb, previewNames) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to list assets', 500);
  }
}
