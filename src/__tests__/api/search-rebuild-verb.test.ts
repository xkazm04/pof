/**
 * GET handlers must not mutate (src/lib/api-auth.ts): rebuilding the search index deletes and
 * refills it, so it is a POST behind requireOperator. A GET carrying ?rebuild=1 is refused.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const rebuildSearchIndex = vi.fn(() => ({ indexed: 7 }));
vi.mock('@/lib/search-index', () => ({
  searchIndex: () => [],
  rebuildSearchIndex: () => rebuildSearchIndex(),
  getLastRebuildTime: () => null,
}));

import { GET, POST } from '@/app/api/search/route';

beforeEach(() => { rebuildSearchIndex.mockClear(); });

describe('/api/search rebuild verb', () => {
  it('GET ?rebuild=1 does not rebuild', async () => {
    const res = await GET(new NextRequest('http://localhost/api/search?rebuild=1'));
    expect(rebuildSearchIndex).not.toHaveBeenCalled();
    expect(res.status).toBe(405);
  });

  it('POST ?action=rebuild rebuilds and reports the count', async () => {
    const res = await POST(new NextRequest('http://localhost/api/search?action=rebuild', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(rebuildSearchIndex).toHaveBeenCalledTimes(1);
    const body = (await res.json()) as { success: boolean; data: { indexed: number } };
    expect(body.data.indexed).toBe(7);
  });

  it('a cross-site POST is refused before the index is touched', async () => {
    const res = await POST(new NextRequest('http://localhost/api/search?action=rebuild', {
      method: 'POST', headers: { origin: 'http://evil.example', host: 'localhost' },
    }));
    expect(res.status).toBe(403);
    expect(rebuildSearchIndex).not.toHaveBeenCalled();
  });

  it('POST with an unknown action is a 400', async () => {
    const res = await POST(new NextRequest('http://localhost/api/search?action=nope', { method: 'POST' }));
    expect(res.status).toBe(400);
    expect(rebuildSearchIndex).not.toHaveBeenCalled();
  });
});
