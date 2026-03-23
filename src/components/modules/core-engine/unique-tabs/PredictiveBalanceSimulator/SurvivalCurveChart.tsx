'use client';

import { useState, useRef } from 'react';
import { STATUS_ERROR } from '@/lib/chart-colors';
import {
  ACCENT, ENCOUNTER_COLORS, survivalColor,
  type SurvivalCurvePoint,
} from './data';

export function SurvivalCurveChart({ curves, width, height }: {
  curves: Record<string, SurvivalCurvePoint[]>; width: number; height: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const entries = Object.entries(curves);
  if (entries.length === 0) return null;

  const allPoints = entries.flatMap(([, pts]) => pts);
  const xMin = Math.min(...allPoints.map(p => p.level));
  const xMax = Math.max(...allPoints.map(p => p.level));

  const pad = { l: 36, r: 8, t: 8, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  const toX = (v: number) => pad.l + ((v - xMin) / (xMax - xMin || 1)) * w;
  const toY = (v: number) => pad.t + h - v * h;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const firstPts = entries[0][1];
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < firstPts.length; i++) {
      const dist = Math.abs(toX(firstPts[i].level) - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoveredIdx(closest);
  };

  return (
    <svg
      ref={svgRef} width={width} height={height}
      className="overflow-visible"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = toY(f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={width - pad.r} y2={y}
              stroke="var(--color-border)" strokeOpacity={0.3} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end"
              className="text-2xs fill-text-muted">
              {(f * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}

      {/* Danger zone */}
      <rect x={pad.l} y={toY(0.5)} width={w} height={toY(0) - toY(0.5)}
        fill={STATUS_ERROR} fillOpacity={0.05} />

      {/* Curves */}
      {entries.map(([label, pts], ci) => {
        const color = ENCOUNTER_COLORS[ci % ENCOUNTER_COLORS.length];
        const path = pts
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.level).toFixed(1)} ${toY(p.survivalRate).toFixed(1)}`)
          .join(' ');
        return (
          <g key={label}>
            <path d={path} fill="none" stroke={color} strokeWidth={2} />
            {pts.map((p, i) => (
              <circle key={i} cx={toX(p.level)} cy={toY(p.survivalRate)}
                r={hoveredIdx === i ? 4 : 2} fill={color} />
            ))}
          </g>
        );
      })}

      {/* Hover crosshair + tooltip */}
      {hoveredIdx !== null && entries[0][1][hoveredIdx] && (() => {
        const lvl = entries[0][1][hoveredIdx].level;
        const x = toX(lvl);
        return (
          <g>
            <line x1={x} y1={pad.t} x2={x} y2={pad.t + h}
              stroke={ACCENT} strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.5} />
            <foreignObject x={x + 8} y={pad.t + 4}
              width={130} height={16 + entries.length * 16}>
              <div className="bg-surface-1 border border-border rounded px-2 py-1 text-2xs font-mono shadow-lg">
                <div className="font-bold text-text mb-0.5">Lv.{lvl}</div>
                {entries.map(([label, pts], ci) => {
                  const p = pts[hoveredIdx!];
                  if (!p) return null;
                  return (
                    <div key={label} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ENCOUNTER_COLORS[ci % ENCOUNTER_COLORS.length] }} />
                      <span style={{ color: survivalColor(p.survivalRate) }}>
                        {(p.survivalRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </foreignObject>
          </g>
        );
      })()}

      {/* X axis labels */}
      {entries[0][1]
        .filter((_, i, arr) => i === 0 || i === Math.floor(arr.length / 2) || i === arr.length - 1)
        .map((p, i) => (
          <text key={i} x={toX(p.level)} y={height - 2}
            textAnchor="middle" className="text-2xs fill-text-muted">
            Lv.{p.level}
          </text>
        ))}
    </svg>
  );
}
