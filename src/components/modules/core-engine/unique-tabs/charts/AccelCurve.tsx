'use client';

export interface CurvePoint {
  x: number;
  y: number;
}

export interface KeyPoint extends CurvePoint {
  label: string;
}

interface AccelCurveProps {
  points: CurvePoint[];
  keyPoints?: KeyPoint[];
  width?: number;
  height?: number;
  accent: string;
  yMax?: number;
  ySteps?: number[];
  xSteps?: number[];
  title?: string;
}

export function AccelCurve({
  points,
  keyPoints,
  width = 220,
  height = 160,
  accent,
  yMax = 600,
  ySteps = [0, 150, 300, 450, 600],
  xSteps = [0, 0.25, 0.5, 0.75, 1.0],
  title,
}: AccelCurveProps) {
  const vbW = 320;
  const vbH = 200;
  const left = 40;
  const right = 300;
  const top = 20;
  const bottom = 180;
  const chartW = right - left;
  const chartH = bottom - top;

  const toX = (x: number) => left + x * chartW;
  const toY = (y: number) => bottom - (y / yMax) * chartH;

  const linePath = points.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' L ');
  const areaPath = `M ${left},${bottom} L ${linePath} L ${right},${bottom} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${vbW} ${vbH}`} className="overflow-visible">
      {/* Horizontal grid + Y labels */}
      {ySteps.map((v) => {
        const y = toY(v);
        return (
          <g key={v}>
            <line x1={left} y1={y} x2={right} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={left - 4} y={y + 3} textAnchor="end" className="text-xs font-mono fill-[var(--text-muted)]">
              {v}
            </text>
          </g>
        );
      })}
      {/* Vertical grid + X labels */}
      {xSteps.map((t) => {
        const x = toX(t);
        return (
          <g key={t}>
            <line x1={x} y1={top} x2={x} y2={bottom} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={x} y={bottom + 14} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]">
              {t}s
            </text>
          </g>
        );
      })}
      {/* Title */}
      {title && (
        <text x={(left + right) / 2} y={12} textAnchor="middle" className="text-sm font-mono font-bold fill-[var(--text-muted)]" style={{ fontSize: 13 }}>
          {title}
        </text>
      )}
      {/* Curve line */}
      <path d={`M ${linePath}`} fill="none" stroke={accent} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 4px ${accent}80)` }} />
      {/* Area fill */}
      <path d={areaPath} fill={`${accent}12`} />
      {/* Key points */}
      {keyPoints?.map((p) => {
        const px = toX(p.x);
        const py = toY(p.y);
        return (
          <g key={p.label}>
            <circle cx={px} cy={py} r={4} fill={accent} style={{ filter: `drop-shadow(0 0 4px ${accent})` }} />
            <text x={px} y={py - 10} textAnchor="middle" className="text-sm font-mono font-bold" fill={accent} style={{ fontSize: 13 }}>
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
