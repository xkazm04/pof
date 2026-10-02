import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/visual-gen/browse/files/route';
import { clearPolyHavenFilesCache } from '@/lib/visual-gen/asset-sources';
import type { DownloadVariant } from '@/lib/visual-gen/download-variants';

/**
 * case 5 — GET /api/visual-gen/browse/files: the Poly Haven file tree as download variants.
 * The browser cannot pick a file without it (the search row only knows the id), and it is
 * the listing the old Download opened as if it were the asset.
 */

const armchair = readFileSync(join(process.cwd(), 'src/__tests__/fixtures/asset-sources/ph-files-ArmChair_01.json'), 'utf8');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/visual-gen/browse/files?${qs}`));

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  clearPolyHavenFilesCache();
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(armchair, { status: 200, headers: { 'Content-Type': 'application/json' } }));
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/visual-gen/browse/files', () => {
  it('answers the variants after exactly one fetch of the listing, then serves the cache', async () => {
    const res = await get('source=polyhaven&id=ArmChair_01&category=models');
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { variants: DownloadVariant[] } };
    expect(body.success).toBe(true);
    expect(body.data.variants.map((v) => v.label)).toEqual(['1K glTF', '2K glTF', '4K glTF']);
    expect(body.data.variants.map((v) => v.totalBytes)).toEqual([769_144, 2_805_307, 10_845_355]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://api.polyhaven.com/files/ArmChair_01');

    const again = await get('source=polyhaven&id=ArmChair_01&category=models');
    expect(again.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('refuses a path-shaped id with 400 and never fetches', async () => {
    const res = await get(`source=polyhaven&id=${encodeURIComponent('../x')}&category=models`);
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses ambientCG with 400 naming that its variants arrive with the search row', async () => {
    const res = await get('source=ambientcg&id=Ground112');
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toMatch(/ambientCG/);
    expect(body.error).toMatch(/search row/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an upstream failure states its reason and is not cached', async () => {
    fetchSpy.mockImplementationOnce(async () => new Response('nope', { status: 404 }));
    const res = await get('source=polyhaven&id=ArmChair_01&category=models');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await res.json()).error).toMatch(/404/);

    const retry = await get('source=polyhaven&id=ArmChair_01&category=models');
    expect(retry.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
