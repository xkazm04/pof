'use client';

import { Activity, AlertTriangle } from 'lucide-react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { MontageEntry } from '@/components/modules/core-engine/sub_animation/_shared/data';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * State Graph detail facet — Phase 7b. Renders montage category, frames,
 * fps, memory, root-motion flag, and blend time. Loudly notes the AnimBP
 * graph remains MANUAL (the binary content wall identified in folder-09
 * R3) — the recipe's `author-python` step lands the montage asset; the
 * graph wiring is operator-side in the UE AnimBP editor.
 */
export function StateGraphDetailFacet({ entity }: Props) {
  const data = entity.data as MontageEntry | undefined;

  if (!data || typeof data !== 'object' || !('category' in data)) {
    return (
      <div className="px-4 py-3 text-xs text-text-muted/70 italic">
        No montage data for this entity.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <Activity className="w-4 h-4 text-text-muted" />
        <span className="font-mono uppercase tracking-wider text-text-muted">{data.category}</span>
        <span className="text-text">·</span>
        <span className="font-mono text-text">{data.totalFrames} frames</span>
        <span className="text-text">·</span>
        <span className="font-mono text-text">{data.fps} fps</span>
        <span className="text-text">·</span>
        <span className="font-mono text-text">{data.memorySizeMB} MB</span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="text-text-muted">Motion:</span>
        {data.hasRootMotion ? (
          <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
            root motion
          </span>
        ) : (
          <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface text-text-muted">
            in-place
          </span>
        )}
        <span className="text-text-muted">Blend in:</span>
        <span className="font-mono text-text">{data.blendInTime}s</span>
      </div>

      <div className="flex items-start gap-2 p-2 rounded border border-amber-500/30 bg-amber-500/10">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-2xs">
          <p className="font-bold text-amber-500 mb-0.5">MANUAL STEP REQUIRED</p>
          <p className="text-text-muted">
            The AnimBP graph (states · transitions · blendspaces · notify graphs) can&apos;t be authored from Python. The recipe lands the montage asset; finish wiring in the UE AnimBP editor by hand.
          </p>
        </div>
      </div>
    </div>
  );
}

registerFacet('state-graph', { id: 'detail', label: 'Detail', Component: StateGraphDetailFacet });
