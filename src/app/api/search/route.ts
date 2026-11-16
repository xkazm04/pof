import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { searchIndex, rebuildSearchIndex, getLastRebuildTime } from '@/lib/search-index';

export const GET = withRoute(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  const types = request.nextUrl.searchParams.get('types');

  // Rebuilding deletes and refills the index, and a GET must not mutate (api-auth.ts), so it is POST.
  if (request.nextUrl.searchParams.has('rebuild')) {
    return apiError('Rebuild is POST /api/search?action=rebuild', 405);
  }

  if (!q) {
    return apiSuccess({ results: [], lastRebuilt: getLastRebuildTime() });
  }

  const typeFilter = types ? types.split(',').filter(Boolean) : undefined;
  const results = searchIndex(q, { types: typeFilter, limit: 30 });

  return apiSuccess({
    results,
    count: results.length,
    lastRebuilt: getLastRebuildTime(),
  });
}, 'Search failed');

/** POST /api/search?action=rebuild: delete and refill the index. Operator-guarded like every write. */
export const POST = withRoute(async (request: NextRequest) => {
  const denied = requireOperator(request);
  if (denied) return denied;
  const action = request.nextUrl.searchParams.get('action');
  if (action !== 'rebuild') return apiError(`Unknown action "${action ?? ''}"`, 400);
  const result = rebuildSearchIndex();
  return apiSuccess({ indexed: result.indexed });
}, 'Search rebuild failed');
