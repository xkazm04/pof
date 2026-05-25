'use client';

import { PipelineTrackDetail } from '@/components/ecw/pipeline/PipelineTrackDetail';
import type { PipelineTrackId } from '@/lib/pipeline/tracks';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
  trackId: PipelineTrackId;
}

/** Tracks whose external generation pipeline isn't wired yet — shown honestly. */
const PENDING_TOOLING = new Set<PipelineTrackId>(['art-3d', 'vfx']);

/**
 * Fallback track workspace (ECW Part 3a). Renders the track's coverage state +
 * setters + Evaluate-with-CLI (PipelineTrackDetail). For tracks without a ready
 * generation pipeline (3D mesh-gen, VFX) it adds an honest "pending" note rather
 * than fake tooling. Specialized tracks (Logic/Test/2D/…) register their own.
 */
export function DefaultTrackWorkspace({ entity, trackId }: Props) {
  return (
    <div>
      <PipelineTrackDetail entity={entity} trackId={trackId} />
      {PENDING_TOOLING.has(trackId) && (
        <p className="px-4 py-3 text-xs text-text-muted/70 italic">
          Generation pipeline pending — author/evaluate via CLI for now; one-click generation lands when the external tooling matures.
        </p>
      )}
    </div>
  );
}
