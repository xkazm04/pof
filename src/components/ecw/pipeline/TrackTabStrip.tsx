'use client';

import { useState } from 'react';
import { Factory } from 'lucide-react';
import { pipelineForCatalog, trackLabel, type PipelineTrackId } from '@/lib/pipeline/tracks';
import { useEntityTracks } from '@/stores/pipelineStore';
import { getTrackWorkspace } from '@/components/ecw/inspector/trackWorkspaceRegistry';
import { FacetErrorBoundary } from '@/components/ecw/infra/FacetErrorBoundary';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { TRACK_ICON, STATE_CLASSES, STATE_LABEL } from './trackVisuals';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * The Production Pipeline as the inspector's primary tab strip (ECW Part 3a).
 * One status-colored tab per track the entity's catalog requires; the active
 * tab renders that track's workspace (from trackWorkspaceRegistry) inside an
 * error boundary. Replaces the old overview + detail split.
 */
export function TrackTabStrip({ entity }: Props) {
  const tracks = pipelineForCatalog(entity.catalogId);
  const states = useEntityTracks(entity.catalogId, entity.id);
  const [selected, setSelected] = useState<PipelineTrackId | null>(null);

  // Reset selection when the entity changes.
  const entityKey = `${entity.catalogId}/${entity.id}`;
  const [prevKey, setPrevKey] = useState(entityKey);
  if (prevKey !== entityKey) {
    setPrevKey(entityKey);
    setSelected(null);
  }

  const active = selected ?? tracks[0] ?? null;
  const doneCount = tracks.filter((t) => states[t] === 'done').length;

  if (!active) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No production tracks for this catalog.</div>;
  }

  const Workspace = getTrackWorkspace(entity.catalogId, active);

  return (
    <section className="border-b border-border/40">
      <header className="flex items-center gap-2 px-4 pt-3">
        <Factory className="w-4 h-4 text-text-muted" />
        <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted">Production Pipeline</h3>
        <span className="ml-auto text-2xs font-mono text-text-muted">{doneCount} / {tracks.length} done</span>
      </header>

      <div role="tablist" aria-label="Production tracks" className="flex items-center gap-1 overflow-x-auto px-3 pt-2 pb-1">
        {tracks.map((trackId) => {
          const state = states[trackId] ?? 'not-started';
          const Icon = TRACK_ICON[trackId];
          const cls = STATE_CLASSES[state];
          const isSel = trackId === active;
          return (
            <button
              key={trackId}
              role="tab"
              aria-selected={isSel}
              aria-label={`${trackLabel(trackId)} — ${STATE_LABEL[state]}`}
              onClick={() => setSelected(trackId)}
              className={`focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-2xs font-mono whitespace-nowrap transition-colors ${cls.ring} ${
                isSel ? 'bg-surface text-text' : 'bg-surface-deep text-text-muted hover:bg-surface/40'
              }`}
            >
              <span className="relative">
                <Icon className="w-3.5 h-3.5" />
                <span className={`absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full ${cls.dot}`} />
              </span>
              {trackLabel(trackId)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={`${trackLabel(active)} track`}>
        <FacetErrorBoundary key={active} facetLabel={trackLabel(active)}>
          <Workspace entity={entity} trackId={active} />
        </FacetErrorBoundary>
      </div>
    </section>
  );
}
