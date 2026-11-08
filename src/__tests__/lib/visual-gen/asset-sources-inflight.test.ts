import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { searchPolyHaven } from '@/lib/visual-gen/asset-sources';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The catalog cache is module-level, so each test uses its own category.
describe('concurrent cold Poly Haven searches', () => {
  it('download the catalog once for five calls', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return new Response(JSON.stringify({ rock_wall_10: { name: 'Rock Wall', tags: ['rock'] } }));
    });
    const all = await Promise.all([1, 2, 3, 4, 5].map(() => searchPolyHaven('models')));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(all.every((r) => r.length === 1 && r[0].id === 'rock_wall_10')).toBe(true);
  });

  it('does not cache a shared failure', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ a: { name: 'A' } })));
    const failed = await Promise.allSettled([searchPolyHaven('hdris'), searchPolyHaven('hdris')]);
    expect(failed.map((f) => f.status)).toEqual(['rejected', 'rejected']);
    expect(spy).toHaveBeenCalledTimes(1);
    const retry = await searchPolyHaven('hdris');
    expect(retry.map((r) => r.id)).toEqual(['a']);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
