'use client';

import { Filter } from 'lucide-react';
import {
  STATUS_INFO,
  OPACITY_15, OPACITY_20, OPACITY_30,
  withOpacity,
} from '@/lib/chart-colors';
import { ACCENT, CATEGORY_COLORS } from './constants';
import { RARITIES, RARITY_COLORS } from './data';
import type { Rarity } from './data';
import type { PoolCategory } from './types';

interface BreakpointFiltersProps {
  bpCategoryFilter: PoolCategory;
  setBpCategoryFilter: (f: PoolCategory) => void;
  bpRarityFilter: Rarity | 'all';
  setBpRarityFilter: (r: Rarity | 'all') => void;
  bpSearch: string;
  setBpSearch: (s: string) => void;
  resultCount: number;
}

export function BreakpointFilters({
  bpCategoryFilter, setBpCategoryFilter,
  bpRarityFilter, setBpRarityFilter,
  bpSearch, setBpSearch,
  resultCount,
}: BreakpointFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
        <Filter className="w-3 h-3" /> Filters:
      </div>
      <div className="flex gap-1">
        {(['all', 'offensive', 'defensive', 'utility'] as const).map(cat => (
          <button key={cat} onClick={() => setBpCategoryFilter(cat)}
            className="px-2 py-1 rounded text-xs font-mono uppercase tracking-[0.15em] capitalize transition-all"
            style={{
              backgroundColor: bpCategoryFilter === cat ? `${cat === 'all' ? ACCENT : CATEGORY_COLORS[cat]}${OPACITY_20}` : 'transparent',
              color: bpCategoryFilter === cat ? (cat === 'all' ? ACCENT : CATEGORY_COLORS[cat]) : 'var(--text-muted)',
              border: `1px solid ${bpCategoryFilter === cat ? withOpacity(cat === 'all' ? ACCENT : CATEGORY_COLORS[cat], OPACITY_30) : withOpacity(ACCENT, OPACITY_15)}`,
            }}>
            {cat}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <button onClick={() => setBpRarityFilter('all')}
          className="px-2 py-1 rounded text-xs font-mono uppercase tracking-[0.15em] transition-all"
          style={{
            backgroundColor: bpRarityFilter === 'all' ? `${ACCENT}${OPACITY_20}` : 'transparent',
            color: bpRarityFilter === 'all' ? ACCENT : 'var(--text-muted)',
            border: `1px solid ${bpRarityFilter === 'all' ? withOpacity(ACCENT, OPACITY_30) : withOpacity(ACCENT, OPACITY_15)}`,
          }}>
          All
        </button>
        {RARITIES.map(r => (
          <button key={r} onClick={() => setBpRarityFilter(r)}
            className="px-2 py-1 rounded text-xs font-mono uppercase tracking-[0.15em] transition-all"
            style={{
              backgroundColor: bpRarityFilter === r ? `${RARITY_COLORS[r]}${OPACITY_20}` : 'transparent',
              color: bpRarityFilter === r ? RARITY_COLORS[r] : 'var(--text-muted)',
              border: `1px solid ${bpRarityFilter === r ? withOpacity(RARITY_COLORS[r], OPACITY_30) : withOpacity(ACCENT, OPACITY_15)}`,
            }}>
            {r}
          </button>
        ))}
      </div>
      <input type="text" value={bpSearch} onChange={(e) => setBpSearch(e.target.value)}
        placeholder="Search affixes..."
        className="px-2 py-1 rounded text-xs font-mono bg-surface-deep text-text placeholder:text-text-muted/50 w-40 focus:outline-none focus:ring-1"
        style={{ border: `1px solid ${withOpacity(ACCENT, OPACITY_15)}`, '--tw-ring-color': STATUS_INFO } as React.CSSProperties} />
      <span className="ml-auto text-xs font-mono text-text-muted">{resultCount} affix{resultCount !== 1 ? 'es' : ''}</span>
    </div>
  );
}
