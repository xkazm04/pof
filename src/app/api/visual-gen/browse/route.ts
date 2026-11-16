import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { searchPolyHaven, searchAmbientCG, type AssetSource, type AssetCategory } from '@/lib/visual-gen/asset-sources';
import { logger } from '@/lib/logger';

const CATEGORIES: readonly string[] = ['hdris', 'textures', 'models', 'materials'] satisfies AssetCategory[];

/**
 * GET /api/visual-gen/browse?source=polyhaven&category=textures&q=wood
 * Proxy search to free asset APIs (avoids CORS issues from client).
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  let provider = 'unknown';
  try {
    const { searchParams } = request.nextUrl;
    const source = (searchParams.get('source') ?? 'polyhaven') as AssetSource;
    const category = (searchParams.get('category') ?? 'textures') as AssetCategory;
    const query = searchParams.get('q') ?? '';
    if (!CATEGORIES.includes(category)) {
      return apiError(`Unknown category: ${category}. Expected one of ${CATEGORIES.join(', ')}.`, 400);
    }

    let results;

    if (source === 'polyhaven') {
      provider = 'polyhaven';
      const polyCategory = category === 'materials' ? 'textures' : category;
      results = await searchPolyHaven(polyCategory as 'hdris' | 'textures' | 'models');

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
      provider = 'ambientcg';
      results = await searchAmbientCG(query, 50, 0);
    } else {
      // Name what IS servable: the panel used to offer a `sketchfab` chip this route could
      // only answer with a bare "Unknown source", so the reason never told anyone what to
      // pick instead.
      return apiError(`Unknown source: ${source}. This route serves polyhaven and ambientcg (CC0 only); Sketchfab lives behind /api/blender-mcp/assets.`, 400);
    }

    logger.info('[visual-gen/browse] outcome', { provider, status: 200, ms: Date.now() - startedAt });
    return apiSuccess(results);
  } catch (err) {
    // One structured line per outcome: provider, status, duration. Never the query or error text.
    logger.warn('[visual-gen/browse] outcome', { provider, status: 502, ms: Date.now() - startedAt });
    const message = err instanceof Error ? err.message : 'Failed to search assets';
    return apiError(message, 502);
  }
}
