import { NextRequest } from 'next/server';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildIconList, iconSlug } from '@/lib/visual-gen/generated-icons';

/**
 * GET /api/visual-gen/icons — list the generated per-step 2D art in `generated/icons/`.
 *
 * Mirrors `/api/visual-gen/assets` (the proven 3D listing): dir absent → `{ icons: [] }`
 * (an empty gallery, not an error), so a step with no generated art falls back to the
 * honest deterministic swatch.
 *
 * Optional filter — `?catalogId=…&step=…` (or the pre-computed `?slug=…`) returns only
 * the art generated FOR that pipeline step, matched on the generator's own filename id.
 */
export async function GET(req: NextRequest) {
  const dir = join(process.cwd(), 'generated', 'icons');
  const q = req.nextUrl.searchParams;
  const catalogId = q.get('catalogId');
  const step = q.get('step');
  const want = q.get('slug') ?? (catalogId && step ? iconSlug(catalogId, step) : null);
  try {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return apiSuccess({ icons: [] }); // dir absent → empty gallery, not an error
    }
    const stated = await Promise.all(
      files.map(async (name) => {
        try {
          const s = await stat(join(dir, name));
          return s.isFile() ? { name, mtimeMs: s.mtimeMs } : null;
        } catch {
          return null;
        }
      }),
    );
    const all = buildIconList(stated.filter((f): f is { name: string; mtimeMs: number } => f != null));
    return apiSuccess({ icons: want ? all.filter((i) => i.slug === want) : all });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to list icons', 500);
  }
}
