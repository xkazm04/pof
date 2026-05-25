'use client';

import { useEffect, useState } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineForCatalog, type PipelineTrackId } from '@/lib/pipeline/tracks';
import type { PipelineTrackRecord } from '@/lib/pipeline/types';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { PipelineOverview } from './PipelineOverview';
import { PipelineTrackDetail } from './PipelineTrackDetail';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Top-panel wrapper composing the pipeline overview + selected-track detail.
 * Loads persisted track states from `/api/pipeline` on entity open (the DB is
 * source of truth), holds the selected-track UI state, and resets selection
 * when the entity changes.
 */
export function EntityPipelinePanel({ entity }: Props) {
  const [selected, setSelected] = useState<PipelineTrackId | null>(null);
  const loadTracks = usePipelineStore((s) => s.loadTracks);

  // Reset the selected track when switching entities.
  const entityKeyStr = `${entity.catalogId}/${entity.id}`;
  const [prevKey, setPrevKey] = useState(entityKeyStr);
  if (prevKey !== entityKeyStr) {
    setPrevKey(entityKeyStr);
    setSelected(null);
  }

  // Load persisted track states on entity open.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pipeline?catalogId=${encodeURIComponent(entity.catalogId)}&entityId=${encodeURIComponent(entity.id)}`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: PipelineTrackRecord[] }) => {
        if (!cancelled && res.success && res.data) {
          loadTracks(entity.catalogId, entity.id, res.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entity.catalogId, entity.id, loadTracks]);

  // Default the selected track to the first one with no selection yet.
  const tracks = pipelineForCatalog(entity.catalogId);
  const activeTrack = selected ?? tracks[0] ?? null;

  return (
    <>
      <PipelineOverview entity={entity} selectedTrack={activeTrack} onSelectTrack={setSelected} />
      {activeTrack && <PipelineTrackDetail entity={entity} trackId={activeTrack} />}
    </>
  );
}
