'use client';

import { useState, useCallback, useMemo } from 'react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { moduleCompletion, projectCompletionPct } from '@/lib/feature-done';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleAggregates } from '@/hooks/useModuleAggregates';
import { usePlanDispatch } from '@/hooks/usePlanDispatch';
import { useNavigationStore } from '@/stores/navigationStore';
import { generatePlan, type PlanItem } from '@/lib/implementation-planner/plan-generator';
import { drillCell, buildableNow } from '@/lib/evaluator/feature-cell-drill';
import { countAggregateRows } from '@/components/modules/shared/FeatureMatrix/matrixScope';
import type { SubModuleId } from '@/types/modules';
import { ALL_MODULE_IDS, MODULE_CATEGORIES, type StatusKey, type SortKey } from './constants';
import type { CellData, SelectedCell } from './types';

/** How many ready features the 'Buildable now' card lists. */
const BUILDABLE_LIMIT = 8;

export function useCrossModuleFeatureDashboard() {
  const [sortBy, setSortBy] = useState<SortKey>('completion');
  const [hoveredCell, setHoveredCell] = useState<{ module: string; status: StatusKey } | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);

  // Both reads come from their ONE shared path — the same cached payloads every
  // other Evaluator dashboard sees, so this view can no longer show a roll-up
  // that contradicts the status cells beside it.
  const {
    statusMap, isLoading: statusesLoading, loaded: statusesLoaded,
    error: statusesError,
  } = useFeatureStatuses();
  const {
    aggregates, byModule: aggMap, isLoading: aggLoading, loaded: aggLoaded,
    error: aggError, refresh: refreshAll, scope,
  } = useModuleAggregates();

  // `refresh` invalidates BOTH caches (they are two projections of one table).
  const fetchData = useCallback(() => { refreshAll(); }, [refreshAll]);

  const isLoading = (aggLoading && !aggLoaded) || (statusesLoading && !statusesLoaded);
  // A failed load is never dressed up as an all-"unknown" heatmap: the reason
  // reaches the UI, which renders it instead of a summary of nothing.
  const error = aggError ?? statusesError;

  // Build cell data for each module
  const cells: CellData[] = useMemo(() => {
    return ALL_MODULE_IDS.map((moduleId) => {
      const agg = aggMap.get(moduleId);
      const defCount = MODULE_FEATURE_DEFINITIONS[moduleId]?.length ?? 0;
      const total = agg?.total ?? defCount;
      const implemented = agg?.implemented ?? 0;
      const improved = agg?.improved ?? 0;
      const partial = agg?.partial ?? 0;
      const missing = agg?.missing ?? 0;
      const unknown = agg?.unknown ?? total;
      const pctComplete = moduleCompletion({ implemented, improved, total });

      return {
        moduleId: moduleId as SubModuleId,
        label: MODULE_LABELS[moduleId] ?? moduleId,
        category: MODULE_CATEGORIES[moduleId] ?? 'Other',
        total,
        implemented,
        improved,
        partial,
        missing,
        unknown,
        pctComplete,
      };
    });
  }, [aggMap]);

  // Sort cells
  const sortedCells = useMemo(() => {
    const sorted = [...cells];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.label.localeCompare(b.label));
        break;
      case 'completion':
        sorted.sort((a, b) => a.pctComplete - b.pctComplete);
        break;
      case 'missing':
        sorted.sort((a, b) => b.missing - a.missing);
        break;
    }
    return sorted;
  }, [cells, sortBy]);

  // Group by category for display
  const categoryGroups = useMemo(() => {
    const groups: Record<string, CellData[]> = {};
    for (const cell of sortedCells) {
      if (!groups[cell.category]) groups[cell.category] = [];
      groups[cell.category].push(cell);
    }
    return groups;
  }, [sortedCells]);

  // Project totals
  const totals = useMemo(() => {
    const t = { total: 0, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0 };
    for (const c of cells) {
      t.total += c.total;
      t.implemented += c.implemented;
      t.improved += c.improved;
      t.partial += c.partial;
      t.missing += c.missing;
      t.unknown += c.unknown;
    }
    return t;
  }, [cells]);

  const overallPct = projectCompletionPct(cells);

  // Lowest-scoring modules (least % implemented)
  const lowestModules = useMemo(() => {
    return [...cells]
      .filter((c) => c.total > 0)
      .sort((a, b) => a.pctComplete - b.pctComplete)
      .slice(0, 5);
  }, [cells]);

  // The implementation plan over the SAME statusMap: readiness, unmet deps and
  // impact per not-done feature: what the drill and 'Buildable now' project.
  const plan = useMemo(() => generatePlan(statusMap), [statusMap]);
  const buildable = useMemo(() => buildableNow(plan, BUILDABLE_LIMIT), [plan]);

  // A status cell opens the features behind its count, in place (click again to close).
  const selectCell = useCallback((moduleId: SubModuleId, status: StatusKey) => {
    setSelectedCell((cur) => (cur?.moduleId === moduleId && cur.status === status ? null : { moduleId, status }));
  }, []);
  const closeDrill = useCallback(() => setSelectedCell(null), []);
  const drillRows = useMemo(
    () => (selectedCell ? drillCell(statusMap, selectedCell.moduleId, selectedCell.status, plan) : []),
    [selectedCell, statusMap, plan],
  );

  // Build goes through the ONE gated plan dispatch door: blocked items are
  // refused there, and a confirmed landing invalidates the shared feature data
  // this grid, the drill and 'Buildable now' all re-derive from.
  const { dispatch, isRunning: isBuilding, lastError: buildError } = usePlanDispatch({
    sessionKey: 'features-drill',
    label: 'Features Build',
    accentColor: MODULE_COLORS.evaluator,
  });
  const buildItem = useCallback((item: PlanItem) => { dispatch(item); }, [dispatch]);
  const buildKey = useCallback((key: string) => {
    const item = plan.items.find((i) => i.key === key);
    if (item) dispatch(item);
  }, [plan, dispatch]);

  const handleCellClick = useCallback((moduleId: SubModuleId) => {
    navigateToModule(moduleId);
  }, [navigateToModule]);

  return {
    isLoading,
    error,
    /** False ⇒ nothing was actually read; a heatmap here would be all-"unknown" fiction. */
    hasData: aggMap.size > 0,
    /** What the project scope let this read see (`null` until a load settles). */
    scope,
    /** The roll-up's OWN row count — never `totals.total`, which back-fills from
     *  MODULE_FEATURE_DEFINITIONS and so stays large when the read saw nothing. */
    scopedRows: countAggregateRows(aggregates),
    sortBy,
    setSortBy,
    hoveredCell,
    setHoveredCell,
    fetchData,
    cells,
    categoryGroups,
    totals,
    overallPct,
    lowestModules,
    buildable,
    handleCellClick,
    selectedCell,
    selectCell,
    closeDrill,
    drillRows,
    buildItem,
    buildKey,
    isBuilding,
    buildError,
  };
}
