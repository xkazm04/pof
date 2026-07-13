'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ListOrdered, RefreshCw,
  Target, Map, List,
} from 'lucide-react';
import { PlanMatrixMap } from '../PlanMatrixMap';
import { useImplementationPlan } from '@/hooks/useImplementationPlan';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { getModuleLabel, type PlanItem } from '@/lib/implementation-planner/plan-generator';
import { planItemToTask } from '@/lib/implementation-planner/plan-dispatch';
import { getAppOrigin } from '@/lib/constants';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { PAGE_SIZE } from './constants';
import { FilterBar } from './FilterBar';
import { PlanItemRow } from './PlanItemRow';
import { SummaryCards } from './SummaryCards';

// ---------- Main component ----------

type PlanViewMode = 'table' | 'map';

interface ImplementationPlanProps {
  /** When provided, auto-filters to this submodule */
  moduleId?: string;
}

export function ImplementationPlan({ moduleId }: ImplementationPlanProps = {}) {
  const [viewMode, setViewMode] = useState<PlanViewMode>('table');
  const { plan, loading, error, filter, updateFilter, clearFilter, refresh } = useImplementationPlan({
    filter: moduleId ? { moduleId } : undefined,
  });
  const [page, setPage] = useState(0);
  const [showAllModules, setShowAllModules] = useState(!moduleId);

  // CLI for dispatching a plan item as a feature-fix task. `execute` scans the
  // project, injects context via buildTaskPrompt, and dispatches — the standard
  // TaskFactory path (no hand-rolled prompt).
  const { execute } = useModuleCLI({
    moduleId: 'core-engine' as SubModuleId,
    sessionKey: 'implementation-plan',
    label: 'Implementation Plan',
    accentColor: MODULE_COLORS.core,
  });

  const moduleIds = useMemo(() => Object.keys(MODULE_FEATURE_DEFINITIONS), []);

  const handleExecute = useCallback((item: PlanItem) => {
    // PHASE-1: single-item dispatch, gated on readiness (all deps implemented).
    if (!item.isReady) return;
    void execute(planItemToTask(item, getAppOrigin()));
  }, [execute]);

  // Pagination
  const pagedItems = useMemo(() => {
    if (!plan) return [];
    const start = page * PAGE_SIZE;
    return plan.items.slice(start, start + PAGE_SIZE);
  }, [plan, page]);

  const totalPages = plan ? Math.ceil(plan.items.length / PAGE_SIZE) : 0;

  // Progress percentage
  const progress = plan && plan.totalFeatures > 0
    ? (plan.implementedCount / plan.totalFeatures) * 100
    : 0;

  // Ready count (items that can be implemented right now)
  const readyCount = plan?.items.filter((i) => i.isReady).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4" style={{ color: MODULE_COLORS.core }} />
          <span className="text-sm font-semibold text-text">Implementation Plan</span>
          {plan && (
            <span className="text-xs text-text-muted font-mono">
              {plan.remainingCount} remaining
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden mr-1">
            <button
              onClick={() => setViewMode('table')}
              title="Table view"
              className={`p-1 transition-colors ${viewMode === 'table' ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              title="Matrix map"
              className={`p-1 transition-colors ${viewMode === 'map' ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text'}`}
            >
              <Map className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Module scope toggle */}
      {moduleId && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !showAllModules;
              setShowAllModules(next);
              if (next) {
                updateFilter({ moduleId: undefined });
              } else {
                updateFilter({ moduleId });
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              showAllModules
                ? 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent'
                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
            }`}
          >
            <Target className="w-3 h-3" />
            {showAllModules ? 'Filtered to module' : getModuleLabel(moduleId as SubModuleId) + ' only'}
          </button>
          {!showAllModules && (
            <span className="text-2xs text-text-muted">Cross-module deps shown as context</span>
          )}
        </div>
      )}

      {/* Matrix map view */}
      {viewMode === 'map' && <PlanMatrixMap moduleId={showAllModules ? undefined : moduleId} />}

      {/* Table view content below */}
      {viewMode === 'table' && plan && (
        <SummaryCards plan={plan} progress={progress} readyCount={readyCount} />
      )}

      {viewMode === 'table' && (
        <>
          {/* Filters */}
          <FilterBar
            filter={filter}
            onUpdate={updateFilter}
            onClear={clearFilter}
            moduleIds={moduleIds}
          />

          {/* Error state */}
          {error && (
            <div className="text-center text-red-400 text-xs py-4">{error}</div>
          )}

          {/* Plan list */}
          {plan && (
            <div className="rounded border border-border bg-background/60 overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-deep border-b border-border text-2xs uppercase tracking-wider text-text-muted font-medium">
                <span className="w-5 text-right">#</span>
                <span className="w-3.5" />
                <span className="w-3" />
                <span className="flex-1">Feature</span>
              </div>

              {pagedItems.length === 0 ? (
                <div className="text-center text-text-muted text-xs py-8">
                  {plan.items.length === 0
                    ? 'All features are implemented!'
                    : 'No features match the current filters.'
                  }
                </div>
              ) : (
                pagedItems.map((item, i) => (
                  <PlanItemRow
                    key={item.key}
                    item={item}
                    rank={page * PAGE_SIZE + i + 1}
                    onExecute={handleExecute}
                  />
                ))
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 px-3 py-2 border-t border-border bg-surface-deep">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="text-xs text-text-muted hover:text-text disabled:opacity-30 transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-text-muted font-mono">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="text-xs text-text-muted hover:text-text disabled:opacity-30 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {loading && !plan && (
            <div className="flex items-center justify-center gap-2 text-text-muted text-xs py-8">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Generating plan...
            </div>
          )}
        </>
      )}
    </div>
  );
}
