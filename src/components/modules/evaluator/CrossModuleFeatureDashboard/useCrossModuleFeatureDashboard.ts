'use client';

import { useState, useCallback, useMemo } from 'react';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleAggregates } from '@/hooks/useModuleAggregates';
import { useNavigationStore } from '@/stores/navigationStore';
import type { SubModuleId } from '@/types/modules';
import { ALL_MODULE_IDS, MODULE_CATEGORIES, type StatusKey, type SortKey } from './constants';
import type { CellData, MissingFeatureGroup } from './types';

export function useCrossModuleFeatureDashboard() {
  const [sortBy, setSortBy] = useState<SortKey>('completion');
  const [hoveredCell, setHoveredCell] = useState<{ module: string; status: StatusKey } | null>(null);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);

  // Both reads come from their ONE shared path — the same cached payloads every
  // other Evaluator dashboard sees, so this view can no longer show a roll-up
  // that contradicts the status cells beside it.
  const {
    statuses: allStatuses, isLoading: statusesLoading, loaded: statusesLoaded,
    error: statusesError,
  } = useFeatureStatuses();
  const {
    byModule: aggMap, isLoading: aggLoading, loaded: aggLoaded,
    error: aggError, refresh: refreshAll,
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
      const pctComplete = total > 0 ? (implemented + improved) / total : 0;

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

  const overallPct = totals.total > 0 ? Math.round(((totals.implemented + totals.improved) / totals.total) * 100) : 0;

  // Lowest-scoring modules (least % implemented)
  const lowestModules = useMemo(() => {
    return [...cells]
      .filter((c) => c.total > 0)
      .sort((a, b) => a.pctComplete - b.pctComplete)
      .slice(0, 5);
  }, [cells]);

  // Features with most 'missing' status across modules
  const mostMissingFeatures = useMemo(() => {
    const missing = allStatuses.filter((s) => s.status === 'missing');
    const featureCount = new Map<string, string[]>();
    for (const s of missing) {
      const label = MODULE_LABELS[s.moduleId] ?? s.moduleId;
      const existing = featureCount.get(s.featureName) ?? [];
      existing.push(label);
      featureCount.set(s.featureName, existing);
    }

    const groups: MissingFeatureGroup[] = Array.from(featureCount.entries())
      .map(([featureName, modules]) => ({ featureName, modules }))
      .sort((a, b) => b.modules.length - a.modules.length);

    return groups.slice(0, 8);
  }, [allStatuses]);

  const handleCellClick = useCallback((moduleId: SubModuleId) => {
    navigateToModule(moduleId);
  }, [navigateToModule]);

  return {
    isLoading,
    error,
    /** False ⇒ nothing was actually read; a heatmap here would be all-"unknown" fiction. */
    hasData: aggMap.size > 0,
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
    mostMissingFeatures,
    handleCellClick,
  };
}
