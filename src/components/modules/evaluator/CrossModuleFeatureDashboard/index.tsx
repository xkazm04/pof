'use client';

import { Loader2 } from 'lucide-react';
import { useCrossModuleFeatureDashboard } from './useCrossModuleFeatureDashboard';
import { OverallSummary } from './OverallSummary';
import { HeatmapGrid } from './HeatmapGrid';
import { BottomPanels } from './BottomPanels';

// ── Component ──

export function CrossModuleFeatureDashboard() {
  const {
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
  } = useCrossModuleFeatureDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
