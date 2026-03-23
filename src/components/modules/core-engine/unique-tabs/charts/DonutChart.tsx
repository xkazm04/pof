'use client';

export interface DonutSegment {
  label: string;
  pct: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  outerRadius?: number;
  innerRadius?: number;
  centerLabel?: string;
  centerSublabel?: string;
}

export function DonutChart({
  segments,
  size = 140,
  outerRadius,
  innerRadius,
  centerLabel,
  centerSublabel,
}: DonutChartProps) {
  const vb = 180;
  const cx = vb / 2;
  const cy = vb / 2;
  const r = outerRadius ?? 70;
  const ir = innerRadius ?? 42;

  let cumAngle = -90;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
      {segments.map((seg) => {
        const startAngle = cumAngle;
        const sweep = (seg.pct / 100) * 360;
        cumAngle += sweep;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = ((startAngle + sweep) * Math.PI) / 180;
        const largeArc = sweep > 180 ? 1 : 0;
        const x1o = cx + r * Math.cos(startRad);
        const y1o = cy + r * Math.sin(startRad);
        const x2o = cx + r * Math.cos(endRad);
        const y2o = cy + r * Math.sin(endRad);
        const x1i = cx + ir * Math.cos(endRad);
        const y1i = cy + ir * Math.sin(endRad);
        const x2i = cx + ir * Math.cos(startRad);
        const y2i = cy + ir * Math.sin(startRad);
        const d = `M ${x1o} ${y1o} A ${r} ${r} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${ir} ${ir} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
        return (
          <path
            key={seg.label}
            d={d}
            fill={seg.color}
            opacity={0.8}
            stroke="var(--surface)"
            strokeWidth="2"
            style={{ filter: `drop-shadow(0 0 3px ${seg.color}60)` }}
          />
        );
      })}
      {centerLabel && (
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-sm font-mono font-bold fill-[var(--text)]" style={{ fontSize: 13 }}>
          {centerLabel}
        </text>
      )}
      {centerSublabel && (
        <text x={cx} y={cx + 10} textAnchor="middle" className="text-[11px] font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}>
          {centerSublabel}
        </text>
      )}
    </svg>
  );
}
