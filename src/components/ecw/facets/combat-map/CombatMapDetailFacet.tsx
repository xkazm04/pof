'use client';

import { Swords, ChevronRight } from 'lucide-react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { ComboSequence } from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Combat Map detail facet — Phase 7b. Renders the combo's weapon category,
 * hit count, DPS, and chain steps. The richer ComboChainDiagram view from
 * the legacy CombatActionMap lands as a Phase 10-C enhancement.
 */
export function CombatMapDetailFacet({ entity }: Props) {
  const data = entity.data as ComboSequence | undefined;

  if (!data || typeof data !== 'object' || !('weaponCategory' in data)) {
    return (
      <div className="px-4 py-3 text-xs text-text-muted/70 italic">
        No combo data for this entity.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <Swords className="w-4 h-4 text-text-muted" />
        <span className="font-mono uppercase tracking-wider text-text-muted">{data.weaponCategory}</span>
        <span className="text-text">·</span>
        <span className="font-mono text-text">{data.hits} hits</span>
        <span className="text-text">·</span>
        <span className="font-mono text-text">{data.totalTime}</span>
        <span className="text-text">·</span>
        <span className="font-mono text-emerald-500">{data.dps} DPS</span>
      </div>

      <section>
        <h3 className="text-2xs font-mono uppercase tracking-wider text-text-muted mb-2">Chain</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {data.chain.map((step, i) => (
            <span key={`${step}-${i}`} className="flex items-center gap-1.5">
              <span
                data-testid="combat-chain-step"
                className="text-2xs font-mono px-2 py-1 rounded bg-surface text-text border border-border/40"
              >
                {step}
              </span>
              {i < data.chain.length - 1 && (
                <ChevronRight className="w-3 h-3 text-text-muted/60" />
              )}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

registerFacet('combat-map', { id: 'detail', label: 'Detail', Component: CombatMapDetailFacet });
