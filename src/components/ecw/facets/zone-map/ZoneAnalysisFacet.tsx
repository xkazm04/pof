'use client';

import { useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useCatalogEntities } from '@/stores/catalogStore';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { FindingList } from '@/components/ecw/infra/FindingList';
import { asZone, lintZone, type ZoneLike } from '@/lib/world/zone-analysis';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Zone Analysis facet (ECW Phase 10-F). Runs the connectivity + level-progression
 * lint over the selected zone + the full zone roster (read live from catalogStore):
 * inverted level ranges, dangling/dead-end connections, difficulty spikes, and
 * unreachable zones. The zone-map analogue of the Combat/Loot analysis facets.
 */
export function ZoneAnalysisFacet({ entity }: Props) {
  const roster = useCatalogEntities('zone-map');

  const model = useMemo(() => {
    const zone = asZone(entity.data);
    if (!zone) return null;
    const zones = roster
      .map((e) => asZone((e as StoredCatalogEntity).data))
      .filter((z): z is ZoneLike => z !== null);
    return { zone, findings: lintZone(zone, zones) };
  }, [entity.data, roster]);

  if (!model) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No zone data to analyse.</div>;
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <MapIcon className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Zone Analysis</span>
        <span className="ml-auto text-xs text-text-muted">
          Lv {model.zone.levelMin}–{model.zone.levelMax} · {model.zone.connections.length} link{model.zone.connections.length === 1 ? '' : 's'}
        </span>
      </div>

      <FindingList findings={model.findings} />
    </div>
  );
}

registerFacet('zone-map', { id: 'analysis', label: 'Analysis', Component: ZoneAnalysisFacet });
