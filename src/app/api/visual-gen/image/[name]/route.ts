import { NextRequest } from 'next/server';
import { readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiError } from '@/lib/api-utils';
import { decodeRouteName } from '@/app/api/visual-gen/_lib/decodeName';
import { GENERATED_IMAGE_DIR, safeGeneratedImageName } from '@/lib/visual-gen/image-providers';
import { GENERATED_FILE_CACHE_CONTROL, etagMatches, fileEtag } from '@/lib/visual-gen/generated-assets';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * GET /api/visual-gen/image/:name
 *
 * Serves one free-prompt 2D generation from `generated/images/` — the dir
 * POST /api/visual-gen/generate-2d writes. Same shape and safety constraints as the
 * proven `/api/visual-gen/icon/:name` and `/api/visual-gen/asset/:name` routes: the
 * name is validated to a plain basename against an extension allow-list
 * (`safeGeneratedImageName`) and joined under the whitelisted dir, so there is no
 * traversal surface; belt-and-braces, the resolved real path is re-checked to be
 * inside the real whitelisted dir, which also refuses a symlink pointing out of it.
 *
 * Deliberately NOT `generated/icons/`: that library is keyed `(catalogId, step)` and
 * matched on the generator's exact filename rule, so a free-prompt image has no
 * honest name there.
 *
 * Caching: the same `private, no-cache` + size/mtime `ETag` as the icon and asset routes, so
 * a gallery remount costs one conditional request and no body bytes.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeRouteName(name);
  if (decoded === null) return apiError('invalid image name', 400);
  const safe = safeGeneratedImageName(decoded);
  if (!safe) return apiError('invalid image name', 400);
  const ext = (safe.split('.').pop() ?? '').toLowerCase();
  const dir = join(process.cwd(), 'generated', GENERATED_IMAGE_DIR);
  try {
    const [realDir, realFile] = await Promise.all([realpath(dir), realpath(join(dir, safe))]);
    if (realFile !== join(realDir, safe)) return apiError('image not found', 404);
    const st = await stat(realFile);
    if (!st.isFile()) return apiError('image not found', 404);
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
    return apiError('image not found', 404);
  }
}
