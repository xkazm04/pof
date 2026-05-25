'use client';

import { useMemo } from 'react';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { EntityBaselinePanel } from '@/components/ecw/facets/shared/EntityBaselinePanel';
import { computeThreatScore, type StatRow } from '@/lib/balance/threat-score';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

function statsOf(data: unknown): StatRow[] | null {
  if (!data || typeof data !== 'object') return null;
  const s = (data as { stats?: unknown }).stats;
  if (!Array.isArray(s) || s.length === 0) return null;
  return s as StatRow[];
}

/**
 * Balance Baseline facet (ECW Phase 10-B, idea 375a9f88). Snapshots the
 * archetype's threat score + stats as a persisted baseline and shows drift
 * against it, so unintended balance changes surface for review. A thin wrapper
 * over the shared EntityBaselinePanel (the persisted-store template's reusable core).
 */
export function BestiaryBaselineFacet({ entity }: Props) {
  const current = useMemo(() => {
    const stats = statsOf(entity.data);
    if (!stats) return null;
    return { score: computeThreatScore(stats), stats };
  }, [entity.data]);

  return (
    <EntityBaselinePanel
      catalogId={entity.catalogId}
      entityId={entity.id}
      current={current}
      title="Balance Baseline"
      scoreLabel="Threat"
      scoreNoun="threat"
      breakdownLabel="Stat drift"
      emptyHint="No stat data to baseline."
    />
  );
}

registerFacet('bestiary', { id: 'baseline', label: 'Baseline', Component: BestiaryBaselineFacet });
