import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  searchAmbientCG,
  searchPolyHaven,
  fetchPolyHavenFiles,
  clearPolyHavenFilesCache,
} from '@/lib/visual-gen/asset-sources';

afterEach(() => {
  vi.restoreAllMocks();
  clearPolyHavenFilesCache();
});

describe('free asset source calls carry a deadline', () => {
  const cases: [string, () => Promise<unknown>, unknown][] = [
    ['ambientCG search', () => searchAmbientCG('rock'), { foundAssets: [] }],
    ['Poly Haven catalog', () => searchPolyHaven('hdris'), {}],
    ['Poly Haven files', () => fetchPolyHavenFiles('rock_wall_10'), {}],
  ];

  for (const [name, call, body] of cases) {
    it(`${name} passes an abort signal to fetch`, async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
      await call();
      expect(spy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });
  }
});
