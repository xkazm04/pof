'use client';

import type { RefObject } from 'react';
import {
  ACCENT_EMERALD, ACCENT_ORANGE,
  STATUS_SUCCESS,
} from '@/lib/chart-colors';
import { arcPath } from '@/components/ui/svg/arc-helpers';
import { SVG_SIZE, SVG_CENTER, DRAW_RADIUS } from './constants';
import { coverColor } from './helpers';
import { CoverObstacles } from './CoverObstacles';
import { CoverPoints } from './CoverPoints';
import type { CoverPoint } from './types';

interface HeatmapArc {
  startAngle: number;
  endAngle: number;
  score: number;
  color: string;
}

interface CoverDiagramProps {
  svgRef: RefObject<SVGSVGElement | null>;
  scale: number;
  rings: number;
  minRadius: number;
  maxRadius: number;
  heatmapArcs: HeatmapArc[];
  showLOSTraces: boolean;
  losTracePoints: CoverPoint[];
  points: CoverPoint[];
  getScore: (pt: CoverPoint) => number;
  bestPoint: CoverPoint;
  hoveredPoint: number | null;
  setHoveredPoint: (v: number | null) => void;
}

export function CoverDiagram({
  svgRef, scale, rings, minRadius, maxRadius,
  heatmapArcs, showLOSTraces, losTracePoints,
  points, getScore, bestPoint, hoveredPoint, setHoveredPoint,
}: CoverDiagramProps) {
  return (
    <div className="flex items-center justify-center p-4" data-testid="cover-svg-container">
      <svg
        ref={svgRef}
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="shrink-0 select-none"
      >
        {/* Coverage heatmap annular zone */}
        {heatmapArcs.map((arc, i) => (
          <path
            key={i}
            d={arcPath(
              SVG_CENTER, SVG_CENTER,
              DRAW_RADIUS * 0.5, DRAW_RADIUS * 0.95,
              arc.startAngle, arc.endAngle,
            )}
            fill={arc.color}
            fillOpacity={0.12}
            stroke={arc.color}
            strokeWidth={0.3}
            strokeOpacity={0.2}
          />
        ))}

        {/* Ring boundaries */}
        {Array.from({ length: rings }, (_, ringIdx) => {
          const alpha = rings === 1 ? 0.5 : ringIdx / (rings - 1);
          const r = (minRadius + (maxRadius - minRadius) * alpha) * scale;
          return (
            <circle
              key={ringIdx}
              cx={SVG_CENTER} cy={SVG_CENTER} r={r}
              fill="none" stroke="var(--border)"
              strokeWidth={0.5} opacity={0.3}
              strokeDasharray="4 3"
            />
          );
        })}

        {/* Outer boundary */}
        <circle
          cx={SVG_CENTER} cy={SVG_CENTER} r={DRAW_RADIUS}
          fill="none" stroke={ACCENT_EMERALD}
          strokeWidth={1} opacity={0.3}
        />

        {/* Inner boundary */}
        <circle
          cx={SVG_CENTER} cy={SVG_CENTER} r={minRadius * scale}
          fill="none" stroke={ACCENT_EMERALD}
          strokeWidth={0.8} opacity={0.2}
          strokeDasharray="3 2"
        />

        <CoverObstacles scale={scale} />

        {/* LOS trace lines from covered points to threat center */}
        {showLOSTraces && losTracePoints.map((pt, i) => {
          const sx = SVG_CENTER + pt.x * scale;
          const sy = SVG_CENTER + pt.y * scale;
          return (
            <line
              key={`los-${i}`}
              x1={SVG_CENTER} y1={SVG_CENTER}
              x2={sx} y2={sy}
              stroke={STATUS_SUCCESS}
              strokeWidth={0.4}
              opacity={0.15}
              strokeDasharray="2 3"
            />
          );
        })}

        <CoverPoints
          scale={scale}
          points={points}
          getScore={getScore}
          bestPoint={bestPoint}
          hoveredPoint={hoveredPoint}
          setHoveredPoint={setHoveredPoint}
        />

        {/* Threat center crosshair */}
        <line
          x1={SVG_CENTER - 10} y1={SVG_CENTER}
          x2={SVG_CENTER + 10} y2={SVG_CENTER}
          stroke={ACCENT_ORANGE} strokeWidth={1.5} opacity={0.7}
        />
        <line
          x1={SVG_CENTER} y1={SVG_CENTER - 10}
          x2={SVG_CENTER} y2={SVG_CENTER + 10}
          stroke={ACCENT_ORANGE} strokeWidth={1.5} opacity={0.7}
        />
        <text
          x={SVG_CENTER}
          y={SVG_CENTER + 20}
          textAnchor="middle"
          className="text-[11px] font-mono"
          fill={ACCENT_ORANGE} opacity={0.8}
        >
          Threat (Player)
        </text>

        {/* Legend gradient */}
        <defs>
          <linearGradient id="cover-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={coverColor(0)} />
            <stop offset="50%" stopColor={coverColor(0.5)} />
            <stop offset="100%" stopColor={coverColor(1)} />
          </linearGradient>
        </defs>
        <rect
          x={SVG_CENTER - 60} y={SVG_SIZE - 22}
          width={120} height={6} rx={3}
          fill="url(#cover-gradient)"
          opacity={0.8}
        />
        <text x={SVG_CENTER - 62} y={SVG_SIZE - 14} textAnchor="end" className="text-[11px] font-mono fill-[var(--text-muted)]">Exposed</text>
        <text x={SVG_CENTER + 62} y={SVG_SIZE - 14} textAnchor="start" className="text-[11px] font-mono fill-[var(--text-muted)]">Covered</text>

        {/* Degree markings */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const lx = SVG_CENTER + Math.cos(rad) * (DRAW_RADIUS + 16);
          const ly = SVG_CENTER + Math.sin(rad) * (DRAW_RADIUS + 16);
          return (
            <text
              key={deg}
              x={lx} y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[11px] font-mono fill-[var(--text-muted)]"
              opacity={0.4}
            >
              {deg}°
            </text>
          );
        })}
      </svg>
    </div>
  );
}
