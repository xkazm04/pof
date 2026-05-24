'use client';

import { ACCENT_EMERALD, OPACITY_30, OPACITY_12, withOpacity } from '@/lib/chart-colors';
import { RARITY_TIERS, LOOT_SOURCES } from '../_shared/data';
import type { LootSource } from '../_shared/data';

interface EconomyFiltersProps {
  tierFilter: string;
  setTierFilter: (t: string) => void;
  sourceFilter: LootSource | 'all';
  setSourceFilter: (s: LootSource | 'all') => void;
  setPage: (n: number) => void;
}

export function EconomyFilters({
  tierFilter, setTierFilter,
  sourceFilter, setSourceFilter,
  setPage,
}: EconomyFiltersProps) {
  return (
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
  );
}
