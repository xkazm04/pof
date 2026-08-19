import { NextRequest } from 'next/server';
import { readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiError } from '@/lib/api-utils';
import {
  safeAssetName,
  safeAssetDir,
  GENERATED_FILE_CACHE_CONTROL,
  etagMatches,
  fileEtag,
} from '@/lib/visual-gen/generated-assets';

const MIME: Record<string, string> = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  png: 'image/png',
};

/**
 * GET /api/visual-gen/asset/:name[?dir=<provider>]
 *
 * Serves one generated mesh/preview from a WHITELISTED dir under `generated/`. Two
 * independent allow-lists, neither of which sanitises — both refuse by not matching:
 *  - the basename is validated to a plain name with an extension allow-list
 *    (`safeAssetName`), so no separator or `..` can survive;
 *  - `dir` must be an exact member of `ASSET_DIRS` (`safeAssetDir`); omitted means the
 *    legacy `triposr`, so every URL already stored in a pipeline artifact resolves to
 *    exactly the file it always did.
 * Belt-and-braces, the resolved real path is re-checked to be inside the real
 * whitelisted dir, which also refuses a symlink pointing out of it (same contract as
 * `/api/visual-gen/icon/:name`).
 *
 * Caching: `private, no-cache` + a size/mtime `ETag` (`GENERATED_FILE_CACHE_CONTROL`),
 * replacing `no-store` — a `.glb` is the biggest thing this app serves and was re-sent in
 * full on every viewer mount. Store-and-revalidate keeps that correct for the writers
 * that reuse a filename deterministically (`tripo-skins` writes `<slug>.glb`), so no
 * mesh is ever pinned stale; nothing is served `immutable`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safe = safeAssetName(decodeURIComponent(name));
  if (!safe) return apiError('invalid asset name', 400);
  const spec = safeAssetDir(req.nextUrl.searchParams.get('dir'));
  if (!spec) return apiError('invalid asset dir', 400);
  const ext = (safe.split('.').pop() ?? '').toLowerCase();
  const dir = join(process.cwd(), 'generated', spec.dir);
  try {
    const [realDir, realFile] = await Promise.all([realpath(dir), realpath(join(dir, safe))]);
    if (realFile !== join(realDir, safe)) return apiError('asset not found', 404);
    const st = await stat(realFile);
    if (!st.isFile()) return apiError('asset not found', 404);
    const etag = fileEtag(st.size, st.mtimeMs);
    const headers: Record<string, string> = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': GENERATED_FILE_CACHE_CONTROL,
      ETag: etag,
      'Last-Modified': new Date(st.mtimeMs).toUTCString(),
    };
    if (etagMatches(req.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers });
    }
    const buf = await readFile(realFile);
    return new Response(new Uint8Array(buf), { headers });
  } catch {
    return apiError('asset not found', 404);
  }
}
