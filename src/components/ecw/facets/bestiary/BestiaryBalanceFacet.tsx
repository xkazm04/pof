'use client';

import { useMemo } from 'react';
import { Scale } from 'lucide-react';
import { useCatalogEntities } from '@/stores/catalogStore';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { FindingList } from '@/components/ecw/infra/FindingList';
import { lintArchetypeBalance, type ArchetypeLintInput } from '@/lib/balance/bestiary-guardrails';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

function asLintInput(data: unknown): ArchetypeLintInput | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.tier !== 'string' || !Array.isArray(d.stats) || !Array.isArray(d.abilities)) return null;
  return {
    id: typeof d.id === 'string' ? d.id : '',
    tier: d.tier,
    stats: d.stats as { label: string; value: number }[],
    abilities: d.abilities as string[],
  };
}


/**
 * Bestiary Balance facet (ECW Phase 10-B). Runs the cross-archetype balance
 * linter against the selected archetype + the full bestiary roster (read live
 * from catalogStore) and lists findings — errors (missing data) and warnings
 * (stats outside the same-tier peer band). The first concrete Phase 10
 * per-catalog enhancement; establishes the linter-as-facet template.
 */
export function BestiaryBalanceFacet({ entity }: Props) {
  const roster = useCatalogEntities('bestiary');

  const findings = useMemo(() => {
    const target = asLintInput(entity.data);
    if (!target) return null;
    const inputs = roster
      .map((e) => asLintInput((e as StoredCatalogEntity).data))
      .filter((x): x is ArchetypeLintInput => x !== null);
    return lintArchetypeBalance(target, inputs);
  }, [entity.data, roster]);

  if (!findings) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No archetype data to lint.</div>;
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Scale className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Balance Guardrails</span>
      </div>
      <FindingList findings={findings} />
    </div>
  );
}

registerFacet('bestiary', { id: 'balance', label: 'Balance', Component: BestiaryBalanceFacet });
