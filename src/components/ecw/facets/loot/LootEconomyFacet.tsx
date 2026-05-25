'use client';

import { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { useCatalogEntities } from '@/stores/catalogStore';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { FindingList } from '@/components/ecw/infra/FindingList';
import {
  asLootBinding,
  computeExpectedValue,
  rarityBreakdown,
  lintLootEconomy,
  type LootBindingLike,
} from '@/lib/loot/economy';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Loot Economy facet (ECW Phase 10-L). Turns the enemy→loot binding into a
 * gold-per-kill expected value, a per-rarity EV-contribution breakdown, and a
 * roster-aware economy lint (read live from catalogStore). The loot-catalog
 * analogue of the Bestiary Balance + Threat facets — the pure-function template.
 */
export function LootEconomyFacet({ entity }: Props) {
  const roster = useCatalogEntities('loot-tables');

  const model = useMemo(() => {
    const binding = asLootBinding(entity.data);
    if (!binding) return null;
    const peers = roster
      .map((e) => asLootBinding((e as StoredCatalogEntity).data))
      .filter((b): b is LootBindingLike => b !== null);
    const breakdown = rarityBreakdown(binding);
    const max = Math.max(...breakdown.map((b) => b.contribution), 0.0001);
    return {
      ev: computeExpectedValue(binding),
      dropChance: binding.dropChance,
      bonusGold: binding.bonusGold,
      breakdown,
      max,
      findings: lintLootEconomy(binding, peers),
    };
  }, [entity.data, roster]);

  if (!model) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No loot binding to evaluate.</div>;
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Expected Value</span>
        <span className="ml-auto text-2xl font-bold text-text">{model.ev}<span className="text-xs text-text-muted ml-1">g/kill</span></span>
      </div>

      <div className="text-xs text-text-muted">
        {Math.round(model.dropChance * 100)}% drop chance · {model.bonusGold}g guaranteed bonus
      </div>

      <div className="space-y-1">
        <div className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">Value by rarity</div>
        {model.breakdown.map((b) => (
          <div key={b.rarity} className="flex items-center gap-2 text-2xs font-mono">
            <span className="w-20 truncate text-text-muted">{b.rarity}</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
              <div className="h-full bg-amber-500/70" style={{ width: `${(b.contribution / model.max) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-text-muted/60">{b.weightPct}%</span>
            <span className="w-10 text-right text-text">{Math.round(b.contribution)}g</span>
          </div>
        ))}
      </div>

      <FindingList findings={model.findings} />
    </div>
  );
}

registerFacet('loot-tables', { id: 'economy', label: 'Economy', Component: LootEconomyFacet });
