'use client';

import { useState, useMemo } from 'react';
import { Calculator, ChevronLeft, ChevronRight } from 'lucide-react';
import { ACCENT_EMERALD, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_VIOLET, OPACITY_30, OPACITY_12, withOpacity } from '@/lib/chart-colors';
import { TabButtonGroup } from '../../_shared';
import { ECONOMY_SURPLUS, RARITY_TIERS } from '../data';
import { EXPANDED_ENTRIES, LOOT_SOURCES } from '../data';
import type { LootSource } from '../data';
import { BlueprintPanel, SectionHeader } from '../design';

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Gold/Hour</span>
          <span className="text-lg font-mono font-bold" style={{ color: STATUS_WARNING }}>
            {economyProfile === 'casual' ? '2,300' : '8,400'}
          </span>
          <span className="text-2xs text-text-muted">{economyProfile === 'casual' ? '30 min/day' : '4 hr/day'}</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Items/Hour</span>
          <span className="text-lg font-mono font-bold" style={{ color: ACCENT_EMERALD }}>
            {economyProfile === 'casual' ? '45' : '120'}
          </span>
          <span className="text-2xs text-text-muted">avg drops</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Rarity Dist</span>
          <div className="flex h-4 w-full rounded overflow-hidden mt-1 mb-0.5">
            {RARITY_TIERS.map(t => (
              <div key={t.name} style={{ flex: t.weight, backgroundColor: t.color }} title={`${t.name}: ${t.weight}%`} />
            ))}
          </div>
          <span className="text-2xs text-text-muted">{RARITY_TIERS.length} tiers</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Legendary Set</span>
          <span className="text-lg font-mono font-bold" style={{ color: ACCENT_VIOLET }}>
            {economyProfile === 'casual' ? '~42d' : '~6d'}
          </span>
          <span className="text-2xs text-text-muted">estimated playtime</span>
        </div>
      </div>

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
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex gap-1">
          {['All', ...RARITY_TIERS.map(t => t.name)].map(tier => {
            const isActive = tierFilter === tier;
            const color = tier === 'All' ? ACCENT_EMERALD : (RARITY_TIERS.find(t => t.name === tier)?.color ?? ACCENT_EMERALD);
            return (
              <button
                key={tier}
                onClick={() => { setTierFilter(tier); setPage(0); }}
                className="text-2xs font-mono px-2 py-0.5 rounded border transition-all cursor-pointer"
                style={{
                  borderColor: isActive ? color : withOpacity(color, OPACITY_30),
                  backgroundColor: isActive ? withOpacity(color, OPACITY_12) : 'transparent',
                  color: isActive ? color : 'var(--text-muted)',
                }}
              >
                {tier}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => { setSourceFilter('all'); setPage(0); }}
            className="text-2xs font-mono px-2 py-0.5 rounded border transition-all capitalize cursor-pointer"
            style={{
              borderColor: sourceFilter === 'all' ? ACCENT_EMERALD : withOpacity(ACCENT_EMERALD, OPACITY_30),
              backgroundColor: sourceFilter === 'all' ? withOpacity(ACCENT_EMERALD, OPACITY_12) : 'transparent',
              color: sourceFilter === 'all' ? ACCENT_EMERALD : 'var(--text-muted)',
            }}
          >
            All Sources
          </button>
          {LOOT_SOURCES.map(src => (
            <button
              key={src}
              onClick={() => { setSourceFilter(src); setPage(0); }}
              className="text-2xs font-mono px-2 py-0.5 rounded border transition-all capitalize cursor-pointer"
              style={{
                borderColor: sourceFilter === src ? ACCENT_EMERALD : withOpacity(ACCENT_EMERALD, OPACITY_30),
                backgroundColor: sourceFilter === src ? withOpacity(ACCENT_EMERALD, OPACITY_12) : 'transparent',
                color: sourceFilter === src ? ACCENT_EMERALD : 'var(--text-muted)',
              }}
            >
              {src}
            </button>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div className="flex gap-3 mb-2 text-2xs font-mono text-text-muted">
        <span>{filteredItems.length} items</span>
        <span>Avg weight: {avgWeight.toFixed(1)}</span>
        <span>Total weight: {totalWeight}</span>
      </div>

      {/* Paginated impact table */}
      <div className="overflow-x-auto mb-2">
        <table className="w-full text-2xs font-mono">
          <thead>
            <tr className="text-text-muted border-b border-border/30">
              <th className="text-left py-1.5 pr-2">Item</th>
              <th className="text-left py-1.5 px-2">Rarity</th>
              <th className="text-left py-1.5 px-2">Source</th>
              <th className="text-right py-1.5 px-2">Weight</th>
              <th className="text-right py-1.5 px-2">Drop%</th>
              <th className="text-right py-1.5 pl-2">Gold Impact</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map(item => {
              const pct = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0;
              const tierColor = RARITY_TIERS.find(t => t.name === item.rarity)?.color ?? ACCENT_EMERALD;
              const goldBase = { Common: 5, Uncommon: 15, Rare: 50, Epic: 200, Legendary: 1000 }[item.rarity] ?? 5;
              const goldImpact = goldBase * (item.maxQuantity ?? 1) * (economyProfile === 'hardcore' ? 3 : 1);
              return (
                <tr key={item.id} className="border-t border-border/20 hover:bg-surface/30">
                  <td className="py-1 pr-2 text-text">{item.name}</td>
                  <td className="py-1 px-2" style={{ color: tierColor }}>{item.rarity}</td>
                  <td className="py-1 px-2 text-text-muted capitalize">{item.source}</td>
                  <td className="text-right py-1 px-2 text-text">{item.weight}</td>
                  <td className="text-right py-1 px-2 text-text-muted">{pct.toFixed(1)}%</td>
                  <td className="text-right py-1 pl-2" style={{ color: STATUS_WARNING }}>{goldImpact}g</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="p-1 rounded border border-border/30 disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
          </button>
          <span className="text-2xs font-mono text-text-muted">
            Page {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="p-1 rounded border border-border/30 disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
      )}
    </BlueprintPanel>
  );
}
