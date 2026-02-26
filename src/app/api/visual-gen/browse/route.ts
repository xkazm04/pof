import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { searchPolyHaven, searchAmbientCG, type AssetSource, type AssetCategory } from '@/lib/visual-gen/asset-sources';

/**
 * GET /api/visual-gen/browse?source=polyhaven&category=textures&q=wood
 * Proxy search to free asset APIs (avoids CORS issues from client).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const source = (searchParams.get('source') ?? 'polyhaven') as AssetSource;
    const category = (searchParams.get('category') ?? 'textures') as AssetCategory;
    const query = searchParams.get('q') ?? '';

    let results;

    if (source === 'polyhaven') {
      const polyCategory = category === 'materials' ? 'textures' : category;
      const validCategory = (['hdris', 'textures', 'models'] as const).includes(polyCategory as 'hdris' | 'textures' | 'models')
        ? (polyCategory as 'hdris' | 'textures' | 'models')
        : 'textures';
      results = await searchPolyHaven(validCategory);

      // Client-side filter by query since Poly Haven doesn't have search
      if (query) {
        const q = query.toLowerCase();
        results = results.filter((r) =>
          r.name.toLowerCase().includes(q) ||
          r.tags?.some((t) => t.toLowerCase().includes(q)),
        );
      }

      // Limit results
      results = results.slice(0, 50);
    } else if (source === 'ambientcg') {
      results = await searchAmbientCG(query, 50, 0);
    } else {
      return apiError(`Unknown source: ${source}`, 400);
    }

    return apiSuccess(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to search assets';
    return apiError(message);
  }
}
