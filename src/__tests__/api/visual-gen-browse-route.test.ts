/**
 * GET /api/visual-gen/browse agrees with its sibling /browse/files: an unknown category is
 * refused rather than quietly searched as textures, and an upstream failure is a 502.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { searchPolyHaven, searchAmbientCG } = vi.hoisted(() => ({
  searchPolyHaven: vi.fn(),
  searchAmbientCG: vi.fn(),
}));
vi.mock('@/lib/visual-gen/asset-sources', () => ({ searchPolyHaven, searchAmbientCG }));

const { GET } = await import('@/app/api/visual-gen/browse/route');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/visual-gen/browse?${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  searchPolyHaven.mockResolvedValue([]);
  searchAmbientCG.mockResolvedValue([]);
});

describe('GET /api/visual-gen/browse', () => {
  it.each(['polyhaven', 'ambientcg'])('refuses an unknown category on %s', async (source) => {
    const res = await get(`source=${source}&category=weapons`);
    expect(res.status).toBe(400);
    expect(searchPolyHaven).not.toHaveBeenCalled();
    expect(searchAmbientCG).not.toHaveBeenCalled();
  });

  it('answers 502 when the upstream search fails', async () => {
    searchPolyHaven.mockRejectedValue(new Error('upstream down'));
    expect((await get('source=polyhaven&category=models')).status).toBe(502);
  });

  it.each(['hdris', 'textures', 'models', 'materials'])('[guard] searches category %s', async (category) => {
    expect((await get(`source=polyhaven&category=${category}`)).status).toBe(200);
    expect(searchPolyHaven).toHaveBeenCalledTimes(1);
  });
});
