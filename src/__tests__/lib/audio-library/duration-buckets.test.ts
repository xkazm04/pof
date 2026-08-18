import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FILTER,
  DURATION_BUCKETS,
  filterAssets,
  joinAssets,
} from '@/lib/audio-library/filter';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';

/**
 * An auto-duration clip stores `durationMs: 0` — the provider chose the length
 * and never reported it. The library renders that as "auto", but the facet used
 * to sort it into "< 1s", asserting a length nobody measured. Auto is its own
 * bucket; the "< 1s" bucket now means a REAL sub-second measurement.
 */

const sets: AudioSet[] = [
  { id: 's1', name: 'auto-set', kind: 'sfx', eventKey: null, surface: null, loopable: false, createdAt: 0 },
];
function asset(id: string, durationMs: number): AudioAsset {
  return {
    id, setId: 's1', filename: `${id}.mp3`, relPath: `s1/${id}.mp3`, prompt: 'p',
    provider: 'elevenlabs', durationMs, format: 'mp3', favorite: false,
    promptHash: null, createdAt: 0,
  };
}
const assets: AudioAsset[] = [asset('auto', 0), asset('tiny', 400), asset('mid', 1500)];
const items = joinAssets(sets, assets);

describe('duration facets — auto is not a measured length', () => {
  it('offers an explicit auto bucket', () => {
    const auto = DURATION_BUCKETS.find((b) => b.id === 'auto');
    expect(auto).toBeDefined();
    expect(auto!.label.toLowerCase()).toContain('auto');
  });

  it('facets a 0-duration asset under auto, never under "< 1s"', () => {
    expect(filterAssets(items, { ...DEFAULT_FILTER, duration: 'auto' }).map((x) => x.asset.id))
      .toEqual(['auto']);
    expect(filterAssets(items, { ...DEFAULT_FILTER, duration: 'short' }).map((x) => x.asset.id))
      .toEqual(['tiny']);
  });

  it('keeps measured buckets intact and "any length" all-inclusive', () => {
    expect(filterAssets(items, { ...DEFAULT_FILTER, duration: 'med' }).map((x) => x.asset.id))
      .toEqual(['mid']);
    expect(filterAssets(items, DEFAULT_FILTER)).toHaveLength(3);
  });

  it('puts every asset in exactly one bucket', () => {
    for (const { asset: a } of items) {
      const hits = DURATION_BUCKETS.filter(
        (b) => filterAssets([{ asset: a, set: sets[0] }], { ...DEFAULT_FILTER, duration: b.id }).length === 1,
      );
      expect(hits.map((h) => h.id)).toHaveLength(1);
    }
  });
});
