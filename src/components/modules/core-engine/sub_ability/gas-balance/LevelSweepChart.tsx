'use client';

import { useState, useRef } from 'react';
import {
  STATUS_SUCCESS, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import type { LevelSweepPoint } from './data';

const METRICS: {
  key: keyof LevelSweepPoint;
  label: string;
  color: string;
  normalize: (v: number, max: number) => number;
  format: (v: number) => string;
}[] = [
  { key: 'ttk', label: 'TTK', color: ACCENT_CYAN, normalize: (v, m) => v / m, format: v => `${v.toFixed(1)}s` },
  { key: 'dps', label: 'DPS', color: ACCENT_ORANGE, normalize: (v, m) => v / m, format: v => v.toFixed(0) },
  { key: 'survivalRate', label: 'Survival', color: STATUS_SUCCESS, normalize: v => v, format: v => `${(v * 100).toFixed(0)}%` },
  { key: 'ehp', label: 'EHP', color: ACCENT_EMERALD, normalize: (v, m) => v / m, format: v => v.toFixed(0) },
];

/** Multi-metric level sweep SVG chart with hover crosshair and breakpoint markers */
export function LevelSweepChart({ points, breakpoints, width, height }: {
  points: LevelSweepPoint[];
  breakpoints: { level: number; reason: string }[];
  width: number;
  height: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length < 2) return null;

  const pad = { l: 44, r: 12, t: 12, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  const xMin = points[0].level;
  const xMax = points[points.length - 1].level;
  const toX = (level: number) => pad.l + ((level - xMin) / (xMax - xMin || 1)) * w;

  const ttkMax = Math.max(...points.map(p => p.ttk), 1);
  const dpsMax = Math.max(...points.map(p => p.dps), 1);
  const ehpMax = Math.max(...points.map(p => p.ehp), 1);
  const maxes: Record<string, number> = { ttk: ttkMax, dps: dpsMax, ehp: ehpMax, survivalRate: 1 };

  const toY = (normalized: number) => pad.t + h - normalized * h;

  const buildPath = (metric: typeof METRICS[0]) =>
    points.map((p, i) => {
      const x = toX(p.level).toFixed(1);
      const y = toY(metric.normalize(p[metric.key] as number, maxes[metric.key] ?? 1)).toFixed(1);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(toX(points[i].level) - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoveredIdx(closest);
  };

  const hp = hoveredIdx !== null ? points[hoveredIdx] : null;
  const hx = hp ? toX(hp.level) : 0;
  const tooltipOnRight = hp ? hx < width / 2 : true;
  const breakpointLevels = new Set(breakpoints.map(b => b.level));

  return (
    <svg ref={svgRef} width={width} height={height} className="overflow-visible"
      onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIdx(null)}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = pad.t + h * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="var(--color-border)" strokeOpacity={0.2} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" className="text-2xs fill-text-muted">{(f * 100).toFixed(0)}%</text>
          </g>
        );
      })}

      {/* Breakpoint danger zones */}
      {points.map((p, i) => {
        if (!breakpointLevels.has(p.level)) return null;
        const x = toX(p.level);
        const bw = w / (xMax - xMin || 1);
        return <rect key={`bp-${i}`} x={x - bw / 2} y={pad.t} width={bw} height={h} fill={STATUS_ERROR} fillOpacity={0.08} />;
      })}

      {/* Metric curves */}
      {METRICS.map(metric => (
        <path key={metric.key} d={buildPath(metric)} fill="none" stroke={metric.color} strokeWidth={1.5} strokeLinejoin="round" />
      ))}

      {/* Hover crosshair */}
      {hp && (
        <g>
          <line x1={hx} y1={pad.t} x2={hx} y2={pad.t + h}
            stroke="var(--color-text-muted)" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.5} />
          {METRICS.map(metric => (
            <circle key={metric.key} cx={hx}
              cy={toY(metric.normalize(hp[metric.key] as number, maxes[metric.key] ?? 1))}
              r={3.5} fill={metric.color} stroke="var(--surface-deep)" strokeWidth={1.5} />
          ))}
          <foreignObject x={tooltipOnRight ? hx + 10 : hx - 140}
            y={Math.min(pad.t + 10, pad.t + h - 90)} width={130} height={88}>
            <div className="bg-surface-1 border border-border rounded px-2 py-1.5 text-2xs font-mono shadow-lg">
              <div className="font-bold text-text mb-0.5">Level {hp.level}</div>
              {METRICS.map(m => (
                <div key={m.key} className="flex justify-between">
                  <span style={{ color: m.color }}>{m.label}:</span>
                  <span className="text-text">{m.format(hp[m.key] as number)}</span>
                </div>
              ))}
            </div>
          </foreignObject>
        </g>
      )}

      {/* X axis labels */}
      {Array.from({ length: 6 }, (_, i) => {
        const level = Math.round(xMin + (xMax - xMin) * (i / 5));
        return <text key={i} x={toX(level)} y={height - 4} textAnchor="middle" className="text-2xs fill-text-muted">{level}</text>;
      })}

      {/* Breakpoint markers */}
      {breakpoints.slice(0, 5).map((bp, i) => (
        <line key={`bpm-${i}`} x1={toX(bp.level)} y1={pad.t} x2={toX(bp.level)} y2={pad.t + h}
          stroke={STATUS_ERROR} strokeDasharray="2 2" strokeWidth={1} strokeOpacity={0.6} />
      ))}
    </svg>
  );
}

export { METRICS as LEVEL_SWEEP_METRICS };
