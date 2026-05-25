'use client';

import { Sparkles } from 'lucide-react';
import { trackLabel, trackHint, TRACK_STATES, type PipelineTrackId, type TrackState } from '@/lib/pipeline/tracks';
import { usePipelineStore, useEntityTracks } from '@/stores/pipelineStore';
import { useEntityTrackHelp } from '@/hooks/useEntityTrackHelp';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { TRACK_ICON, STATE_CLASSES, STATE_LABEL } from './trackVisuals';

interface Props {
  entity: StoredCatalogEntity;
  trackId: PipelineTrackId;
}

/**
 * Detail for the selected pipeline track: icon + label + hint, current state,
 * 4 state-setter buttons (optimistic store update + POST /api/pipeline), and
 * an "Evaluate with CLI" action that dispatches Claude to assess the track and
 * recommend next steps (output lands in the CLI Rail).
 */
export function PipelineTrackDetail({ entity, trackId }: Props) {
  const setTrackState = usePipelineStore((s) => s.setTrackState);
  const states = useEntityTracks(entity.catalogId, entity.id);
  const current = states[trackId] ?? 'not-started';
  const help = useEntityTrackHelp(entity);
  const Icon = TRACK_ICON[trackId];

  const applyState = (state: TrackState) => {
    setTrackState(entity.catalogId, entity.id, trackId, state); // optimistic
    void fetch('/api/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogId: entity.catalogId, entityId: entity.id, trackId, state }),
    }).catch(() => {});
  };

  return (
    <div className="px-4 py-3 border-b border-border/40 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-text" />
        <span className="text-sm font-semibold text-text">{trackLabel(trackId)}</span>
        <span className={`ml-auto text-2xs font-mono ${STATE_CLASSES[current].label}`}>
          {STATE_LABEL[current]}
        </span>
      </div>

      <p className="text-xs text-text-muted">{trackHint(trackId)}</p>

      <div className="flex flex-wrap gap-1.5">
        {TRACK_STATES.map((state) => {
          const selected = current === state;
          return (
            <button
              key={state}
              onClick={() => applyState(state)}
              aria-pressed={selected}
              className={`focus-ring text-2xs font-mono px-2 py-1 rounded border transition-colors ${
                selected
                  ? `${STATE_CLASSES[state].ring} bg-surface text-text`
                  : 'border-border/40 text-text-muted hover:text-text hover:bg-surface/40'
              }`}
            >
              {STATE_LABEL[state]}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => help.evaluate(trackId)}
        disabled={help.isRunning}
        className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>{help.isRunning ? 'Evaluating…' : 'Evaluate with CLI'}</span>
      </button>
    </div>
  );
}
