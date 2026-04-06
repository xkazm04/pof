'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import type { ScalingLine } from '../data';

import { withOpacity, OPACITY_6, OPACITY_10, OPACITY_25, OVERLAY_WHITE } from '@/lib/chart-colors';
/* ── Item Level Scaling Chart SVG ──────────────────────────────────────── */

export function ItemScalingChart({ lines, width, height }: { lines: ScalingLine[]; width: number; height: number }) {
  const padL = 35;
  const padR = 10;
  const padT = 10;
  const padB = 25;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allValues = lines.flatMap(l => l.points.flatMap(p => [p.min, p.max]));
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const valRange = maxVal - minVal || 1;

  const allLevels = useMemo(() => lines[0]?.points.map(p => p.level) ?? [], [lines]);
  const minLvl = Math.min(...allLevels);
  const maxLvl = Math.max(...allLevels);
  const lvlRange = maxLvl - minLvl || 1;

  const xScale = (lvl: number) => padL + ((lvl - minLvl) / lvlRange) * plotW;
  const yScale = (val: number) => padT + plotH - ((val - minVal) / valRange) * plotH;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || allLevels.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    const relX = mx - padL;
    if (relX < 0 || relX > plotW) { setHoverIdx(null); return; }
    const lvl = minLvl + (relX / plotW) * lvlRange;
    let closest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < allLevels.length; i++) {
      const d = Math.abs(allLevels[i] - lvl);
      if (d < bestDist) { bestDist = d; closest = i; }
    }
    setHoverIdx(closest);
  }, [allLevels, minLvl, lvlRange, plotW, padL, width]);

  const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

  return (
    <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible"
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padT + plotH * (1 - frac);
        const val = minVal + valRange * frac;
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke={withOpacity(OVERLAY_WHITE, OPACITY_6)} strokeWidth="1" />
            <text x={padL - 4} y={y} textAnchor="end" dominantBaseline="central"
              className="text-xs font-mono fill-[var(--text-muted)]">
              {val.toFixed(0)}
            </text>
          </g>
        );
      })}
      {/* X axis labels */}
      {allLevels.filter((_, i) => i % 2 === 0).map(lvl => (
        <text key={lvl} x={xScale(lvl)} y={height - 4} textAnchor="middle"
          className="text-xs font-mono fill-[var(--text-muted)]">
          {lvl}
        </text>
      ))}
      <text x={width / 2} y={height} textAnchor="middle"
        className="text-xs font-mono fill-[var(--text-muted)]">
        Item Level
      </text>
      {/* Lines with min/max bands */}
      {lines.map(line => {
        const bandPath = line.points.map((p, i) => {
          const x = xScale(p.level);
          const yMax = yScale(p.max);
          return i === 0 ? `M${x},${yMax}` : `L${x},${yMax}`;
        }).join(' ') + ' ' + [...line.points].reverse().map((p, i) => {
          const x = xScale(p.level);
          const yMin = yScale(p.min);
          return i === 0 ? `L${x},${yMin}` : `L${x},${yMin}`;
        }).join(' ') + ' Z';

        const midPath = line.points.map((p, i) => {
          const x = xScale(p.level);
          const y = yScale((p.min + p.max) / 2);
          return i === 0 ? `M${x},${y}` : `L${x},${y}`;
        }).join(' ');

        return (
          <g key={line.label}>
            <path d={bandPath} fill={`${withOpacity(line.color, OPACITY_10)}`} stroke="none" />
            <path d={midPath} fill="none" stroke={line.color} strokeWidth="1.5" strokeLinecap="round" />
            {line.points.map(p => (
              <circle key={p.level} cx={xScale(p.level)} cy={yScale((p.min + p.max) / 2)} r="2"
                fill={line.color} className="opacity-60" />
            ))}
          </g>
        );
      })}
      {/* Hover crosshair + values */}
      {hoverIdx != null && allLevels[hoverIdx] != null && (() => {
        const lvl = allLevels[hoverIdx];
        const hx = xScale(lvl);
        return (
          <g className="pointer-events-none">
            <line x1={hx} y1={padT} x2={hx} y2={padT + plotH} stroke={withOpacity(OVERLAY_WHITE, OPACITY_25)} strokeWidth="1" strokeDasharray="3 2" />
            <text x={hx} y={padT - 3} textAnchor="middle" className="text-xs font-mono font-bold fill-text" style={{ fontSize: 9 }}>Lv{lvl}</text>
            {lines.map(line => {
              const pt = line.points.find(p => p.level === lvl);
              if (!pt) return null;
              const midY = yScale((pt.min + pt.max) / 2);
              return (
                <g key={line.label}>
                  <circle cx={hx} cy={midY} r={4} fill={line.color} stroke="var(--surface-deep)" strokeWidth="1.5" />
                  <rect x={hx + 5} y={midY - 8} width={45} height={14} rx={3}
                    fill="var(--surface-deep)" stroke={line.color} strokeWidth={0.5}
                    style={{ filter: `drop-shadow(0 0 4px ${withOpacity(line.color, OPACITY_25)})` }} />
                  <text x={hx + 27} y={midY + 1} textAnchor="middle" dominantBaseline="central"
                    className="font-mono font-bold" fill={line.color} style={{ fontSize: 8 }}>
                    {((pt.min + pt.max) / 2).toFixed(0)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}
    </svg>
  );
}
