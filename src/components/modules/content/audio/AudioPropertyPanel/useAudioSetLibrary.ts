'use client';

import { useCallback } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { useCRUD } from '@/hooks/useCRUD';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';
import type { AudioImportResult } from '@/types/audio-import';

/** One generated audio set, with the two facts a binding decision needs. */
export interface AudioSetOption {
  id: string;
  name: string;
  kind: string;
  /** How many clips the set actually holds. */
  clipCount: number;
  /**
   * Cue path from the set's LAST RECORDED UE import, or `null` when the set has
   * never been imported. Absence is the verdict — it is never filled in with a
   * plausible-looking path.
   */
  cuePath: string | null;
}

interface LibraryData { options: AudioSetOption[] }

const EMPTY: LibraryData = { options: [] };

/**
 * The generated-asset library as an emitter binding sees it: every set, its clip
 * count, and whether UE has ever imported it.
 *
 * Two reads, because the two facts live in two places — `audio_sets`/`audio_assets`
 * (what was generated) and `audio_import_runs` (what UE actually took). The join
 * is by set NAME, which is what the import table records.
 *
 * `enabled` gates the fetch: a property panel that is neither bound nor browsing
 * costs nothing.
 */
export function useAudioSetLibrary(enabled: boolean) {
  const fetcher = useCallback(async (): Promise<LibraryData> => {
    const [lib, imports] = await Promise.all([
      apiFetch<{ sets: AudioSet[]; assets: AudioAsset[] }>('/api/audio-gen'),
      apiFetch<{ bySet: Record<string, AudioImportResult> }>('/api/audio/import-result'),
    ]);
    const clips = new Map<string, number>();
    for (const a of lib.assets ?? []) clips.set(a.setId, (clips.get(a.setId) ?? 0) + 1);
    return {
      options: (lib.sets ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        clipCount: clips.get(s.id) ?? 0,
        cuePath: imports.bySet?.[s.name]?.cuePath ?? null,
      })),
    };
  }, []);

  const { data, isLoading, error, retry } = useCRUD<LibraryData>(
    '/api/audio-gen',
    EMPTY,
    { fetcher, skipInitialFetch: !enabled, errorMessage: 'Could not read the audio library' },
  );

  return { options: data.options, isLoading, error, retry };
}
