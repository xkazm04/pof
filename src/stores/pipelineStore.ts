'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { PipelineTrackId, TrackState } from '@/lib/pipeline/tracks';
import type { PipelineTrackRecord } from '@/lib/pipeline/types';

export type EntityTrackMap = Partial<Record<PipelineTrackId, TrackState>>;

interface PipelineState {
  /** tracksByEntity['catalogId/entityId'][trackId] = TrackState */
  tracksByEntity: Record<string, EntityTrackMap>;

  /** Merge persisted records for one entity into the store (called on entity open). */
  loadTracks: (catalogId: string, entityId: string, records: PipelineTrackRecord[]) => void;
  /** Optimistically set one track's state (callers also POST /api/pipeline). */
  setTrackState: (catalogId: string, entityId: string, trackId: PipelineTrackId, state: TrackState) => void;
  /** Read all known track states for an entity (empty object if unloaded). */
  getEntityTracks: (catalogId: string, entityId: string) => EntityTrackMap;
}

export function entityKey(catalogId: string, entityId: string): string {
  return `${catalogId}/${entityId}`;
}

/**
 * Per-entity production-track state. The DB (`pipeline-db.ts` via /api/pipeline)
 * is the source of truth; this store is loaded on entity open and updated
 * optimistically on user edits. Nothing persisted client-side (no persist
 * middleware) — DB owns it, mirroring the catalogStore lifecycle convention.
 */
export const usePipelineStore = create<PipelineState>()((set, get) => ({
  tracksByEntity: {},

  loadTracks: (catalogId, entityId, records) =>
    set((s) => {
      const map: EntityTrackMap = {};
      for (const r of records) map[r.trackId] = r.state;
      return { tracksByEntity: { ...s.tracksByEntity, [entityKey(catalogId, entityId)]: map } };
    }),

  setTrackState: (catalogId, entityId, trackId, state) =>
    set((s) => {
      const key = entityKey(catalogId, entityId);
      const current = s.tracksByEntity[key] ?? {};
      return {
        tracksByEntity: { ...s.tracksByEntity, [key]: { ...current, [trackId]: state } },
      };
    }),

  getEntityTracks: (catalogId, entityId) => get().tracksByEntity[entityKey(catalogId, entityId)] ?? {},
}));

/** Reactive selector hook for one entity's track states. */
export function useEntityTracks(catalogId: string, entityId: string): EntityTrackMap {
  return usePipelineStore(useShallow((s) => s.tracksByEntity[entityKey(catalogId, entityId)] ?? {}));
}
