'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { apiFetch } from '@/lib/api-utils';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useNavigationStore } from '@/stores/navigationStore';
import type { SubModuleId } from '@/types/modules';
import { ALL_MODULE_IDS, MODULE_CATEGORIES, type StatusKey, type SortKey } from './constants';
import type { CellData, MissingFeatureGroup } from './types';

export function useCrossModuleFeatureDashboard() {
  const [aggregates, setAggregates] = useState<ModuleAggregate[]>([]);
  const [isAggLoading, setIsAggLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('completion');
  const [hoveredCell, setHoveredCell] = useState<{ module: string; status: StatusKey } | null>(null);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);

  // The status rows come from the ONE shared all-statuses path (row form, the
  // same cached payload every other consumer reads); only the aggregate roll-up
  // is this view's own fetch.
  const {
    statuses: allStatuses, isLoading: statusesLoading, loaded: statusesLoaded, refresh: refreshStatuses,
  } = useFeatureStatuses();

  const fetchAggregates = useCallback(async () => {
    setIsAggLoading(true);
    try {
      const aggData = await apiFetch<{ modules: ModuleAggregate[] }>('/api/feature-matrix/aggregate');
      setAggregates(aggData.modules ?? []);
    } catch (err) {
      console.error('CrossModuleFeatureDashboard fetch error:', err);
    } finally {
      setIsAggLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    refreshStatuses();
    await fetchAggregates();
  }, [fetchAggregates, refreshStatuses]);

  useEffect(() => {
    fetchAggregates();
  }, [fetchAggregates]);

  const isLoading = isAggLoading || (statusesLoading && !statusesLoaded);

  // Build cell data for each module
  const cells: CellData[] = useMemo(() => {
    const aggMap = new Map(aggregates.map((a) => [a.moduleId, a]));

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
  }, [aggregates]);

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
