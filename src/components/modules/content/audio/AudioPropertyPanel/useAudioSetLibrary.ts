'use client';

import { useCallback } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { useCRUD } from '@/hooks/useCRUD';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';
import type { AudioImportResult } from '@/types/audio-import';
import type { AuditionClip, AuditionLibrary } from '@/lib/audio-scene-audition';

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
  /** Longest non-zero clip length in the set; 0 when no clip records a length (unknown, not silent). */
  clipMs?: number;
  /** The set was generated as a loop — one voice holds its slot until stopped. */
  loopable?: boolean;
}

interface LibraryData {
  options: AudioSetOption[];
  /** setId -> its clips (relPath + favorite): what the painter LISTEN mode plays. */
  clipsBySet: AuditionLibrary;
}

const EMPTY: LibraryData = { options: [], clipsBySet: {} };

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
    const clipsBySet: Record<string, AuditionClip[]> = {};
    for (const s of lib.sets ?? []) clipsBySet[s.id] = [];
    const clipMsBySet: Record<string, number> = {};
    for (const a of lib.assets ?? []) {
      clipsBySet[a.setId]?.push({ relPath: a.relPath, favorite: a.favorite });
      if (a.durationMs > 0) clipMsBySet[a.setId] = Math.max(clipMsBySet[a.setId] ?? 0, a.durationMs);
    }
    return {
      clipsBySet,
      options: (lib.sets ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        clipCount: clipsBySet[s.id].length,
        cuePath: imports.bySet?.[s.name]?.cuePath ?? null,
        clipMs: clipMsBySet[s.id] ?? 0,
        loopable: s.loopable === true,
      })),
    };
  }, []);

  const { data, isLoading, error, retry } = useCRUD<LibraryData>(
    '/api/audio-gen',
    EMPTY,
    { fetcher, skipInitialFetch: !enabled, errorMessage: 'Could not read the audio library' },
  );

  return { options: data.options, clipsBySet: data.clipsBySet, isLoading, error, retry };
}
