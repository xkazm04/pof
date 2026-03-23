'use client';

import type { ScalingLine } from './data';

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

  const allLevels = lines[0]?.points.map(p => p.level) ?? [];
  const minLvl = Math.min(...allLevels);
  const maxLvl = Math.max(...allLevels);
  const lvlRange = maxLvl - minLvl || 1;

  const xScale = (lvl: number) => padL + ((lvl - minLvl) / lvlRange) * plotW;
  const yScale = (val: number) => padT + plotH - ((val - minVal) / valRange) * plotH;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padT + plotH * (1 - frac);
        const val = minVal + valRange * frac;
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 4} y={y} textAnchor="end" dominantBaseline="central"
              className="text-[11px] font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}>
              {val.toFixed(0)}
            </text>
          </g>
        );
      })}
      {/* X axis labels */}
      {allLevels.filter((_, i) => i % 2 === 0).map(lvl => (
        <text key={lvl} x={xScale(lvl)} y={height - 4} textAnchor="middle"
          className="text-[11px] font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}>
          {lvl}
        </text>
      ))}
      <text x={width / 2} y={height} textAnchor="middle"
        className="text-[11px] font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}>
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
            <path d={bandPath} fill={`${line.color}15`} stroke="none" />
            <path d={midPath} fill="none" stroke={line.color} strokeWidth="1.5" strokeLinecap="round" />
            {line.points.map(p => (
              <circle key={p.level} cx={xScale(p.level)} cy={yScale((p.min + p.max) / 2)} r="2"
                fill={line.color} className="opacity-60" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
