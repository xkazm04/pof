'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  LevelDesignDocument,
  LevelDesignSummary,
  CreateDocPayload,
  UpdateDocPayload,
} from '@/types/level-design';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';

interface UseDesignDocumentResult {
  docs: LevelDesignDocument[];
  summary: LevelDesignSummary;
  activeDoc: LevelDesignDocument | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  setActiveDocId: (id: number | null) => void;
  createDoc: (payload: CreateDocPayload) => Promise<LevelDesignDocument | null>;
  updateDoc: (payload: UpdateDocPayload) => Promise<LevelDesignDocument | null>;
  deleteDoc: (id: number) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const EMPTY_SUMMARY: LevelDesignSummary = {
  totalDocs: 0,
  totalRooms: 0,
  syncedCount: 0,
  divergedCount: 0,
  unlinkedCount: 0,
  difficultyDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  roomTypeDistribution: {
    combat: 0, puzzle: 0, exploration: 0, boss: 0,
    safe: 0, transition: 0, cutscene: 0, hub: 0,
  },
};

export function useDesignDocument(): UseDesignDocumentResult {
  const [docs, setDocs] = useState<LevelDesignDocument[]>([]);
  const [summary, setSummary] = useState<LevelDesignSummary>(EMPTY_SUMMARY);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useIsMounted();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ docs: LevelDesignDocument[]; summary: LevelDesignSummary }>('/api/level-design');
      if (!isMounted()) return;
      setDocs(data.docs ?? []);
      setSummary(data.summary ?? EMPTY_SUMMARY);
    } catch (err) {
      console.error('useDesignDocument fetch error:', err);
      if (isMounted()) setError(err instanceof Error ? err.message : 'Failed to load level designs');
    } finally {
      if (isMounted()) setIsLoading(false);
    }
  }, [isMounted]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeDoc = docs.find((d) => d.id === activeDocId) ?? null;

  const create = useCallback(async (payload: CreateDocPayload) => {
    try {
      const data = await apiFetch<{ doc: LevelDesignDocument }>('/api/level-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchAll();
      if (data.doc) setActiveDocId(data.doc.id);
      return data.doc;
    } catch (err) {
      console.error('useDesignDocument create error:', err);
      return null;
    }
  }, [fetchAll]);

  const update = useCallback(async (payload: UpdateDocPayload) => {
    try {
      const data = await apiFetch<{ doc: LevelDesignDocument }>('/api/level-design', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchAll();
      return data.doc;
    } catch (err) {
      console.error('useDesignDocument update error:', err);
      return null;
    }
  }, [fetchAll]);

  const remove = useCallback(async (id: number) => {
    try {
      await apiFetch<unknown>(`/api/level-design?id=${id}`, { method: 'DELETE' });
      if (activeDocId === id) setActiveDocId(null);
      await fetchAll();
      return true;
    } catch (err) {
      console.error('useDesignDocument delete error:', err);
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
