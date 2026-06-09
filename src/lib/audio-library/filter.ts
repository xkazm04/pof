import type { AudioAsset, AudioSet } from '@/types/audio-asset';
import type { AudioKind } from '@/lib/audio-gen/types';

/** An asset paired with the metadata of the set it belongs to. */
export interface AssetWithSet {
  asset: AudioAsset;
  set: AudioSet;
}

/** Duration buckets for the facet UI (ms ranges). `max: null` = open-ended. */
export interface DurationBucket {
  id: string;
  label: string;
  min: number;
  max: number | null;
}

export const DURATION_BUCKETS: DurationBucket[] = [
  { id: 'short', label: '< 1s', min: 0, max: 1000 },
  { id: 'med', label: '1–3s', min: 1000, max: 3000 },
  { id: 'long', label: '3–10s', min: 3000, max: 10000 },
  { id: 'xl', label: '> 10s', min: 10000, max: null },
];

export interface LibraryFilter {
  text: string;
  kind: AudioKind | 'all';
  surface: string;
  eventKey: string;
  /** Duration bucket id from DURATION_BUCKETS, or 'all'. */
  duration: string;
  favoritesOnly: boolean;
}

export const DEFAULT_FILTER: LibraryFilter = {
  text: '',
  kind: 'all',
  surface: 'all',
  eventKey: 'all',
  duration: 'all',
  favoritesOnly: false,
};

/** Join asset rows to their parent set, dropping orphans (set already gone). */
export function joinAssets(sets: AudioSet[], assets: AudioAsset[]): AssetWithSet[] {
  const byId = new Map(sets.map((s) => [s.id, s]));
  const out: AssetWithSet[] = [];
  for (const asset of assets) {
    const set = byId.get(asset.setId);
    if (set) out.push({ asset, set });
  }
  return out;
}

/** The distinct facet values present in the library, for populating dropdowns. */
export function deriveFacets(sets: AudioSet[]): {
  kinds: AudioKind[];
  surfaces: string[];
  eventKeys: string[];
} {
  const kinds = new Set<AudioKind>();
  const surfaces = new Set<string>();
  const eventKeys = new Set<string>();
  for (const s of sets) {
    kinds.add(s.kind);
    if (s.surface) surfaces.add(s.surface);
    if (s.eventKey) eventKeys.add(s.eventKey);
  }
  return {
    kinds: [...kinds].sort(),
    surfaces: [...surfaces].sort(),
    eventKeys: [...eventKeys].sort(),
  };
}

function matchesDuration(durationMs: number, bucketId: string): boolean {
  if (bucketId === 'all') return true;
  const bucket = DURATION_BUCKETS.find((b) => b.id === bucketId);
  if (!bucket) return true;
  if (durationMs < bucket.min) return false;
  if (bucket.max !== null && durationMs >= bucket.max) return false;
  return true;
}

/** Apply the faceted filter. Returns matching asset+set pairs (input order). */
export function filterAssets(items: AssetWithSet[], f: LibraryFilter): AssetWithSet[] {
  const needle = f.text.trim().toLowerCase();
  return items.filter(({ asset, set }) => {
    if (f.favoritesOnly && !asset.favorite) return false;
    if (f.kind !== 'all' && set.kind !== f.kind) return false;
    if (f.surface !== 'all' && (set.surface ?? '') !== f.surface) return false;
    if (f.eventKey !== 'all' && (set.eventKey ?? '') !== f.eventKey) return false;
    if (!matchesDuration(asset.durationMs, f.duration)) return false;
    if (needle) {
      const haystack = [
        asset.filename, asset.prompt, set.name,
        set.eventKey ?? '', set.surface ?? '', set.kind,
      ].join(' ').toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/** True when any facet (not just empty text) is narrowing the results. */
export function isFilterActive(f: LibraryFilter): boolean {
  return (
    f.text.trim() !== '' ||
    f.kind !== 'all' ||
    f.surface !== 'all' ||
    f.eventKey !== 'all' ||
    f.duration !== 'all' ||
    f.favoritesOnly
  );
}
