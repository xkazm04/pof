'use client';

import { ACCENT } from './constants';

/* ── SVG Power Curve Chart ────────────────────────────────────────────── */

interface PowerCurveData {
  level: number;
  avgPower: number;
  p10: number;
  p90: number;
}

export function PowerCurveChart({ data }: { data: PowerCurveData[] }) {
  const width = 520;
  const height = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 50 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const maxPower = Math.max(...data.map((d) => d.p90), 1);
  const maxLevel = Math.max(...data.map((d) => d.level), 1);

  const x = (level: number) => pad.left + (level / maxLevel) * cw;
  const y = (power: number) => pad.top + ch - (power / maxPower) * ch;

  const avgLine = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.level)} ${y(d.avgPower)}`)
    .join(' ');
  const p10Line = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.level)} ${y(d.p10)}`)
    .join(' ');
  const p90Line = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.level)} ${y(d.p90)}`)
    .join(' ');

  const bandPath =
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.level)} ${y(d.p90)}`).join(' ') +
    data
      .map((d) => `L ${x(d.level)} ${y(d.p10)}`)
      .reverse()
      .join(' ') +
    ' Z';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <g key={pct}>
          <line
            x1={pad.left} y1={pad.top + ch * (1 - pct)}
            x2={width - pad.right} y2={pad.top + ch * (1 - pct)}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1"
          />
          <text
            x={pad.left - 5} y={pad.top + ch * (1 - pct) + 4}
            textAnchor="end" className="text-xs font-mono fill-[var(--text-muted)]"
            style={{ fontSize: 11 }}
          >
            {Math.round(maxPower * pct)}
          </text>
        </g>
      ))}

      {/* X axis labels */}
      {data
        .filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0)
        .map((d) => (
          <text
            key={d.level} x={x(d.level)} y={height - 5}
            textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]"
            style={{ fontSize: 11 }}
          >
            Lv{d.level}
          </text>
        ))}

      {/* P10-P90 band */}
      <path d={bandPath} fill={`${ACCENT}15`} />

      {/* P10 / P90 dashed lines */}
      <path d={p10Line} fill="none" stroke={`${ACCENT}40`} strokeWidth="1" strokeDasharray="3 2" />
      <path d={p90Line} fill="none" stroke={`${ACCENT}40`} strokeWidth="1" strokeDasharray="3 2" />

      {/* Average line */}
      <path
        d={avgLine} fill="none" stroke={ACCENT} strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 4px ${ACCENT}80)` }}
      />

      {/* Data points on average */}
      {data
        .filter((_, i) => i % Math.max(1, Math.floor(data.length / 10)) === 0)
        .map((d) => (
          <circle key={d.level} cx={x(d.level)} cy={y(d.avgPower)} r="3" fill={ACCENT} />
        ))}

      {/* Axis labels */}
      <text
        x={width / 2} y={height - 0} textAnchor="middle"
        className="text-xs font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}
      >
        Player Level
      </text>
      <text
        x={12} y={height / 2} textAnchor="middle"
        className="text-xs font-mono fill-[var(--text-muted)]"
        style={{ fontSize: 11 }} transform={`rotate(-90, 12, ${height / 2})`}
      >
        Item Power
      </text>
    </svg>
  );
}
