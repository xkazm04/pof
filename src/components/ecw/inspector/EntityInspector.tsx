'use client';

import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { EmptyInspector } from './EmptyInspector';
import { EntityHeader } from './EntityHeader';
import { EntitySpecPanel } from './EntitySpecPanel';
import { EntityLifecyclePanel } from './EntityLifecyclePanel';
import { EntityCrossLinksPanel } from './EntityCrossLinksPanel';
import { EntityFunctionalTestPanel } from './EntityFunctionalTestPanel';
import { EntityFacetsTabStrip } from './EntityFacetsTabStrip';
import { EntityPipelinePanel } from '@/components/ecw/pipeline/EntityPipelinePanel';
// Side-effect imports — register per-catalog custom facets at module load.
import '@/components/ecw/facets/bestiary/BestiaryDetailFacet';
import '@/components/ecw/facets/bestiary/BestiaryBalanceFacet';
import '@/components/ecw/facets/bestiary/ThreatScoreFacet';
import '@/components/ecw/facets/bestiary/BestiaryAiFacet';
import '@/components/ecw/facets/bestiary/BestiaryRemixFacet';
import '@/components/ecw/facets/bestiary/BestiaryBaselineFacet';
import '@/components/ecw/facets/bestiary/BestiaryEncounterFacet';
import '@/components/ecw/facets/loot/LootEconomyFacet';
import '@/components/ecw/facets/loot/LootAuthorFacet';
import '@/components/ecw/facets/loot/LootBaselineFacet';
import '@/components/ecw/facets/loot/LootBalancerFacet';
import '@/components/ecw/facets/combat-map/CombatMapDetailFacet';
import '@/components/ecw/facets/combat-map/CombatAnalysisFacet';
import '@/components/ecw/facets/combat-map/CombatChoreographerFacet';
import '@/components/ecw/facets/combat-map/CombatBaselineFacet';
import '@/components/ecw/facets/screen-flow/ScreenFlowDetailFacet';
import '@/components/ecw/facets/zone-map/ZoneMapDetailFacet';
import '@/components/ecw/facets/state-graph/StateGraphDetailFacet';

interface Props {
  entity: StoredCatalogEntity | null;
}

/**
 * The universal Entity Inspector primitive. For a selected entity it renders,
 * top to bottom:
 *  - EntityHeader (name · breadcrumb · (Re)generate · lifecycle badge)
 *  - EntityPipelinePanel (the production pipeline — the "is this playable?"
 *    answer; top panel per ECW addendum 13.2)
 *  - generic panels: Spec · Lifecycle+UE · CrossLinks · Functional Test
 *  - EntityFacetsTabStrip (per-catalog custom facets from facetRegistry)
 *
 * Composition only. Mutations are scoped to the children (CrossLinks →
 * ecwStore.selectEntity; pipeline track-state → pipelineStore + /api/pipeline;
 * (Re)generate → CLI Rail via useGeneration).
 */
export function EntityInspector({ entity }: Props) {
  if (!entity) return <EmptyInspector />;

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <EntityHeader entity={entity} />
      <EntityPipelinePanel entity={entity} />
      <EntitySpecPanel data={entity.data} />
      <EntityLifecyclePanel entity={entity} />
      <EntityCrossLinksPanel entity={entity} />
      <EntityFunctionalTestPanel entity={entity} />
      <EntityFacetsTabStrip entity={entity} />
    </div>
  );
}
