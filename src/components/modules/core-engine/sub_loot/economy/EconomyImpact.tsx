'use client';

import { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';
import { ACCENT_EMERALD, STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { TabButtonGroup } from '../../unique-tabs/_shared';
import { ECONOMY_SURPLUS, EXPANDED_ENTRIES } from '../_shared/data';
import type { LootSource } from '../_shared/data';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
import { EconomySummaryGrid } from './EconomySummaryGrid';
import { EconomyFilters } from './EconomyFilters';
import { EconomyImpactTable } from './EconomyImpactTable';

const PAGE_SIZE = 15;

export function EconomyImpact() {
  const [economyProfile, setEconomyProfile] = useState<'casual' | 'hardcore'>('casual');
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<LootSource | 'all'>('all');
  const [page, setPage] = useState(0);

  const filteredItems = useMemo(() => {
    let items = EXPANDED_ENTRIES;
    if (tierFilter !== 'All') items = items.filter(e => e.rarity === tierFilter);
    if (sourceFilter !== 'all') items = items.filter(e => e.source === sourceFilter);
    return items;
  }, [tierFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedItems = filteredItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Summary stats
  const totalWeight = filteredItems.reduce((s, e) => s + e.weight, 0);
  const avgWeight = filteredItems.length > 0 ? totalWeight / filteredItems.length : 0;

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Calculator} label="Loot Economy Impact" color={ACCENT_EMERALD} />
        <TabButtonGroup
          items={[
            { value: 'casual', label: 'Casual' },
            { value: 'hardcore', label: 'Hardcore' },
          ]}
          selected={economyProfile}
          onSelect={(v) => setEconomyProfile(v as 'casual' | 'hardcore')}
          accent={ACCENT_EMERALD}
          ariaLabel="Economy player profile"
        />
      </div>
      <EconomySummaryGrid economyProfile={economyProfile} />

      {/* Surplus/deficit */}
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Item Surplus / Deficit</div>
      <div className="space-y-1 mb-4">
        {ECONOMY_SURPLUS.map((item) => {
          const multiplied = economyProfile === 'hardcore' ? item.delta * 3 : item.delta;
          const isPositive = multiplied >= 0;
          return (
            <div key={item.type} className="flex items-center gap-2">
              <span className="text-2xs font-mono w-20 text-text-muted">{item.type}</span>
              <div className="flex-1 h-2 bg-surface-deep rounded overflow-hidden relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/60" />
                {isPositive ? (
                  <div className="h-full rounded absolute left-1/2" style={{ width: `${Math.abs(multiplied) * 5}%`, backgroundColor: STATUS_SUCCESS }} />
                ) : (
                  <div className="h-full rounded absolute right-1/2" style={{ width: `${Math.abs(multiplied) * 5}%`, backgroundColor: STATUS_ERROR }} />
                )}
              </div>
              <span className="text-2xs font-mono w-8 text-right" style={{ color: isPositive ? STATUS_SUCCESS : STATUS_ERROR }}>
                {isPositive ? '+' : ''}{multiplied}
              </span>
            </div>
          );
        })}
      </div>

      {/* Filters for impact table */}
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">Loot Impact Table</div>
      <EconomyFilters
        tierFilter={tierFilter}
        setTierFilter={setTierFilter}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        setPage={setPage}
      />

      {/* Summary row */}
      <div className="flex gap-3 mb-2 text-2xs font-mono text-text-muted">
        <span>{filteredItems.length} items</span>
        <span>Avg weight: {avgWeight.toFixed(1)}</span>
        <span>Total weight: {totalWeight}</span>
      </div>

      <EconomyImpactTable
        pagedItems={pagedItems}
        totalWeight={totalWeight}
        economyProfile={economyProfile}
        safePage={safePage}
        totalPages={totalPages}
        setPage={setPage}
      />
    </BlueprintPanel>
  );
}
