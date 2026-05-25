'use client';

import { PipelineTrackDetail } from '@/components/ecw/pipeline/PipelineTrackDetail';
import { EntitySpecPanel } from '@/components/ecw/inspector/EntitySpecPanel';
import { getFacetsForCatalog } from '@/components/ecw/inspector/facetRegistry';
import { FacetErrorBoundary } from '@/components/ecw/infra/FacetErrorBoundary';
import type { TrackWorkspaceProps } from '@/components/ecw/inspector/trackWorkspaceRegistry';

/**
 * Logic track workspace (ECW Part 3b). The design/spec home: track state +
 * Evaluate-CLI, the entity's raw spec, and every per-catalog facet (Analysis /
 * Balance / Author / Baseline / Tuner / …) — the facets the old tab strip used
 * to host, now absorbed under Logic. Each facet is isolated by an error boundary.
 */
export function LogicWorkspace({ entity }: TrackWorkspaceProps) {
  const facets = getFacetsForCatalog(entity.catalogId);
  return (
    <div>
      <PipelineTrackDetail entity={entity} trackId="logic" />
      <EntitySpecPanel data={entity.data} />
      {facets.map((f) => (
        <FacetErrorBoundary key={f.id} facetLabel={f.label}>
          <f.Component entity={entity} />
        </FacetErrorBoundary>
      ))}
    </div>
  );
}
