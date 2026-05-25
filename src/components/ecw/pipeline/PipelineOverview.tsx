'use client';

import { Factory } from 'lucide-react';
import { pipelineForCatalog, trackLabel, type PipelineTrackId } from '@/lib/pipeline/tracks';
import { useEntityTracks } from '@/stores/pipelineStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { TRACK_ICON, STATE_CLASSES, STATE_LABEL } from './trackVisuals';

interface Props {
  entity: StoredCatalogEntity;
  selectedTrack: PipelineTrackId | null;
  onSelectTrack: (trackId: PipelineTrackId) => void;
}

/**
 * The factory-pipeline overview — the top panel of the Entity Inspector. One
 * node per production track the entity's catalog requires, each colored by its
 * persisted coverage state. Clicking a node selects it (parent shows the
 * detail). Answers "what's left to make this entity playable?" at a glance.
 */
export function PipelineOverview({ entity, selectedTrack, onSelectTrack }: Props) {
  const tracks = pipelineForCatalog(entity.catalogId);
  const states = useEntityTracks(entity.catalogId, entity.id);

  const doneCount = tracks.filter((t) => states[t] === 'done').length;

  return (
    <section className="px-4 py-3 border-b border-border/40 bg-surface-deep/40">
      <header className="flex items-center gap-2 mb-3">
        <Factory className="w-4 h-4 text-text-muted" />
        <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted">Production Pipeline</h3>
        <span className="ml-auto text-2xs font-mono text-text-muted">
          {doneCount} / {tracks.length} tracks done
        </span>
      </header>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tracks.map((trackId, i) => {
          const state = states[trackId] ?? 'not-started';
          const Icon = TRACK_ICON[trackId];
          const cls = STATE_CLASSES[state];
          const selected = selectedTrack === trackId;
          return (
            <div key={trackId} className="flex items-center">
              <button
                data-testid="pipeline-node"
                onClick={() => onSelectTrack(trackId)}
                aria-label={`${trackLabel(trackId)} — ${STATE_LABEL[state]}`}
                aria-pressed={selected}
                className={`focus-ring flex flex-col items-center gap-1 px-2.5 py-2 rounded-lg border transition-colors min-w-[72px] ${cls.ring} ${
                  selected ? 'bg-surface' : 'bg-surface-deep hover:bg-surface/40'
                }`}
              >
                <span className="relative">
                  <Icon className="w-4 h-4 text-text" />
                  <span className={`absolute -top-1 -right-1.5 w-2 h-2 rounded-full ${cls.dot}`} />
                </span>
                <span className="text-2xs font-mono text-text">{trackLabel(trackId)}</span>
              </button>
              {i < tracks.length - 1 && (
                <span className="w-3 h-px bg-border/50 shrink-0" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
