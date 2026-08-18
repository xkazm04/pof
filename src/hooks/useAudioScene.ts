'use client';

import { useState, useCallback } from 'react';
import type {
  AudioSceneDocument,
  AudioSceneSummary,
  CreateAudioScenePayload,
  UpdateAudioScenePayload,
} from '@/types/audio-scene';
import { apiFetch } from '@/lib/api-utils';
import { useCRUD } from './useCRUD';

interface AudioSceneData {
  docs: AudioSceneDocument[];
  summary: AudioSceneSummary;
}

interface UseAudioSceneResult {
  docs: AudioSceneDocument[];
  summary: AudioSceneSummary;
  activeDoc: AudioSceneDocument | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  setActiveDocId: (id: number | null) => void;
  createDoc: (payload: CreateAudioScenePayload) => Promise<AudioSceneDocument | null>;
  updateDoc: (payload: UpdateAudioScenePayload) => Promise<AudioSceneDocument | null>;
  /**
   * Throwing variant of `updateDoc` used by the editing surfaces that hold a local
   * optimistic buffer (the scene painter's gesture commit, the debounced text
   * fields). `updateDoc` swallows the failure and returns `null`, which is
   * indistinguishable from "no active doc" — a buffer owner needs to know the write
   * failed so it can KEEP the user's edit and surface a retry. Resolves with the
   * persisted document, rejects with the server's own reason.
   */
  commitDoc: (payload: UpdateAudioScenePayload) => Promise<AudioSceneDocument>;
  deleteDoc: (id: number) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const EMPTY: AudioSceneData = {
  docs: [],
  summary: {
    totalScenes: 0,
    totalZones: 0,
    totalEmitters: 0,
    zonesByReverb: {},
    emittersByType: { ambient: 0, point: 0, loop: 0, oneshot: 0, music: 0 },
  },
};

const transform = (raw: unknown): AudioSceneData => {
  const d = raw as Partial<AudioSceneData>;
  return { docs: d.docs ?? [], summary: d.summary ?? EMPTY.summary };
};

export function useAudioScene(): UseAudioSceneResult {
  const { data, isLoading, error, refetch, mutate } = useCRUD<AudioSceneData>(
    '/api/audio-scene',
    EMPTY,
    { transform, errorMessage: 'Failed to load audio scenes' },
  );

  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const activeDoc = data.docs.find((d) => d.id === activeDocId) ?? null;

  const createDoc = useCallback(async (payload: CreateAudioScenePayload) => {
    const result = await mutate<{ doc: AudioSceneDocument }>('/api/audio-scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (result?.doc) setActiveDocId(result.doc.id);
    return result?.doc ?? null;
  }, [mutate]);

  const updateDoc = useCallback(async (payload: UpdateAudioScenePayload) => {
    const result = await mutate<{ doc: AudioSceneDocument }>('/api/audio-scene', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return result?.doc ?? null;
  }, [mutate]);

  const commitDoc = useCallback(async (payload: UpdateAudioScenePayload) => {
    // Deliberately bypasses useCRUD.mutate: `mutate` catches and returns null, and
    // the reason only lands in state a tick later. apiFetch throws the server's own
    // message, which is what the caller's error banner shows.
    const result = await apiFetch<{ doc: AudioSceneDocument }>('/api/audio-scene', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await refetch();
    return result.doc;
  }, [refetch]);

  const deleteDoc = useCallback(async (id: number) => {
    const result = await mutate<unknown>(`/api/audio-scene?id=${id}`, { method: 'DELETE' });
    if (result !== null && activeDocId === id) setActiveDocId(null);
    return result !== null;
  }, [activeDocId, mutate]);

  return {
    docs: data.docs,
    summary: data.summary,
    activeDoc,
    isLoading,
    error,
    retry: refetch,
    setActiveDocId,
    createDoc,
    updateDoc,
    commitDoc,
    deleteDoc,
    refetch,
  };
}
