'use client';

import { Search } from 'lucide-react';
import type { GroupBy, EnemyRole, ArchetypeConfig } from '../data';
import { ARCHETYPES, ALL_AREAS, ALL_CATEGORIES, ALL_TIERS, ALL_ROLES } from '../data';

interface BestiaryFiltersProps {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  roleFilter: 'all' | EnemyRole;
  setRoleFilter: (r: 'all' | EnemyRole) => void;
  categoryFilter: 'all' | ArchetypeConfig['category'];
  setCategoryFilter: (c: 'all' | ArchetypeConfig['category']) => void;
  tierFilter: 'all' | ArchetypeConfig['tier'];
  setTierFilter: (t: 'all' | ArchetypeConfig['tier']) => void;
  areaFilter: 'all' | string;
  setAreaFilter: (a: 'all' | string) => void;
  groupBy: GroupBy;
  setGroupBy: (g: GroupBy) => void;
  filteredCount: number;
}

export function BestiaryFilters({
  searchTerm, setSearchTerm,
  roleFilter, setRoleFilter,
  categoryFilter, setCategoryFilter,
  tierFilter, setTierFilter,
  areaFilter, setAreaFilter,
  groupBy, setGroupBy,
  filteredCount,
}: BestiaryFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="relative flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search archetypes..."
            className="pl-8 pr-3 py-1.5 rounded-md border border-border/30 bg-surface-deep/60 text-xs font-mono text-text placeholder:text-text-muted/50 outline-none focus:border-[var(--accent)] w-48"
          />
        </div>

        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | EnemyRole)}
          className="px-2 py-1.5 rounded-md border border-border/30 bg-surface-deep/60 text-xs font-mono text-text outline-none cursor-pointer">
          <option value="all">All roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as 'all' | ArchetypeConfig['category'])}
          className="px-2 py-1.5 rounded-md border border-border/30 bg-surface-deep/60 text-xs font-mono text-text outline-none cursor-pointer">
          <option value="all">All categories</option>
          {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as 'all' | ArchetypeConfig['tier'])}
          className="px-2 py-1.5 rounded-md border border-border/30 bg-surface-deep/60 text-xs font-mono text-text outline-none cursor-pointer">
          <option value="all">All tiers</option>
          {ALL_TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>

        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}
          className="px-2 py-1.5 rounded-md border border-border/30 bg-surface-deep/60 text-xs font-mono text-text outline-none cursor-pointer">
          <option value="all">All areas</option>
          {ALL_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <span className="px-2 py-0.5 rounded-full bg-surface-hover text-xs font-mono text-text-muted">
          {filteredCount} / {ARCHETYPES.length}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Group by:</span>
        {(['none', 'category', 'area', 'tier', 'role', 'class'] as const).map((g) => (
          <button key={g} onClick={() => setGroupBy(g)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              groupBy === g ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text hover:bg-surface-hover/50'
            }`}>
            {g === 'none' ? 'None' : g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
