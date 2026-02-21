import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api-utils';
import { searchIndex, rebuildSearchIndex, getLastRebuildTime } from '@/lib/search-index';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  const types = request.nextUrl.searchParams.get('types');
  const rebuild = request.nextUrl.searchParams.get('rebuild');

  // Rebuild index on demand
  if (rebuild === '1') {
    const result = rebuildSearchIndex();
    return apiSuccess({ indexed: result.indexed });
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
}
