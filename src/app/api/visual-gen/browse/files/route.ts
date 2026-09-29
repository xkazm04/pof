import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { fetchPolyHavenFiles } from '@/lib/visual-gen/asset-sources';
import { isValidPolyHavenId, polyHavenVariants } from '@/lib/visual-gen/download-variants';

const POLYHAVEN_CATEGORIES = ['hdris', 'textures', 'models'] as const;

/**
 * GET /api/visual-gen/browse/files?source=polyhaven&id=ArmChair_01&category=models
 *
 * The files one Poly Haven asset offers, as download variants (format x resolution, each with
 * its files and total size) — what the asset browser's picker lists. Proxies
 * `api.polyhaven.com/files/<id>` (the same host the browse route calls), cached per id.
 * ambientCG needs no call here: its search response already carries every package.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const source = searchParams.get('source') ?? 'polyhaven';
  const id = searchParams.get('id') ?? '';
  const category = searchParams.get('category') ?? 'textures';

  if (source === 'ambientcg') {
    return apiError('ambientCG variants arrive with the search row (its search requests downloadData) — there is no file listing to fetch.', 400);
  }
  if (source !== 'polyhaven') {
    return apiError(`Unknown source: ${source}. This route lists Poly Haven files.`, 400);
  }
  if (!isValidPolyHavenId(id)) {
    return apiError(`Invalid Poly Haven asset id: "${id}" (expected a slug like ArmChair_01).`, 400);
  }
  if (!(POLYHAVEN_CATEGORIES as readonly string[]).includes(category)) {
    return apiError(`Unknown Poly Haven category: ${category}. Expected one of ${POLYHAVEN_CATEGORIES.join(', ')}.`, 400);
  }

  try {
    const files = await fetchPolyHavenFiles(id);
    return apiSuccess({ variants: polyHavenVariants(files, category) });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to list Poly Haven files', 502);
  }
}
