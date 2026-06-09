import { describe, it, expect } from 'vitest';
import { ok, err } from '@/types/result';
import {
  mergeAssetResults,
  assetKey,
  POLYHAVEN_RESOLUTIONS,
  DEFAULT_POLYHAVEN_RESOLUTION,
} from '@/lib/blender-mcp/assetBrowser';
import type { AssetResult } from '@/lib/blender-mcp/types';

const poly = (id: string): AssetResult => ({
  id,
  name: `Poly ${id}`,
  source: 'polyhaven',
  category: 'rock',
  thumbnailUrl: `https://cdn/${id}.png`,
});

const sketch = (id: string): AssetResult => ({
  id,
  name: `Sketch ${id}`,
  source: 'sketchfab',
  category: '',
});

describe('assetKey', () => {
  it('namespaces the id by source so cross-source id collisions stay distinct', () => {
    expect(assetKey({ source: 'polyhaven', id: 'abc' })).toBe('polyhaven:abc');
    expect(assetKey({ source: 'sketchfab', id: 'abc' })).toBe('sketchfab:abc');
    expect(assetKey(poly('abc'))).not.toBe(assetKey(sketch('abc')));
  });
});

describe('mergeAssetResults', () => {
  it('combines results from both sources with no error when both succeed', () => {
    const out = mergeAssetResults(ok([poly('a'), poly('b')]), ok([sketch('c')]));
    expect(out.error).toBeNull();
    expect(out.warning).toBeNull();
    expect(out.assets.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('de-dupes on source+id so overlapping ids cannot double-render', () => {
    // Same id within polyhaven returned twice → one card.
    const out = mergeAssetResults(ok([poly('a'), poly('a')]), ok([]));
    expect(out.assets).toHaveLength(1);
    // Same id across DIFFERENT sources → kept separate.
    const out2 = mergeAssetResults(ok([poly('a')]), ok([sketch('a')]));
    expect(out2.assets).toHaveLength(2);
  });

  it('surfaces a soft warning (not an error) when one source fails', () => {
    const out = mergeAssetResults(ok([poly('a')]), err('rate limited'));
    expect(out.error).toBeNull();
    expect(out.assets.map((a) => a.id)).toEqual(['a']);
    expect(out.warning).toMatch(/Sketchfab/);
    expect(out.warning).toMatch(/rate limited/);
  });

  it('surfaces a hard error and no assets when both sources fail', () => {
    const out = mergeAssetResults(err('offline'), err('offline'));
    expect(out.assets).toEqual([]);
    expect(out.warning).toBeNull();
    expect(out.error).toMatch(/PolyHaven/);
    expect(out.error).toMatch(/Sketchfab/);
  });
});

describe('PolyHaven facets', () => {
  it('exposes ascending resolutions with 1k as the default', () => {
    expect(POLYHAVEN_RESOLUTIONS).toEqual(['1k', '2k', '4k', '8k']);
    expect(DEFAULT_POLYHAVEN_RESOLUTION).toBe('1k');
  });
});
