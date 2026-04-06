'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FeatureRow } from '@/types/feature-matrix';
import type { ArchetypeConfig, GroupBy, EliteModifier, EnemyRole } from '../data';
import { ARCHETYPES, RADAR_DATA } from '../data';
import { ArchetypeCard } from './ArchetypeCard';
import { ComparisonPanel } from './ComparisonPanel';
import { RadarComparison } from './RadarComparison';
import { KillDeathStats } from '../encounters/KillDeathStats';
import { BestiaryFilters } from './BestiaryFilters';

import { withOpacity, OPACITY_37, OPACITY_25 } from '@/lib/chart-colors';

const PAGE_SIZE = 24;

interface ArchetypesTabProps {
  featureMap: Map<string, FeatureRow>;
  groupBy: GroupBy;
  setGroupBy: (g: GroupBy) => void;
  compareIds: string[];
  toggleCompare: (id: string) => void;
  expandedArchetype: string | null;
  toggleArchetype: (id: string) => void;
  cardModifiers: Record<string, string[]>;
  toggleCardModifier: (archetypeId: string, modId: string) => void;
  setCodegenMod: (mod: EliteModifier) => void;
  radarOverlays: Record<string, boolean>;
  onToggleOverlay: (key: string) => void;
  accent: string;
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
  filteredArchetypes: ArchetypeConfig[];
}

export function ArchetypesTab({
  featureMap, groupBy, setGroupBy,
  compareIds, toggleCompare,
  expandedArchetype, toggleArchetype,
  cardModifiers, toggleCardModifier, setCodegenMod,
  radarOverlays, onToggleOverlay, accent,
  searchTerm, setSearchTerm, roleFilter, setRoleFilter,
  categoryFilter, setCategoryFilter, tierFilter, setTierFilter,
  areaFilter, setAreaFilter, filteredArchetypes,
}: ArchetypesTabProps) {
  const [page, setPage] = useState(0);
  const [prevFilterLen, setPrevFilterLen] = useState(filteredArchetypes.length);
  if (prevFilterLen !== filteredArchetypes.length) {
    setPrevFilterLen(filteredArchetypes.length);
    if (page !== 0) setPage(0);
  }

  const compareArchetypes = useMemo(
    () => compareIds.map(id => ARCHETYPES.find(a => a.id === id)).filter(Boolean) as ArchetypeConfig[],
    [compareIds],
  );

  const activeOverlays = useMemo(() =>
    ARCHETYPES
      .filter(a => radarOverlays[a.id] && RADAR_DATA[a.id])
      .map(a => ({ data: RADAR_DATA[a.id], color: a.color, label: a.label })),
  [radarOverlays]);

  const groupedArchetypes = useMemo(() => {
    if (groupBy === 'none') return [{ header: null, items: filteredArchetypes }];
    const groups = new Map<string, ArchetypeConfig[]>();
    for (const a of filteredArchetypes) {
      const key = groupBy === 'class' ? a.class
        : groupBy === 'role' ? a.role
        : groupBy === 'category' ? a.category
        : groupBy === 'tier' ? a.tier
        : groupBy === 'area' ? a.area
        : a.class;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([header, items]) => ({ header, items }));
  }, [groupBy, filteredArchetypes]);

  /* Pagination over flat list (when not grouped) */
  const totalPages = groupBy === 'none'
    ? Math.ceil(filteredArchetypes.length / PAGE_SIZE) : 0;

  const paginatedGroups = useMemo(() => {
    if (groupBy !== 'none') return groupedArchetypes;
    const start = page * PAGE_SIZE;
    return [{ header: null, items: filteredArchetypes.slice(start, start + PAGE_SIZE) }];
  }, [groupBy, groupedArchetypes, filteredArchetypes, page]);


  return (
    <motion.div
      key="archetypes"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Search + filters + group bar */}
      <BestiaryFilters
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        roleFilter={roleFilter} setRoleFilter={setRoleFilter}
        categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
        tierFilter={tierFilter} setTierFilter={setTierFilter}
        areaFilter={areaFilter} setAreaFilter={setAreaFilter}
        groupBy={groupBy} setGroupBy={setGroupBy}
        filteredCount={filteredArchetypes.length}
      />

      {/* Compare selection hint */}
      {compareIds.length > 0 ? (
        <div className="text-sm text-text-muted mb-2">
          Comparing <strong>{compareIds.length}</strong> enemies (max 4).
          {compareArchetypes.map(a => (
            <span key={a.id} className="inline-flex items-center gap-1 ml-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
              <span className="font-bold" style={{ color: a.color }}>{a.label}</span>
            </span>
          ))}
          <button onClick={() => { for (const id of compareIds) toggleCompare(id); }}
            className="ml-2 text-xs text-text-muted underline hover:text-text cursor-pointer">
            Clear
          </button>
        </div>
      ) : (
        <p className="text-xs text-text-muted">Click enemies to compare (up to 4)</p>
      )}

      {/* Multi-enemy comparison */}
      {compareArchetypes.length >= 2 && (
        <ComparisonPanel enemies={compareArchetypes} accent={accent} />
      )}

      {/* Archetype cards */}
      {paginatedGroups.map((group) => (
        <div key={group.header ?? 'all'}>
          {group.header && (
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2 mt-2">
              {group.header} <span className="text-text-muted/60">({groupedArchetypes.find(g => g.header === group.header)?.items.length ?? 0})</span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {group.items.map((archetype) => (
              <div key={archetype.id} className="relative">
                <ArchetypeCard
                  archetype={archetype}
                  featureMap={featureMap}
                  expanded={expandedArchetype === archetype.id}
                  onToggle={toggleArchetype}
                  activeModifiers={cardModifiers[archetype.id] ?? []}
                  onToggleModifier={(modId) => toggleCardModifier(archetype.id, modId)}
                  onViewCodegen={setCodegenMod}
                />
                {/* Compare toggle badge */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCompare(archetype.id); }}
                  className="absolute top-1 right-1 z-30 w-5 h-5 rounded-full border text-xs font-bold flex items-center justify-center transition-all cursor-pointer"
                  title={compareIds.includes(archetype.id) ? 'Remove from comparison' : 'Add to comparison'}
                  style={compareIds.includes(archetype.id)
                    ? { backgroundColor: withOpacity(archetype.color, OPACITY_25), borderColor: withOpacity(archetype.color, OPACITY_37), color: archetype.color }
                    : { backgroundColor: 'var(--surface-deep)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  {compareIds.includes(archetype.id)
                    ? (compareIds.indexOf(archetype.id) + 1)
                    : '+'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Pagination controls (flat mode only) */}
      {groupBy === 'none' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="p-1.5 rounded border border-border/30 bg-surface disabled:opacity-30 hover:bg-surface-hover transition-colors cursor-pointer disabled:cursor-default">
            <ChevronLeft className="w-4 h-4 text-text-muted" />
          </button>
          <span className="text-xs font-mono text-text-muted">
            Page {page + 1} / {totalPages} &middot; {filteredArchetypes.length} enemies
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="p-1.5 rounded border border-border/30 bg-surface disabled:opacity-30 hover:bg-surface-hover transition-colors cursor-pointer disabled:cursor-default">
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RadarComparison
          radarOverlays={radarOverlays}
          onToggleOverlay={onToggleOverlay}
          activeOverlays={activeOverlays}
          accent={accent}
        />
        <KillDeathStats accent={accent} />
      </div>
    </motion.div>
  );
}
