'use client';

import { useState, createElement } from 'react';
import { Factory, LayoutGrid } from 'lucide-react';
import { pipelineForCatalog, trackLabel, type PipelineTrackId } from '@/lib/pipeline/tracks';
import { useEntityTracks } from '@/stores/pipelineStore';
import { getTrackWorkspace } from '@/components/ecw/inspector/trackWorkspaceRegistry';
import { OverviewWorkspace } from '@/components/ecw/inspector/OverviewWorkspace';
import { FacetErrorBoundary } from '@/components/ecw/infra/FacetErrorBoundary';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { TRACK_ICON, STATE_CLASSES, STATE_LABEL } from './trackVisuals';

interface Props {
  entity: StoredCatalogEntity;
}

type Tab = 'overview' | PipelineTrackId;

/**
 * The inspector's primary tab strip (ECW Part 3 + Overview B). A leading
 * Overview tab (metadata/assets/cross-links — the default landing view) followed
 * by one status-colored tab per production track the catalog requires; the
 * active tab renders its workspace inside an error boundary.
 */
export function TrackTabStrip({ entity }: Props) {
  const tracks = pipelineForCatalog(entity.catalogId);
  const states = useEntityTracks(entity.catalogId, entity.id);
  const [selected, setSelected] = useState<Tab>('overview');

  // Reset to Overview when the entity changes.
  const entityKey = `${entity.catalogId}/${entity.id}`;
  const [prevKey, setPrevKey] = useState(entityKey);
  if (prevKey !== entityKey) {
    setPrevKey(entityKey);
    setSelected('overview');
  }

  const doneCount = tracks.filter((t) => states[t] === 'done').length;
  const isOverview = selected === 'overview';

  return (
    <section className="border-b border-border/40">
      <header className="flex items-center gap-2 px-4 pt-3">
        <Factory className="w-4 h-4 text-text-muted" />
        <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted">Production Pipeline</h3>
        <span className="ml-auto text-xs text-text-muted">{doneCount} / {tracks.length} done</span>
      </header>

      <div role="tablist" aria-label="Entity views" className="flex items-center gap-1 overflow-x-auto px-3 pt-2 pb-1">
        <button
          role="tab"
          aria-selected={isOverview}
          aria-label="Overview"
          onClick={() => setSelected('overview')}
          className={`focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/40 text-2xs font-mono whitespace-nowrap transition-colors ${
            isOverview ? 'bg-surface text-text' : 'bg-surface-deep text-text-muted hover:bg-surface/40'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Overview
        </button>

        {tracks.map((trackId) => {
          const state = states[trackId] ?? 'not-started';
          const Icon = TRACK_ICON[trackId];
          const cls = STATE_CLASSES[state];
          const isSel = trackId === selected;
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

      <div role="tabpanel" aria-label={isOverview ? 'Overview' : `${trackLabel(selected as PipelineTrackId)} track`}>
        {isOverview ? (
          <OverviewWorkspace entity={entity} />
        ) : (
          <FacetErrorBoundary key={selected} facetLabel={trackLabel(selected as PipelineTrackId)}>
            {createElement(getTrackWorkspace(entity.catalogId, selected as PipelineTrackId), { entity, trackId: selected as PipelineTrackId })}
          </FacetErrorBoundary>
        )}
      </div>
    </section>
  );
}
