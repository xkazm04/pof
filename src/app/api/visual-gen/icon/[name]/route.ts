import { NextRequest } from 'next/server';
import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { apiError } from '@/lib/api-utils';
import { safeIconName } from '@/lib/visual-gen/generated-icons';

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
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safe = safeIconName(decodeURIComponent(name));
  if (!safe) return apiError('invalid icon name', 400);
  const ext = (safe.split('.').pop() ?? '').toLowerCase();
  const dir = join(process.cwd(), 'generated', 'icons');
  try {
    const [realDir, realFile] = await Promise.all([realpath(dir), realpath(join(dir, safe))]);
    if (realFile !== join(realDir, safe)) return apiError('icon not found', 404);
    const buf = await readFile(realFile);
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store' },
    });
  } catch {
    return apiError('icon not found', 404);
  }
}
