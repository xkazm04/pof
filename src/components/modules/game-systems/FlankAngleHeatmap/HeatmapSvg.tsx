'use client';

import { Dispatch, RefObject, SetStateAction } from 'react';
import { ACCENT_VIOLET, ACCENT_CYAN } from '@/lib/chart-colors';
import { arcPath } from '@/components/ui/svg/arc-helpers';
import type { useDragAngle } from '@/hooks/useDragAngle';
import { SVG_SIZE, SVG_CENTER, DRAW_RADIUS } from './constants';
import { flankColor, type RingPoint } from './helpers';

interface HeatmapSvgProps {
  svgRef: RefObject<SVGSVGElement | null>;
  drag: ReturnType<typeof useDragAngle>;
  heatmapArcs: { startAngle: number; endAngle: number; flankDeg: number; color: string }[];
  points: RingPoint[];
  scale: number;
  bestPoint: RingPoint;
  hoveredPoint: number | null;
  setHoveredPoint: Dispatch<SetStateAction<number | null>>;
  arrowEndX: number;
  arrowEndY: number;
  arrowLen: number;
  forwardAngle: number;
}

export function HeatmapSvg({
  svgRef,
  drag,
  heatmapArcs,
  points,
  scale,
  bestPoint,
  hoveredPoint,
  setHoveredPoint,
  arrowEndX,
  arrowEndY,
  arrowLen,
  forwardAngle,
}: HeatmapSvgProps) {
  return (
    <svg
      ref={svgRef}
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      className="shrink-0 select-none"
      style={{ cursor: drag.isDragging ? 'grabbing' : 'default' }}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerUp}
    >
      {/* Heatmap annular zone */}
      {heatmapArcs.map((arc, i) => (
        <path
          key={i}
          d={arcPath(
            SVG_CENTER, SVG_CENTER,
            DRAW_RADIUS * 0.65, DRAW_RADIUS,
            arc.startAngle, arc.endAngle,
          )}
          fill={arc.color}
          fillOpacity={0.18}
          stroke={arc.color}
          strokeWidth={0.3}
          strokeOpacity={0.3}
        />
      ))}

      {/* Attack ring circle */}
      <circle
        cx={SVG_CENTER}
        cy={SVG_CENTER}
        r={DRAW_RADIUS}
        fill="none"
        stroke={ACCENT_VIOLET}
        strokeWidth={1}
        opacity={0.4}
      />

      {/* Degree markings */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const labelR = DRAW_RADIUS + 16;
        const lx = SVG_CENTER + Math.cos(rad) * labelR;
        const ly = SVG_CENTER + Math.sin(rad) * labelR;
        return (
          <text
            key={deg}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[11px] font-mono fill-[var(--text-muted)]"
            opacity={0.5}
          >
            {deg}°
          </text>
        );
      })}

      {/* Target forward vector arrow (draggable) */}
      <line
        x1={SVG_CENTER}
        y1={SVG_CENTER}
        x2={arrowEndX}
        y2={arrowEndY}
        stroke={ACCENT_CYAN}
        strokeWidth={2.5}
        opacity={0.9}
        markerEnd="url(#fwd-arrow)"
      />
      <defs>
        <marker
          id="fwd-arrow"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={ACCENT_CYAN} />
        </marker>
      </defs>

      {/* Draggable handle at arrow tip */}
      <circle
        cx={arrowEndX}
        cy={arrowEndY}
        r={10}
        fill={ACCENT_CYAN}
        fillOpacity={0.15}
        stroke={ACCENT_CYAN}
        strokeWidth={1.5}
        className="cursor-grab"
        onPointerDown={drag.onPointerDown}
        data-testid="flank-angle-drag-handle"
      />

      {/* "Forward" label near arrow */}
      <text
        x={SVG_CENTER + Math.cos(forwardAngle) * (arrowLen * 0.55)}
        y={SVG_CENTER + Math.sin(forwardAngle) * (arrowLen * 0.55) - 8}
        textAnchor="middle"
        className="text-[11px] font-mono font-bold"
        fill={ACCENT_CYAN}
        opacity={0.8}
      >
        Forward
      </text>

      {/* Target center crosshair */}
      <line
        x1={SVG_CENTER - 10} y1={SVG_CENTER}
        x2={SVG_CENTER + 10} y2={SVG_CENTER}
        stroke={ACCENT_CYAN} strokeWidth={1.5} opacity={0.6}
      />
      <line
        x1={SVG_CENTER} y1={SVG_CENTER - 10}
        x2={SVG_CENTER} y2={SVG_CENTER + 10}
        stroke={ACCENT_CYAN} strokeWidth={1.5} opacity={0.6}
      />
      <text
        x={SVG_CENTER}
        y={SVG_CENTER + 22}
        textAnchor="middle"
        className="text-[11px] font-mono"
        fill={ACCENT_CYAN}
        opacity={0.7}
      >
        Target
      </text>

      {/* Attack ring points with flank scoring */}
      {points.map((pt, i) => {
        const sx = SVG_CENTER + pt.x * scale;
        const sy = SVG_CENTER + pt.y * scale;
        const isBest = pt === bestPoint;
        const isHovered = hoveredPoint === i;
        const baseR = isBest ? 7 : 5;
        const r = isHovered ? baseR + 2 : baseR;

        return (
          <g key={i}>
            {/* Glow for best point */}
            {isBest && (
              <circle
                cx={sx} cy={sy} r={12}
                fill="none" stroke={pt.color}
                strokeWidth={1} opacity={0.4}
                strokeDasharray="3 2"
              />
            )}
            {/* Point */}
            <circle
              cx={sx} cy={sy} r={r}
              fill={pt.color}
              fillOpacity={0.9}
              stroke="var(--surface-deep)"
              strokeWidth={1.5}
              className="cursor-pointer transition-all"
              onPointerEnter={() => setHoveredPoint(i)}
              onPointerLeave={() => setHoveredPoint(null)}
              data-testid={`flank-point-${i}`}
            />
            {/* Score label */}
            <text
              x={sx}
              y={sy - (isHovered ? r + 6 : r + 4)}
              textAnchor="middle"
              className="text-[11px] font-mono font-bold"
              fill={pt.color}
              opacity={isHovered || isBest ? 1 : 0.7}
            >
              {Math.round(pt.flankDeg)}°
            </text>
          </g>
        );
      })}

      {/* Hovered point detail tooltip */}
      {hoveredPoint !== null && (() => {
        const pt = points[hoveredPoint];
        const sx = SVG_CENTER + pt.x * scale;
        const sy = SVG_CENTER + pt.y * scale;
        const tooltipX = sx + (sx > SVG_CENTER ? -70 : 10);
        const tooltipY = sy + (sy > SVG_CENTER ? -40 : 10);

        return (
          <g>
            <rect
              x={tooltipX} y={tooltipY}
              width={62} height={28}
              rx={4}
              fill="var(--surface-deep)"
              stroke="var(--border)"
              strokeWidth={0.5}
              opacity={0.95}
            />
            <text x={tooltipX + 4} y={tooltipY + 12}
              className="text-[11px] font-mono fill-[var(--text-muted)]"
            >
              Score: {pt.flankDeg.toFixed(1)}°
            </text>
            <text x={tooltipX + 4} y={tooltipY + 22}
              className="text-[11px] font-mono font-bold" fill={pt.color}
            >
              {pt.flankDeg >= 135 ? 'Behind' : pt.flankDeg >= 45 ? 'Side' : 'Front'}
            </text>
          </g>
        );
      })()}

      {/* Color gradient legend */}
      <defs>
        <linearGradient id="flank-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={flankColor(0)} />
          <stop offset="50%" stopColor={flankColor(90)} />
          <stop offset="100%" stopColor={flankColor(180)} />
        </linearGradient>
      </defs>
      <rect
        x={SVG_CENTER - 60} y={SVG_SIZE - 22}
        width={120} height={6} rx={3}
        fill="url(#flank-gradient)"
        opacity={0.8}
      />
      <text x={SVG_CENTER - 62} y={SVG_SIZE - 14} textAnchor="end" className="text-[11px] font-mono fill-[var(--text-muted)]">0° Front</text>
      <text x={SVG_CENTER + 62} y={SVG_SIZE - 14} textAnchor="start" className="text-[11px] font-mono fill-[var(--text-muted)]">180° Behind</text>
    </svg>
  );
}
