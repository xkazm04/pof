'use client';

import { Shield, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';
import { useTacticalCoverAnalysis } from './useTacticalCoverAnalysis';
import { CoverDiagram } from './CoverDiagram';
import { CoverSidePanel } from './CoverSidePanel';
import type { ScoreMode } from './types';

export { MOCK_OBSTACLES } from './constants';
export { generateCoverPoints } from './helpers';

export function TacticalCoverAnalysis() {
  const {
    sampleCount, rings, minRadius, maxRadius, coverCheck,
    scoreMode, setScoreMode,
    showLOSTraces, setShowLOSTraces,
    hoveredPoint, setHoveredPoint,
    svgRef, scale, points, getScore, bestPoint,
    coveredCount, elevatedCount, regenerate,
    heatmapArcs, losTracePoints, bestPositions,
  } = useTacticalCoverAnalysis();

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="tactical-cover-analysis">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_EMERALD}${OPACITY_10}` }}
        >
          <span style={{ color: ACCENT_EMERALD }}><Shield className="w-4 h-4" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text font-mono">Tactical Cover Analysis</h3>
          <p className="text-2xs text-text-muted">
            <code className="font-mono">EnvQueryGenerator_CoverPositions</code> + LOS & elevation scoring
          </p>
        </div>
        <button
          onClick={regenerate}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: `${ACCENT_EMERALD}${OPACITY_15}`,
            color: ACCENT_EMERALD,
            border: `1px solid ${ACCENT_EMERALD}30`,
          }}
          title="Regenerate cover positions"
          data-testid="cover-regenerate-btn"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Regenerate
        </button>
      </div>

      {/* Score mode selector */}
      <div className="px-4 py-2 border-b border-border/20 flex items-center gap-2">
        <span className="text-2xs text-text-muted mr-1">Score by:</span>
        {([
          { mode: 'combined' as ScoreMode, label: 'Combined', color: ACCENT_EMERALD },
          { mode: 'cover' as ScoreMode, label: 'LOS Cover', color: ACCENT_CYAN },
          { mode: 'elevation' as ScoreMode, label: 'Elevation', color: ACCENT_ORANGE },
        ]).map(({ mode, label, color }) => (
          <button
            key={mode}
            onClick={() => setScoreMode(mode)}
            className="text-2xs font-mono px-2 py-1 rounded-md transition-all"
            style={{
              backgroundColor: scoreMode === mode ? `${color}${OPACITY_15}` : 'transparent',
              color: scoreMode === mode ? color : 'var(--text-muted)',
              border: `1px solid ${scoreMode === mode ? `${color}40` : 'transparent'}`,
            }}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowLOSTraces((v) => !v)}
            className="text-2xs flex items-center gap-1 px-2 py-1 rounded-md transition-all"
            style={{
              backgroundColor: showLOSTraces ? `${ACCENT_CYAN}${OPACITY_10}` : 'transparent',
              color: showLOSTraces ? ACCENT_CYAN : 'var(--text-muted)',
            }}
            title="Toggle LOS trace lines"
          >
            {showLOSTraces ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Traces
          </button>
        </div>
      </div>

      {/* SVG + side panel */}
      <div className="flex flex-col sm:flex-row">
        {/* SVG diagram */}
        <CoverDiagram
          svgRef={svgRef}
          scale={scale}
          rings={rings}
          minRadius={minRadius}
          maxRadius={maxRadius}
          heatmapArcs={heatmapArcs}
          showLOSTraces={showLOSTraces}
          losTracePoints={losTracePoints}
          points={points}
          getScore={getScore}
          bestPoint={bestPoint}
          hoveredPoint={hoveredPoint}
          setHoveredPoint={setHoveredPoint}
        />

        {/* Side panel */}
        <CoverSidePanel
          points={points}
          coveredCount={coveredCount}
          elevatedCount={elevatedCount}
          sampleCount={sampleCount}
          rings={rings}
          minRadius={minRadius}
          maxRadius={maxRadius}
          coverCheck={coverCheck}
          hoveredPoint={hoveredPoint}
          bestPositions={bestPositions}
          getScore={getScore}
        />
      </div>
    </SurfaceCard>
  );
}
