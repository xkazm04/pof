'use client';

import { useMemo } from 'react';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { EntityBaselinePanel } from '@/components/ecw/facets/shared/EntityBaselinePanel';
import { asCombo, comboMetrics } from '@/lib/combat/combo-analysis';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * DPS Baseline facet (ECW Phase 10-C). Snapshots the combo's DPS + key metrics
 * (hits, total damage) as a persisted baseline and shows drift against it, so
 * combat retunes are caught for review. A thin wrapper over the shared
 * EntityBaselinePanel (4th reuse of the persisted-store template's core).
 */
export function CombatBaselineFacet({ entity }: Props) {
  const current = useMemo(() => {
    const combo = asCombo(entity.data);
    if (!combo) return null;
    const m = comboMetrics(combo);
    return {
      score: combo.dps,
      stats: [
        { label: 'Hits', value: m.hits },
        { label: 'Total dmg', value: Math.round(m.totalDamage) },
      ],
    };
  }, [entity.data]);

  return (
    <EntityBaselinePanel
      catalogId={entity.catalogId}
      entityId={entity.id}
      current={current}
      title="DPS Baseline"
      scoreLabel="DPS"
      scoreNoun="dps"
      breakdownLabel="Metric drift"
      emptyHint="No combo data to baseline."
    />
  );
}

registerFacet('combat-map', { id: 'baseline', label: 'Baseline', Component: CombatBaselineFacet });
