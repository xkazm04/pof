import { NextRequest, NextResponse } from 'next/server';
import { searchIndex, rebuildSearchIndex, getLastRebuildTime } from '@/lib/search-index';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  const types = request.nextUrl.searchParams.get('types');
  const rebuild = request.nextUrl.searchParams.get('rebuild');

  // Rebuild index on demand
  if (rebuild === '1') {
    const result = rebuildSearchIndex();
    return NextResponse.json({ ok: true, indexed: result.indexed });
  }

  if (!q) {
    return NextResponse.json({ ok: true, results: [], lastRebuilt: getLastRebuildTime() });
  }

  const typeFilter = types ? types.split(',').filter(Boolean) : undefined;
  const results = searchIndex(q, { types: typeFilter, limit: 30 });

  return NextResponse.json({
    ok: true,
    results,
    count: results.length,
    lastRebuilt: getLastRebuildTime(),
  });
}
