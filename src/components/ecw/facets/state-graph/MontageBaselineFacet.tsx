'use client';

import { useMemo } from 'react';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { EntityBaselinePanel } from '@/components/ecw/facets/shared/EntityBaselinePanel';
import { asMontage } from '@/lib/animation/montage-analysis';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Memory Baseline facet (ECW Phase 10-F). Snapshots the montage's memory
 * footprint + frame count as a persisted baseline and shows drift against it, so
 * asset bloat from re-exports/retargets is caught for review. A thin wrapper over
 * the shared EntityBaselinePanel (4th catalog on the persisted-store shell).
 */
export function MontageBaselineFacet({ entity }: Props) {
  const current = useMemo(() => {
    const m = asMontage(entity.data);
    if (!m) return null;
    return {
      score: m.memorySizeMB,
      stats: [{ label: 'Frames', value: m.totalFrames }],
    };
  }, [entity.data]);

  return (
    <EntityBaselinePanel
      catalogId={entity.catalogId}
      entityId={entity.id}
      current={current}
      title="Memory Baseline"
      scoreLabel="Memory MB"
      scoreNoun="memory"
      breakdownLabel="Frame drift"
      emptyHint="No montage data to baseline."
    />
  );
}

registerFacet('state-graph', { id: 'baseline', label: 'Baseline', Component: MontageBaselineFacet });
