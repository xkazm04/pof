'use client';

import { ArrowRight } from 'lucide-react';
import { useEcwStore } from '@/stores/ecwStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Renders the entity's `links: CatalogLink[]` as click-through buttons. Click
 * routes through `useEcwStore.selectEntity(catalogId, entityId)`, which the
 * Catalog Hub (Phase 3) listens to and swaps the inspector pane to the linked
 * entity. Cross-catalog navigation, no URL change yet — query-param sync lands
 * in Phase 12 cutover.
 */
export function EntityCrossLinksPanel({ entity }: Props) {
  const selectEntity = useEcwStore((s) => s.selectEntity);
  const links = entity.links ?? [];

  return (
    <section className="border-b border-border/40 px-4 py-3 space-y-2">
      <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Cross-links</span>
      {links.length === 0 ? (
        <p className="text-xs text-text-muted/70 italic">No cross-catalog links.</p>
      ) : (
        <ul className="space-y-1">
          {links.map((link, i) => (
            <li key={`${link.catalogId}-${link.entityId}-${i}`}>
              <button
                onClick={() => selectEntity(link.catalogId, link.entityId)}
                className="focus-ring w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left hover:bg-surface/30"
                aria-label={`jump to ${link.catalogId} ${link.entityId}`}
              >
                <span className="text-2xs font-mono uppercase tracking-wider text-text-muted shrink-0 min-w-[3.5rem]">
                  {link.role}
                </span>
                <span className="font-mono text-text truncate">
                  {link.catalogId} ▸ {link.entityId}
                </span>
                <ArrowRight className="w-3 h-3 text-text-muted ml-auto shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
