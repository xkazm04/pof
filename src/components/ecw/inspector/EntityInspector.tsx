'use client';

import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { EmptyInspector } from './EmptyInspector';
import { EntityHeader } from './EntityHeader';
import { TrackTabStrip } from '@/components/ecw/pipeline/TrackTabStrip';
// Side-effect import — register the specialized track workspaces (Logic absorbs the facets).
import '@/components/ecw/pipeline/workspaces/register';
// Side-effect imports — register per-catalog custom facets at module load (now rendered inside the Logic workspace).
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
import '@/components/ecw/facets/combat-map/CombatTunerFacet';
import '@/components/ecw/facets/screen-flow/ScreenFlowDetailFacet';
import '@/components/ecw/facets/screen-flow/ScreenAuthorFacet';
import '@/components/ecw/facets/zone-map/ZoneMapDetailFacet';
import '@/components/ecw/facets/zone-map/ZoneAnalysisFacet';
import '@/components/ecw/facets/zone-map/ZoneAuthorFacet';
import '@/components/ecw/facets/state-graph/StateGraphDetailFacet';
import '@/components/ecw/facets/state-graph/MontageAnalysisFacet';
import '@/components/ecw/facets/state-graph/MontageBaselineFacet';
import '@/components/ecw/facets/state-graph/MontageAuthorFacet';

interface Props {
  entity: StoredCatalogEntity | null;
}

/**
 * The universal Entity Inspector primitive (ECW Part 3 + Overview B). For a
 * selected entity: EntityHeader (name · breadcrumb · (Re)generate · lifecycle
 * badge) + TrackTabStrip — whose default Overview tab hosts metadata/assets/
 * cross-links, and whose track tabs host their workspaces (Logic absorbs Spec +
 * the per-catalog facets, Test the functional test, 2D Leonardo, others status + CLI).
 *
 * Composition only. Mutations are scoped to children (CrossLinks →
 * ecwStore.selectEntity; track-state → pipelineStore + /api/pipeline).
 */
export function EntityInspector({ entity }: Props) {
  if (!entity) return <EmptyInspector />;

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <EntityHeader entity={entity} />
      <TrackTabStrip entity={entity} />
    </div>
  );
}
