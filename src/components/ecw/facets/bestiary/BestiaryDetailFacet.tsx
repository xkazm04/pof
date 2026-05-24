'use client';

import { Skull } from 'lucide-react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { ArchetypeConfig } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Phase 7 proof: the Bestiary detail facet rendering archetype role/tier/
 * class, stat rows, and abilities for the selected entity. Compact subset
 * of the full ArchetypesTab — the rest of that tab (radar comparison,
 * encounters, elite modifiers, codegen modal) lands in Phase 7b once the
 * facet registry pattern is proven here.
 */
export function BestiaryDetailFacet({ entity }: Props) {
  const data = entity.data as ArchetypeConfig | undefined;

  if (!data || typeof data !== 'object' || !('role' in data)) {
    return (
      <div className="px-4 py-3 text-xs text-text-muted/70 italic">
        No archetype data for this entity.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Skull className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">{data.role}</span>
        <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface text-text">{data.tier}</span>
        <span className="text-2xs font-mono text-text-muted">· {data.class}</span>
      </div>

      <section>
        <h3 className="text-2xs font-mono uppercase tracking-wider text-text-muted mb-2">Stats</h3>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
          {data.stats?.map((s, i) => (
            <li key={`${s.label}-${i}`} className="flex items-center gap-2 text-xs">
              <span className="flex-1 text-text-muted truncate">{s.label}</span>
              <span className="font-mono text-text">{s.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-2xs font-mono uppercase tracking-wider text-text-muted mb-2">Abilities</h3>
        {data.abilities && data.abilities.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {data.abilities.map((a) => (
              <li
                key={a}
                className="text-2xs font-mono px-2 py-0.5 rounded bg-surface text-text border border-border/40"
              >
                {a}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-muted/70 italic">No abilities defined.</p>
        )}
      </section>
    </div>
  );
}

// Side-effect registration — importing this module wires the facet in.
registerFacet('bestiary', { id: 'detail', label: 'Detail', Component: BestiaryDetailFacet });
