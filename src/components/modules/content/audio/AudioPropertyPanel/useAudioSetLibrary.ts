'use client';

import { useCallback, useEffect } from 'react';
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
 * One library read shared by every mounted consumer (LISTEN's AuditionReadout and the
 * emitter panel's AssetSetPicker, which remounts per selected emitter). `useCRUD` has
 * no cache or in-flight dedupe, so each instance used to issue its own two GETs.
 *
 * The shared read lives only while a consumer is mounted. When the last one unmounts
 * the entry is dropped after the commit settles, not synchronously: a keyed remount unmounts
 * the old consumer and mounts the new one in the same commit, and must reuse the read.
 * Leaving the painter tab therefore drops the cache, so a set generated meanwhile in
 * the Sound Forge is read fresh on return, and `retry` always re-reads.
 */
const shared: { promise: Promise<LibraryData> | null; refs: number } = { promise: null, refs: 0 };

function acquireShared(): () => void {
  shared.refs += 1;
  return () => {
    shared.refs -= 1;
    // A microtask, not synchronous: a keyed remount runs the old cleanup and the new
    // effect in one commit, so by the time this runs the new consumer holds a ref.
    queueMicrotask(() => { if (shared.refs === 0) shared.promise = null; });
  };
}

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
  // Declared before useCRUD so the reference is held before its first fetch runs.
  useEffect(() => (enabled ? acquireShared() : undefined), [enabled]);

  const read = useCallback(async (): Promise<LibraryData> => {
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

  const fetcher = useCallback((): Promise<LibraryData> => {
    if (!shared.promise) {
      const p = read();
      shared.promise = p;
      // A failed read must not be served to the next consumer.
      p.catch(() => { if (shared.promise === p) shared.promise = null; });
    }
    return shared.promise;
  }, [read]);

  const { data, isLoading, error, refetch } = useCRUD<LibraryData>(
    '/api/audio-gen',
    EMPTY,
    { fetcher, skipInitialFetch: !enabled, errorMessage: 'Could not read the audio library' },
  );

  const retry = useCallback(() => { shared.promise = null; return refetch(); }, [refetch]);

  return { options: data.options, clipsBySet: data.clipsBySet, isLoading, error, retry };
}
