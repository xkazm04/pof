'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AudioSceneDocument,
  AudioSceneSummary,
  CreateAudioScenePayload,
  UpdateAudioScenePayload,
} from '@/types/audio-scene';
import { apiFetch } from '@/lib/api-utils';

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
  deleteDoc: (id: number) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const EMPTY_SUMMARY: AudioSceneSummary = {
  totalScenes: 0,
  totalZones: 0,
  totalEmitters: 0,
  zonesByReverb: {},
  emittersByType: { ambient: 0, point: 0, loop: 0, oneshot: 0, music: 0 },
};

export function useAudioScene(): UseAudioSceneResult {
  const [docs, setDocs] = useState<AudioSceneDocument[]>([]);
  const [summary, setSummary] = useState<AudioSceneSummary>(EMPTY_SUMMARY);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ docs: AudioSceneDocument[]; summary: AudioSceneSummary }>('/api/audio-scene');
      if (!mountedRef.current) return;
      setDocs(data.docs ?? []);
      setSummary(data.summary ?? EMPTY_SUMMARY);
    } catch (err) {
      console.error('useAudioScene fetch error:', err);
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load audio scenes');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeDoc = docs.find((d) => d.id === activeDocId) ?? null;

  const create = useCallback(async (payload: CreateAudioScenePayload) => {
    try {
      const data = await apiFetch<{ doc: AudioSceneDocument }>('/api/audio-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchAll();
      if (data.doc) setActiveDocId(data.doc.id);
      return data.doc;
    } catch (err) {
      console.error('useAudioScene create error:', err);
      return null;
    }
  }, [fetchAll]);

  const update = useCallback(async (payload: UpdateAudioScenePayload) => {
    try {
      const data = await apiFetch<{ doc: AudioSceneDocument }>('/api/audio-scene', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchAll();
      return data.doc;
    } catch (err) {
      console.error('useAudioScene update error:', err);
      return null;
    }
  }, [fetchAll]);

  const remove = useCallback(async (id: number) => {
    try {
      await apiFetch<unknown>(`/api/audio-scene?id=${id}`, { method: 'DELETE' });
      if (activeDocId === id) setActiveDocId(null);
      await fetchAll();
      return true;
    } catch (err) {
      console.error('useAudioScene delete error:', err);
      return false;
    }
  }, [activeDocId, fetchAll]);

  return {
    docs,
    summary,
    activeDoc,
    isLoading,
    error,
    retry: fetchAll,
    setActiveDocId,
    createDoc: create,
    updateDoc: update,
    deleteDoc: remove,
    refetch: fetchAll,
  };
}
