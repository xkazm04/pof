'use client';

import { useMemo } from 'react';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { EntityBaselinePanel } from '@/components/ecw/facets/shared/EntityBaselinePanel';
import { asLootBinding, computeExpectedValue, rarityBreakdown } from '@/lib/loot/economy';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * EV Baseline facet (ECW Phase 10-L). Snapshots the loot table's gold-per-kill
 * expected value + per-rarity contribution as a persisted baseline and shows
 * drift against it, so economy retunes are caught for review. A thin wrapper
 * over the shared EntityBaselinePanel (same persisted-store core as Bestiary's).
 */
export function LootBaselineFacet({ entity }: Props) {
  const current = useMemo(() => {
    const binding = asLootBinding(entity.data);
    if (!binding) return null;
    const stats = rarityBreakdown(binding).map((b) => ({ label: b.rarity, value: Math.round(b.contribution) }));
    return { score: computeExpectedValue(binding), stats };
  }, [entity.data]);

  return (
    <EntityBaselinePanel
      catalogId={entity.catalogId}
      entityId={entity.id}
      current={current}
      title="EV Baseline"
      scoreLabel="EV"
      scoreNoun="value"
      breakdownLabel="Value drift"
      emptyHint="No loot binding to baseline."
    />
  );
}

registerFacet('loot-tables', { id: 'baseline', label: 'Baseline', Component: LootBaselineFacet });
