'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { ModuleAggregate, ReviewSnapshot } from '@/lib/feature-matrix-db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { apiFetch } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';
import { ALL_MODULE_IDS, daysSince } from './helpers';
import type { CellData, Props } from './types';
import { SummaryPanels } from './SummaryPanels';
import { HeatmapGrid } from './HeatmapGrid';
import { ModuleDetailPanel } from './ModuleDetailPanel';
import { WorstModulesPanel } from './WorstModulesPanel';
import { StaleReviewsPanel } from './StaleReviewsPanel';

// ─── Component ──────────────────────────────────────────────────────────────────

export function AggregateQualityDashboard({ staleDays = 7, onReviewModule, onBatchReview }: Props) {
  const [aggregates, setAggregates] = useState<ModuleAggregate[]>([]);
  const [historyMap, setHistoryMap] = useState<Record<string, ReviewSnapshot[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [customStaleDays, setCustomStaleDays] = useState(staleDays);
  const [isBatchReviewing, setIsBatchReviewing] = useState(false);
  // The heatmap entrance stagger should play once (on first mount), not replay
  // on every data refresh while the grid stays mounted.
  const hasAnimatedRef = useRef(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [aggData, histData] = await Promise.all([
        apiFetch<{ modules: ModuleAggregate[] }>('/api/feature-matrix/aggregate'),
        apiFetch<{ history: Record<string, ReviewSnapshot[]> }>('/api/feature-matrix/history'),
      ]);
      setAggregates(aggData.modules ?? []);
      setHistoryMap(histData.history ?? {});
    } catch (err) {
      console.error('AggregateQualityDashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Merge DB data with all known modules (some may not be seeded yet)
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
      const reviewed = implemented + improved + partial + missing;
      const pctReviewed = total > 0 ? reviewed / total : 0;
      const pctComplete = total > 0 ? (implemented + improved) / total : 0;
      const lastReviewedAt = agg?.lastReviewedAt ?? null;

      return {
        moduleId: moduleId as SubModuleId,
        label: MODULE_LABELS[moduleId] ?? moduleId,
        total,
        implemented,
        improved,
        partial,
        missing,
        unknown,
        avgQuality: agg?.avgQuality ?? null,
        lastReviewedAt,
        daysSinceReview: daysSince(lastReviewedAt),
        pctComplete,
        pctReviewed,
      };
    });
  }, [aggregates]);

  // Project-wide totals
  const totals = useMemo(() => {
    const t = { total: 0, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0, reviewed: 0 };
    for (const c of cells) {
      t.total += c.total;
      t.implemented += c.implemented;
      t.improved += c.improved;
      t.partial += c.partial;
      t.missing += c.missing;
      t.unknown += c.unknown;
      if (c.pctReviewed > 0) t.reviewed++;
    }
    return t;
  }, [cells]);

  // Worst quality modules (reviewed, quality < 3)
  const worstModules = useMemo(
    () =>
      cells
        .filter((c) => c.avgQuality !== null && c.avgQuality < 3 && c.pctReviewed > 0)
        .sort((a, b) => (a.avgQuality ?? 0) - (b.avgQuality ?? 0)),
    [cells],
  );

  // Stale modules
  const staleModules = useMemo(
    () =>
      cells.filter((c) => {
        if (c.lastReviewedAt === null) return true; // never reviewed
        return (c.daysSinceReview ?? Infinity) > customStaleDays;
      }),
    [cells, customStaleDays],
  );

  const overallQuality = useMemo(() => {
    const withQuality = cells.filter((c) => c.avgQuality !== null);
    if (withQuality.length === 0) return null;
    const sum = withQuality.reduce((acc, c) => acc + (c.avgQuality ?? 0), 0);
    return Math.round((sum / withQuality.length) * 10) / 10;
  }, [cells]);

  const overallPct = totals.total > 0 ? Math.round((totals.implemented / totals.total) * 100) : 0;

  const handleBatchReview = async () => {
    if (!onBatchReview || staleModules.length === 0) return;
    setIsBatchReviewing(true);
    try {
      await onBatchReview(staleModules.map((m) => m.moduleId));
    } finally {
      setIsBatchReviewing(false);
    }
  };

  // Only blank to the spinner on the very first load. On manual refreshes the
  // grid stays mounted (data is updated in place), so we avoid a full remount +
  // staggered re-animation of every cell.
  if (isLoading && aggregates.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  const selected = selectedModule ? cells.find((c) => c.moduleId === selectedModule) : null;

  // Play the cell entrance stagger only on the first render with data; mark the
  // ref so subsequent refreshes/re-renders render the grid in its final state.
  const playEntrance = !hasAnimatedRef.current;
  hasAnimatedRef.current = true;

  return (
    <div className="space-y-5">
      <SummaryPanels
        overallPct={overallPct}
        totals={totals}
        overallQuality={overallQuality}
        cells={cells}
        worstModules={worstModules}
        staleModules={staleModules}
        customStaleDays={customStaleDays}
      />

      <HeatmapGrid
        cells={cells}
        historyMap={historyMap}
        hoveredModule={hoveredModule}
        selectedModule={selectedModule}
        customStaleDays={customStaleDays}
        playEntrance={playEntrance}
        fetchData={fetchData}
        setHoveredModule={setHoveredModule}
        setSelectedModule={setSelectedModule}
      />

      <ModuleDetailPanel
        selected={selected}
        historyMap={historyMap}
        onReviewModule={onReviewModule}
      />

      {worstModules.length > 0 && (
        <WorstModulesPanel worstModules={worstModules} setSelectedModule={setSelectedModule} />
      )}

      <StaleReviewsPanel
        staleModules={staleModules}
        customStaleDays={customStaleDays}
        setCustomStaleDays={setCustomStaleDays}
        onBatchReview={onBatchReview}
        handleBatchReview={handleBatchReview}
        isBatchReviewing={isBatchReviewing}
        setSelectedModule={setSelectedModule}
      />
    </div>
  );
}
