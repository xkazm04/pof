'use client';

import { Search, Plus, X } from 'lucide-react';
import { BlueprintPanel } from '../../unique-tabs/_design';
import { ACCENT, ALL_ITEM_TYPES } from '../_shared/data';
import { withOpacity, OPACITY_12, OPACITY_30 } from '@/lib/chart-colors';

export type SortBy = 'name' | 'rarity' | 'type' | 'power';

interface Props {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilter: string | 'all';
  setCategoryFilter: (v: string | 'all') => void;
  subtypeFilter: string | 'all';
  setSubtypeFilter: (v: string | 'all') => void;
  rarityFilter: string | 'all';
  setRarityFilter: (v: string | 'all') => void;
  sortBy: SortBy;
  setSortBy: (v: SortBy) => void;
  availableSubtypes: string[];
  filteredCount: number;
  showAddForm: boolean;
  setShowAddForm: (v: boolean | ((prev: boolean) => boolean)) => void;
  resetPage: () => void;
}

export function CatalogFiltersBar({
  searchQuery, setSearchQuery,
  categoryFilter, setCategoryFilter,
  subtypeFilter, setSubtypeFilter,
  rarityFilter, setRarityFilter,
  sortBy, setSortBy,
  availableSubtypes,
  filteredCount,
  showAddForm, setShowAddForm,
  resetPage,
}: Props) {
  return (
    <BlueprintPanel color={ACCENT} className="p-3 sticky top-4 z-20 shadow-md space-y-3">
      <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Item filters">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" placeholder="Search items..." value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); resetPage(); }}
            className="w-full text-sm font-mono pl-9 pr-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-blue-500/50" />
        </div>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setSubtypeFilter('all'); resetPage(); }}
          className="text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
          <option value="all">All Types</option>
          {ALL_ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={subtypeFilter} onChange={e => { setSubtypeFilter(e.target.value); resetPage(); }}
          className="text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
          <option value="all">All Slots</option>
          {availableSubtypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={rarityFilter} onChange={e => { setRarityFilter(e.target.value); resetPage(); }}
          className="text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
          <option value="all">All Rarities</option>
          {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
          className="text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
          <option value="name">Sort: Name</option>
          <option value="power">Sort: Power</option>
          <option value="rarity">Sort: Tier</option>
          <option value="type">Sort: Type</option>
        </select>
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{filteredCount} items</span>
        <button onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          style={{ backgroundColor: showAddForm ? `${withOpacity(ACCENT, OPACITY_12)}` : 'var(--surface)', color: showAddForm ? ACCENT : 'var(--text-muted)', border: `1px solid ${showAddForm ? withOpacity(ACCENT, OPACITY_30) : 'var(--border)'}` }}>
          {showAddForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showAddForm ? 'Cancel' : 'Add Item'}
        </button>
      </div>
    </BlueprintPanel>
  );
}
