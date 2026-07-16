'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { STATUS_ERROR, statusBg, statusBorder } from '@/lib/chart-colors';
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
import { QualityDiscrepancyBanner } from './QualityDiscrepancyBanner';

// ─── Component ──────────────────────────────────────────────────────────────────

export function AggregateQualityDashboard({ staleDays = 7, onReviewModule, onBatchReview }: Props) {
  const [aggregates, setAggregates] = useState<ModuleAggregate[]>([]);
  const [historyMap, setHistoryMap] = useState<Record<string, ReviewSnapshot[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [customStaleDays, setCustomStaleDays] = useState(staleDays);
  const [isBatchReviewing, setIsBatchReviewing] = useState(false);
  // The heatmap entrance stagger should play once (on first mount), not replay
  // on every data refresh while the grid stays mounted.
  const hasAnimatedRef = useRef(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [aggData, histData] = await Promise.all([
        apiFetch<{ modules: ModuleAggregate[] }>('/api/feature-matrix/aggregate'),
        apiFetch<{ history: Record<string, ReviewSnapshot[]> }>('/api/feature-matrix/history'),
      ]);
      setAggregates(aggData.modules ?? []);
      setHistoryMap(histData.history ?? {});
    } catch (err) {
      console.error('AggregateQualityDashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quality data');
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

  // First load failed and there's nothing cached to show: render an explicit
  // error state instead of an all-"unknown" heatmap that reads as a genuinely
  // unreviewed (but healthy) project.
  if (error && aggregates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{
            backgroundColor: statusBg(STATUS_ERROR),
            border: `1px solid ${statusBorder(STATUS_ERROR)}`,
          }}
        >
          <AlertTriangle className="w-6 h-6" style={{ color: STATUS_ERROR }} />
        </div>
        <h3 className="text-sm font-semibold text-text mb-1">Couldn&apos;t load quality data</h3>
        <p className="text-xs text-text-muted max-w-xs leading-relaxed">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:brightness-110"
          style={{
            color: STATUS_ERROR,
            backgroundColor: statusBg(STATUS_ERROR),
            border: `1px solid ${statusBorder(STATUS_ERROR)}`,
          }}
        >
          <RotateCcw className="w-3 h-3" />
          Retry
        </button>
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
      {/* Refresh failed but earlier data is still mounted — flag it as stale
          instead of silently presenting it as current. */}
      {error && (
        <div
          className="flex items-center justify-between gap-3 text-xs rounded-md px-3 py-2"
          style={{
            color: STATUS_ERROR,
            backgroundColor: statusBg(STATUS_ERROR),
            border: `1px solid ${statusBorder(STATUS_ERROR)}`,
          }}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              Refresh failed — showing previously loaded data. {error}
            </span>
          </span>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1 font-medium flex-shrink-0 transition-all hover:brightness-110 disabled:opacity-50"
            style={{ color: STATUS_ERROR }}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            Retry
          </button>
        </div>
      )}

      <QualityDiscrepancyBanner cells={cells} />

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
