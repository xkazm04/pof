'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  LevelDesignDocument,
  LevelDesignSummary,
  CreateDocPayload,
  UpdateDocPayload,
  DifficultyLevel,
  RoomType,
} from '@/types/level-design';
import { apiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { useIsMounted } from '@/hooks/useIsMounted';
import { ok, err, type Result } from '@/types/result';

interface UseDesignDocumentResult {
  docs: LevelDesignDocument[];
  summary: LevelDesignSummary;
  activeDoc: LevelDesignDocument | null;
  /** True only while the FIRST load is in flight — a background refresh never
   *  raises it, so the editor is never unmounted underneath the user. */
  isLoading: boolean;
  /** True while a background (non-blanking) refresh is in flight. */
  isRefreshing: boolean;
  error: string | null;
  retry: () => void;
  setActiveDocId: (id: number | null) => void;
  createDoc: (payload: CreateDocPayload) => Promise<Result<LevelDesignDocument, string>>;
  updateDoc: (payload: UpdateDocPayload) => Promise<Result<LevelDesignDocument, string>>;
  deleteDoc: (id: number) => Promise<Result<true, string>>;
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

/**
 * Client-side twin of the server's `getSummary()` — same rules, same fields.
 *
 * The doc list already carries every input the summary needs (rooms + syncStatus),
 * so deriving it locally keeps the sidebar counters exact after an optimistic
 * mutation WITHOUT a second round trip. Two sources of truth would drift; one
 * derivation cannot.
 */
export function deriveSummary(docs: LevelDesignDocument[]): LevelDesignSummary {
  const difficultyDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DifficultyLevel, number>;
  const roomTypeDistribution = {
    combat: 0, puzzle: 0, exploration: 0, boss: 0,
    safe: 0, transition: 0, cutscene: 0, hub: 0,
  } as Record<RoomType, number>;

  let totalRooms = 0;
  let syncedCount = 0;
  let divergedCount = 0;
  let unlinkedCount = 0;

  for (const doc of docs) {
    if (doc.syncStatus === 'synced') syncedCount++;
    else if (doc.syncStatus === 'diverged' || doc.syncStatus === 'doc-ahead' || doc.syncStatus === 'code-ahead') divergedCount++;
    else if (doc.syncStatus === 'unlinked') unlinkedCount++;

    const rooms = doc.rooms ?? [];
    totalRooms += rooms.length;
    for (const room of rooms) {
      if (room.difficulty >= 1 && room.difficulty <= 5) difficultyDistribution[room.difficulty]++;
      if (room.type in roomTypeDistribution) roomTypeDistribution[room.type]++;
    }
  }

  return {
    totalDocs: docs.length,
    totalRooms,
    syncedCount,
    divergedCount,
    unlinkedCount,
    difficultyDistribution,
    roomTypeDistribution,
  };
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function useDesignDocument(): UseDesignDocumentResult {
  const [docs, setDocs] = useState<LevelDesignDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useIsMounted();
  // Monotonic fetch token: rapid create/update/remove each trigger fetchAll,
  // and their responses can land out of order. Only the newest fetch may commit.
  const fetchTokenRef = useRef(0);
  // A refresh is only "background" once something has successfully loaded — the
  // first load (and a retry after a hard error) still gets the blocking spinner.
  const hasLoadedRef = useRef(false);

  const fetchAll = useCallback(async (background = false) => {
    const token = ++fetchTokenRef.current;
    const silent = background && hasLoadedRef.current;
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ docs: LevelDesignDocument[] }>('/api/level-design');
      if (!isMounted() || token !== fetchTokenRef.current) return;
      hasLoadedRef.current = true;
      setDocs(data.docs ?? []);
    } catch (e) {
      logger.error('useDesignDocument fetch error:', e);
      if (isMounted() && token === fetchTokenRef.current) setError(messageOf(e, 'Failed to load level designs'));
    } finally {
      if (isMounted() && token === fetchTokenRef.current) {
        if (silent) setIsRefreshing(false);
        else setIsLoading(false);
      }
    }
  }, [isMounted]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const retry = useCallback(() => { void fetchAll(false); }, [fetchAll]);
  const refetch = useCallback(() => fetchAll(true), [fetchAll]);

  const activeDoc = docs.find((d) => d.id === activeDocId) ?? null;
  const summary = useMemo(() => (docs.length ? deriveSummary(docs) : EMPTY_SUMMARY), [docs]);

  const create = useCallback(async (payload: CreateDocPayload): Promise<Result<LevelDesignDocument, string>> => {
    try {
      const data = await apiFetch<{ doc: LevelDesignDocument }>('/api/level-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!data.doc) return err('Server returned no document');
      // The list is ordered by updated_at DESC, so a fresh row belongs at the head.
      // Merging locally beats a full re-GET (which re-parses every doc's blobs).
      if (isMounted()) {
        setDocs((cur) => [data.doc, ...cur.filter((d) => d.id !== data.doc.id)]);
        setActiveDocId(data.doc.id);
      }
      return ok(data.doc);
    } catch (e) {
      logger.error('useDesignDocument create error:', e);
      return err(messageOf(e, 'Failed to create level design'));
    }
  }, [isMounted]);

  /**
   * PUT one document. The response carries the authoritative row, so it is merged
   * into local state directly — no follow-up `fetchAll()`, which is what used to
   * blank the whole editor to a spinner on every keystroke and mouse-move.
   */
  const update = useCallback(async (payload: UpdateDocPayload): Promise<Result<LevelDesignDocument, string>> => {
    try {
      const data = await apiFetch<{ doc: LevelDesignDocument }>('/api/level-design', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!data.doc) return err('Server returned no document');
      if (isMounted()) setDocs((cur) => cur.map((d) => (d.id === data.doc.id ? data.doc : d)));
      return ok(data.doc);
    } catch (e) {
      logger.error('useDesignDocument update error:', e);
      return err(messageOf(e, 'Failed to save level design'));
    }
  }, [isMounted]);

  const remove = useCallback(async (id: number): Promise<Result<true, string>> => {
    try {
      await apiFetch<unknown>(`/api/level-design?id=${id}`, { method: 'DELETE' });
      if (isMounted()) {
        setDocs((cur) => cur.filter((d) => d.id !== id));
        setActiveDocId((cur) => (cur === id ? null : cur));
      }
      return ok(true as const);
    } catch (e) {
      logger.error('useDesignDocument delete error:', e);
      return err(messageOf(e, 'Failed to delete level design'));
    }
  }, [isMounted]);

  return {
    docs,
    summary,
    activeDoc,
    isLoading,
    isRefreshing,
    error,
    retry,
    setActiveDocId,
    createDoc: create,
    updateDoc: update,
    deleteDoc: remove,
    refetch,
  };
}
