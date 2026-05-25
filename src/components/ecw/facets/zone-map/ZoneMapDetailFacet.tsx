'use client';

import { Map as MapIcon } from 'lucide-react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { ZoneRecord } from '@/components/modules/core-engine/sub_world/_shared/data';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Zone Map detail facet — Phase 7b. Renders the zone's type, status,
 * level range, and adjacent zone connections. The 3D zone twin
 * (4328916d) lands in Phase 10 / Phase 6b.
 */
export function ZoneMapDetailFacet({ entity }: Props) {
  const data = entity.data as ZoneRecord | undefined;

  if (!data || typeof data !== 'object' || !('type' in data)) {
    return (
      <div className="px-4 py-3 text-xs text-text-muted/70 italic">
        No zone data for this entity.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <MapIcon className="w-4 h-4 text-text-muted" />
        <span className="font-mono uppercase tracking-wider text-text-muted">{data.type}</span>
        <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface text-text">{data.status}</span>
        <span className="text-text">·</span>
        <span className="font-mono text-text">Lv {data.levelRange}</span>
      </div>

      <section>
        <h3 className="text-2xs font-mono uppercase tracking-wider text-text-muted mb-2">
          Connections ({data.connections.length})
        </h3>
        {data.connections.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {data.connections.map((c) => (
              <li
                key={c}
                className="text-2xs font-mono px-2 py-0.5 rounded bg-surface text-text border border-border/40"
              >
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-muted/70 italic">No adjacent zones.</p>
        )}
      </section>
    </div>
  );
}

registerFacet('zone-map', { id: 'detail', label: 'Detail', Component: ZoneMapDetailFacet });
