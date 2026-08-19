'use client';

import { Loader2 } from 'lucide-react';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { MatrixScopeBanner } from '@/components/modules/shared/FeatureMatrix/MatrixScopeBanner';
import { useCrossModuleFeatureDashboard } from './useCrossModuleFeatureDashboard';
import { OverallSummary } from './OverallSummary';
import { HeatmapGrid } from './HeatmapGrid';
import { BottomPanels } from './BottomPanels';

// ── Component ──

export function CrossModuleFeatureDashboard() {
  const {
    isLoading,
    error,
    hasData,
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
    scope,
    scopedRows,
  } = useCrossModuleFeatureDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  // Nothing was read: say so. Rendering the grid here would show every module as
  // 0% complete / all-"unknown" — a fetch failure dressed up as an unreviewed
  // (but healthy) project.
  if (error && !hasData) {
    return (
      <div className="py-4">
        <InlineErrorRetry message={`Couldn't load cross-module data — ${error}`} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Refresh failed but earlier data is still mounted — flag it as stale
          instead of silently presenting it as current. */}
      {error && (
        <InlineErrorRetry message={`Refresh failed — showing previously loaded data. ${error}`} onRetry={fetchData} />
      )}

      {/* What the project scope let this read see — above the summary, because
          "0% complete" across every module is what a foreign-owned matrix renders. */}
      <MatrixScopeBanner scope={scope} visibleRows={scopedRows} testId="pof-cross-module-scope" />

      <OverallSummary totals={totals} overallPct={overallPct} onRefresh={fetchData} />

      {/* ── Heatmap Grid: Rows = modules, Columns = status categories ─── */}
      <HeatmapGrid
        cells={cells}
        totals={totals}
        overallPct={overallPct}
        sortBy={sortBy}
        setSortBy={setSortBy}
        categoryGroups={categoryGroups}
        hoveredCell={hoveredCell}
        setHoveredCell={setHoveredCell}
        handleCellClick={handleCellClick}
      />

      {/* ── Bottom panels: Lowest modules + Most missing features ────── */}
      <BottomPanels
        lowestModules={lowestModules}
        mostMissingFeatures={mostMissingFeatures}
        handleCellClick={handleCellClick}
      />
    </div>
  );
}
