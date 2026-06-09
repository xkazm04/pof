import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FILTER,
  deriveFacets,
  filterAssets,
  isFilterActive,
  joinAssets,
  type AssetWithSet,
} from '@/lib/audio-library/filter';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';

function set(over: Partial<AudioSet> & { id: string }): AudioSet {
  return {
    id: over.id, name: over.name ?? over.id, kind: over.kind ?? 'sfx',
    eventKey: over.eventKey ?? null, surface: over.surface ?? null,
    loopable: over.loopable ?? false, createdAt: over.createdAt ?? 0,
  };
}
function asset(over: Partial<AudioAsset> & { id: string; setId: string }): AudioAsset {
  return {
    id: over.id, setId: over.setId, filename: over.filename ?? `${over.id}.mp3`,
    relPath: over.relPath ?? `${over.setId}/${over.id}.mp3`, prompt: over.prompt ?? 'p',
    provider: over.provider ?? 'elevenlabs', durationMs: over.durationMs ?? 1500,
    format: over.format ?? 'mp3', favorite: over.favorite ?? false,
    promptHash: over.promptHash ?? null, createdAt: over.createdAt ?? 0,
  };
}

const sets: AudioSet[] = [
  set({ id: 's1', name: 'footstep-stone', kind: 'sfx', eventKey: 'footstep', surface: 'stone' }),
  set({ id: 's2', name: 'footstep-wood', kind: 'sfx', eventKey: 'footstep', surface: 'wood' }),
  set({ id: 's3', name: 'cave-ambient', kind: 'ambient', eventKey: null, surface: null }),
];
const assets: AudioAsset[] = [
  asset({ id: 'a1', setId: 's1', durationMs: 800, favorite: true }),
  asset({ id: 'a2', setId: 's2', durationMs: 1500 }),
  asset({ id: 'a3', setId: 's3', durationMs: 12000, prompt: 'dripping water echo' }),
  asset({ id: 'orphan', setId: 'gone' }),
];

describe('joinAssets', () => {
  it('joins assets to sets and drops orphans', () => {
    const joined = joinAssets(sets, assets);
    expect(joined).toHaveLength(3);
    expect(joined.map((j) => j.asset.id)).not.toContain('orphan');
  });
});

describe('deriveFacets', () => {
  it('returns sorted distinct kinds/surfaces/eventKeys (nulls dropped)', () => {
    const f = deriveFacets(sets);
    expect(f.kinds).toEqual(['ambient', 'sfx']);
    expect(f.surfaces).toEqual(['stone', 'wood']);
    expect(f.eventKeys).toEqual(['footstep']);
  });
});

describe('filterAssets', () => {
  const items: AssetWithSet[] = joinAssets(sets, assets);

  it('passes everything through with the default filter', () => {
    expect(filterAssets(items, DEFAULT_FILTER)).toHaveLength(3);
  });

  it('filters by kind', () => {
    const r = filterAssets(items, { ...DEFAULT_FILTER, kind: 'ambient' });
    expect(r.map((x) => x.asset.id)).toEqual(['a3']);
  });

  it('filters by surface and event key', () => {
    expect(filterAssets(items, { ...DEFAULT_FILTER, surface: 'wood' }).map((x) => x.asset.id)).toEqual(['a2']);
    expect(filterAssets(items, { ...DEFAULT_FILTER, eventKey: 'footstep' })).toHaveLength(2);
  });

  it('filters by duration bucket', () => {
    expect(filterAssets(items, { ...DEFAULT_FILTER, duration: 'short' }).map((x) => x.asset.id)).toEqual(['a1']);
    expect(filterAssets(items, { ...DEFAULT_FILTER, duration: 'xl' }).map((x) => x.asset.id)).toEqual(['a3']);
    expect(filterAssets(items, { ...DEFAULT_FILTER, duration: 'med' }).map((x) => x.asset.id)).toEqual(['a2']);
  });

  it('filters favorites only', () => {
    expect(filterAssets(items, { ...DEFAULT_FILTER, favoritesOnly: true }).map((x) => x.asset.id)).toEqual(['a1']);
  });

  it('does a case-insensitive text search across asset + set fields', () => {
    expect(filterAssets(items, { ...DEFAULT_FILTER, text: 'WOOD' }).map((x) => x.asset.id)).toEqual(['a2']);
    expect(filterAssets(items, { ...DEFAULT_FILTER, text: 'dripping' }).map((x) => x.asset.id)).toEqual(['a3']);
  });

  it('combines facets (AND semantics)', () => {
    const r = filterAssets(items, { ...DEFAULT_FILTER, kind: 'sfx', surface: 'stone', favoritesOnly: true });
    expect(r.map((x) => x.asset.id)).toEqual(['a1']);
  });
});

describe('isFilterActive', () => {
  it('is false for the default and true once any facet is set', () => {
    expect(isFilterActive(DEFAULT_FILTER)).toBe(false);
    expect(isFilterActive({ ...DEFAULT_FILTER, text: 'x' })).toBe(true);
    expect(isFilterActive({ ...DEFAULT_FILTER, favoritesOnly: true })).toBe(true);
    expect(isFilterActive({ ...DEFAULT_FILTER, duration: 'short' })).toBe(true);
  });
});
