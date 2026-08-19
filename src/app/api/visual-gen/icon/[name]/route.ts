import { NextRequest } from 'next/server';
import { readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiError } from '@/lib/api-utils';
import { safeIconName } from '@/lib/visual-gen/generated-icons';
import { GENERATED_FILE_CACHE_CONTROL, etagMatches, fileEtag } from '@/lib/visual-gen/generated-assets';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * GET /api/visual-gen/icon/:name
 * Serves one generated per-step 2D image from `generated/icons/`. Same shape and safety
 * constraints as `/api/visual-gen/asset/:name` (the proven 3D route): the name is
 * validated to a plain basename with an extension allow-list (`safeIconName`) and joined
 * under the whitelisted dir, so there is no traversal surface. Belt-and-braces, the
 * resolved real path is re-checked to be inside the real whitelisted dir, which also
 * refuses a symlink pointing out of it.
 *
 * Caching: `no-store` used to force a full re-download of every icon on every gallery
 * mount and every re-roll. It is now `private, no-cache` + a size/mtime `ETag`
 * (`GENERATED_FILE_CACHE_CONTROL`), i.e. store-and-revalidate — a repeat mount costs one
 * conditional request and zero body bytes, while an icon overwritten IN PLACE (which is
 * exactly what re-generating a step's art does: the filename is `iconSlug(catalogId,
 * step)`) changes the etag and is served in full. Nothing is served `immutable`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safe = safeIconName(decodeURIComponent(name));
  if (!safe) return apiError('invalid icon name', 400);
  const ext = (safe.split('.').pop() ?? '').toLowerCase();
  const dir = join(process.cwd(), 'generated', 'icons');
  try {
    const [realDir, realFile] = await Promise.all([realpath(dir), realpath(join(dir, safe))]);
    if (realFile !== join(realDir, safe)) return apiError('icon not found', 404);
    const st = await stat(realFile);
    if (!st.isFile()) return apiError('icon not found', 404);
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
    return apiError('icon not found', 404);
  }
}
