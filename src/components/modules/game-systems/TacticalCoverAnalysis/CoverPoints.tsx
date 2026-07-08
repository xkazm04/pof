'use client';

import { SVG_CENTER } from './constants';
import { coverColor } from './helpers';
import type { CoverPoint } from './types';

interface CoverPointsProps {
  scale: number;
  points: CoverPoint[];
  getScore: (pt: CoverPoint) => number;
  bestPoint: CoverPoint;
  hoveredPoint: number | null;
  setHoveredPoint: (v: number | null) => void;
}

export function CoverPoints({
  scale, points, getScore, bestPoint, hoveredPoint, setHoveredPoint,
}: CoverPointsProps) {
  return (
    <>
      {/* Cover points */}
      {points.map((pt, i) => {
        const sx = SVG_CENTER + pt.x * scale;
        const sy = SVG_CENTER + pt.y * scale;
        const score = getScore(pt);
        const color = coverColor(score);
        const isBest = pt === bestPoint;
        const isHovered = hoveredPoint === i;
        const baseR = isBest ? 6 : score > 0.5 ? 4 : 3;
        const r = isHovered ? baseR + 2 : baseR;

        return (
          <g key={i}>
            {/* Best point glow */}
            {isBest && (
              <circle
                cx={sx} cy={sy} r={11}
                fill="none" stroke={color}
                strokeWidth={1.2} opacity={0.5}
                strokeDasharray="3 2"
              />
            )}
            <circle
              cx={sx} cy={sy} r={r}
              fill={color}
              fillOpacity={score > 0.3 ? 0.85 : 0.4}
              stroke="var(--surface-deep)"
              strokeWidth={1}
              className="cursor-pointer transition-all"
              onPointerEnter={() => setHoveredPoint(i)}
              onPointerLeave={() => setHoveredPoint(null)}
            />
            {/* Score label on hover/best */}
            {(isHovered || isBest) && (
              <text
                x={sx}
                y={sy - r - 4}
                textAnchor="middle"
                className="text-[11px] font-mono font-bold"
                fill={color}
              >
                {(score * 100).toFixed(0)}%
              </text>
            )}
          </g>
        );
      })}

      {/* Hovered point detail tooltip */}
      {hoveredPoint !== null && (() => {
        const pt = points[hoveredPoint];
        const sx = SVG_CENTER + pt.x * scale;
        const sy = SVG_CENTER + pt.y * scale;
        const tooltipX = sx + (sx > SVG_CENTER ? -90 : 10);
        const tooltipY = sy + (sy > SVG_CENTER ? -52 : 10);

        return (
          <g>
            <rect
              x={tooltipX} y={tooltipY}
              width={82} height={42}
              rx={4}
              fill="var(--surface-deep)"
              stroke="var(--border)"
              strokeWidth={0.5}
              opacity={0.95}
            />
            <text x={tooltipX + 4} y={tooltipY + 11}
              className="text-[11px] font-mono fill-[var(--text-muted)]"
            >
              Cover: {(pt.coverScore * 100).toFixed(0)}%
            </text>
            <text x={tooltipX + 4} y={tooltipY + 22}
              className="text-[11px] font-mono fill-[var(--text-muted)]"
            >
              Elev: {(pt.elevationScore * 100).toFixed(0)}%
            </text>
            <text x={tooltipX + 4} y={tooltipY + 33}
              className="text-[11px] font-mono font-bold"
              fill={coverColor(pt.combinedScore)}
            >
              Combined: {(pt.combinedScore * 100).toFixed(0)}%
            </text>
          </g>
        );
      })()}
    </>
  );
}
