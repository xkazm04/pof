'use client';

import { Crosshair, RotateCcw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_VIOLET, OPACITY_10, OPACITY_15 } from '@/lib/chart-colors';
import { useFlankAngleHeatmap } from './useFlankAngleHeatmap';
import { HeatmapSvg } from './HeatmapSvg';
import { SidePanel } from './SidePanel';

// ── Component ────────────────────────────────────────────────────────────────

export function FlankAngleHeatmap() {
  const {
    forwardAngle,
    hoveredPoint,
    setHoveredPoint,
    svgRef,
    drag,
    scale,
    points,
    heatmapArcs,
    bestPoint,
    resetForward,
    arrowLen,
    arrowEndX,
    arrowEndY,
    forwardDeg,
  } = useFlankAngleHeatmap();

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="flank-angle-heatmap">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}` }}
        >
          <span style={{ color: ACCENT_VIOLET }}><Crosshair className="w-4 h-4" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text font-mono">Flank Angle Scoring Heatmap</h3>
          <p className="text-2xs text-text-muted">
            <code className="font-mono">UEnvQueryTest_FlankAngle</code> overlay on attack ring
          </p>
        </div>
        <button
          onClick={resetForward}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`,
            color: ACCENT_VIOLET,
            border: `1px solid ${ACCENT_VIOLET}30`,
          }}
          title="Reset forward direction to north"
          data-testid="flank-angle-reset-btn"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* SVG + side panel */}
      <div className="flex flex-col sm:flex-row">
        {/* SVG diagram */}
        <div className="flex items-center justify-center p-4" data-testid="flank-angle-svg-container">
          <HeatmapSvg
            svgRef={svgRef}
            drag={drag}
            heatmapArcs={heatmapArcs}
            points={points}
            scale={scale}
            bestPoint={bestPoint}
            hoveredPoint={hoveredPoint}
            setHoveredPoint={setHoveredPoint}
            arrowEndX={arrowEndX}
            arrowEndY={arrowEndY}
            arrowLen={arrowLen}
            forwardAngle={forwardAngle}
          />
        </div>

        {/* Side panel */}
        <SidePanel
          forwardDeg={forwardDeg}
          points={points}
          setHoveredPoint={setHoveredPoint}
        />
      </div>
    </SurfaceCard>
  );
}
