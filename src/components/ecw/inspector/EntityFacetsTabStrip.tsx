'use client';

import { useState, useMemo } from 'react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { getFacetsForCatalog } from './facetRegistry';

interface Props {
  entity?: StoredCatalogEntity;
}

/**
 * Per-catalog custom-facets tab strip. Reads `facetRegistry` for the active
 * entity's catalog and renders a tab strip of registered facets. Empty
 * state when no facets are registered yet (Phase 7 ships bestiary only —
 * Phase 7b adds combat-map, screen-flow, zone-map, state-graph).
 */
export function EntityFacetsTabStrip({ entity }: Props) {
  const facets = useMemo(
    () => (entity ? getFacetsForCatalog(entity.catalogId) : []),
    [entity],
  );
  const [activeId, setActiveId] = useState<string | null>(facets[0]?.id ?? null);

  // If the entity changed and the active facet no longer exists, reset.
  if (facets.length > 0 && (activeId === null || !facets.some((f) => f.id === activeId))) {
    setActiveId(facets[0].id);
  }

  if (!entity || facets.length === 0) {
    return (
      <section className="px-4 py-3" role="tabpanel" aria-label="Per-catalog facets">
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Facets</span>
        <p className="text-2xs text-text-muted/60 italic mt-1">
          No custom facets registered for this catalog yet. Phase 7b migrates the remaining 4 Core Engine modules.
        </p>
      </section>
    );
  }

  const active = facets.find((f) => f.id === activeId) ?? facets[0];

  return (
    <section className="border-t border-border/40">
      <div role="tablist" aria-label="Per-catalog facets" className="flex items-center gap-1 px-3 pt-2">
        {facets.map((f) => {
          const selected = f.id === active.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(f.id)}
              className={`focus-ring px-2.5 py-1 rounded-md text-2xs font-mono uppercase tracking-wider transition-colors ${
                selected
                  ? 'bg-surface text-text'
                  : 'text-text-muted hover:text-text hover:bg-surface/40'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div>
        <active.Component entity={entity} />
      </div>
    </section>
  );
}
