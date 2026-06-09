'use client';

import { ChevronLeft, ChevronRight, Skull } from 'lucide-react';
import { withOpacity, OPACITY_37, OPACITY_25 } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { ArchetypeConfig, EliteModifier, GroupBy } from '../_shared/data';
import { ArchetypeCard } from './ArchetypeCard';

interface ArchetypeGridProps {
  filteredArchetypes: ArchetypeConfig[];
  paginatedGroups: { header: string | null; items: ArchetypeConfig[] }[];
  groupedArchetypes: { header: string | null; items: ArchetypeConfig[] }[];
  groupBy: GroupBy;
  totalPages: number;
  page: number;
  setPage: (updater: (p: number) => number) => void;
  featureMap: Map<string, FeatureRow>;
  expandedArchetype: string | null;
  toggleArchetype: (id: string) => void;
  cardModifiers: Record<string, string[]>;
  toggleCardModifier: (archetypeId: string, modId: string) => void;
  setCodegenMod: (mod: EliteModifier) => void;
  compareIds: string[];
  toggleCompare: (id: string) => void;
  resetFilters: () => void;
}

export function ArchetypeGrid({
  filteredArchetypes, paginatedGroups, groupedArchetypes,
  groupBy, totalPages, page, setPage,
  featureMap, expandedArchetype, toggleArchetype,
  cardModifiers, toggleCardModifier, setCodegenMod,
  compareIds, toggleCompare,
  resetFilters,
}: ArchetypeGridProps) {
  if (filteredArchetypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Skull className="w-8 h-8 text-border-bright mb-3" />
        <p className="text-sm text-text">No enemies match your filters</p>
        <p className="text-xs text-text-muted mt-1 max-w-xs">
          Try widening the search or clearing one of the role / category / tier / area filters.
        </p>
        <button
          onClick={resetFilters}
          className="mt-4 px-3 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-text border border-border/40 hover:border-border-bright bg-transparent hover:bg-surface transition-colors cursor-pointer"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <>
      {paginatedGroups.map((group) => (
        <div key={group.header ?? 'all'}>
          {group.header && (
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2 mt-2">
              {group.header} <span className="text-text-subtle">({groupedArchetypes.find(g => g.header === group.header)?.items.length ?? 0})</span>
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
    </>
  );
}
