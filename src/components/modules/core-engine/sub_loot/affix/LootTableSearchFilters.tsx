'use client';

import { Search } from 'lucide-react';
import { OPACITY_30, OPACITY_12, withOpacity } from '@/lib/chart-colors';
import { ACCENT, LOOT_SOURCES } from '../_shared/data';
import type { LootSource } from '../_shared/data';

interface LootTableSearchFiltersProps {
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  sourceFilter: LootSource | 'all';
  setSourceFilter: (s: LootSource | 'all') => void;
  setPage: (n: number) => void;
}

export function LootTableSearchFilters({
  searchQuery, setSearchQuery,
  sourceFilter, setSourceFilter,
  setPage,
}: LootTableSearchFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
          placeholder="Search items..."
          className="w-full pl-7 pr-2 py-1 rounded text-2xs font-mono bg-surface-deep/50 border border-border/40 text-text focus:outline-none focus:ring-1 focus:ring-current/50"
        />
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => { setSourceFilter('all'); setPage(0); }}
          className="text-2xs font-mono px-2 py-1 rounded border transition-all cursor-pointer"
          style={{
            borderColor: sourceFilter === 'all' ? ACCENT : withOpacity(ACCENT, OPACITY_30),
            backgroundColor: sourceFilter === 'all' ? withOpacity(ACCENT, OPACITY_12) : 'transparent',
            color: sourceFilter === 'all' ? ACCENT : 'var(--text-muted)',
          }}
        >
          All
        </button>
        {LOOT_SOURCES.map(src => (
          <button
            key={src}
            onClick={() => { setSourceFilter(src); setPage(0); }}
            className="text-2xs font-mono px-2 py-1 rounded border transition-all capitalize cursor-pointer"
            style={{
              borderColor: sourceFilter === src ? ACCENT : withOpacity(ACCENT, OPACITY_30),
              backgroundColor: sourceFilter === src ? withOpacity(ACCENT, OPACITY_12) : 'transparent',
              color: sourceFilter === src ? ACCENT : 'var(--text-muted)',
            }}
          >
            {src}
          </button>
        ))}
      </div>
    </div>
  );
}
