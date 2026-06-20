import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { apiError } from '@/lib/api-utils';
import { safeAssetName } from '@/lib/visual-gen/generated-assets';

const MIME: Record<string, string> = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  png: 'image/png',
};

/**
 * GET /api/visual-gen/asset/:name
 * Serves one generated mesh/preview from generated/triposr/. Safe by construction:
 * the name is validated to a plain basename (safeAssetName) and joined under the
 * whitelisted dir — no traversal surface.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safe = safeAssetName(decodeURIComponent(name));
  if (!safe) return apiError('invalid asset name', 400);
  const ext = safe.split('.').pop() ?? '';
  const path = join(process.cwd(), 'generated', 'triposr', safe);
  try {
    const buf = await readFile(path);
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store' },
    });
  } catch {
    return apiError('asset not found', 404);
  }
}
