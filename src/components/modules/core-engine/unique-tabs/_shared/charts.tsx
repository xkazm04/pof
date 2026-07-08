'use client';

import { type CSSProperties, ReactNode } from 'react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OVERLAY_WHITE,
  OPACITY_5, OPACITY_6, OPACITY_8, OPACITY_12,
  GLOW_SM,
  withOpacity,
} from '@/lib/chart-colors';
import type { RadarDataPoint, GaugeMetric } from '@/types/unique-tab-improvements';

/* ── RadarChart ──────────────────────────────────────────────────────────── */

interface RadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  accent: string;
  overlays?: { data: RadarDataPoint[]; color: string; label: string }[];
  showLabels?: boolean;
}

export function RadarChart({ data, size = 220, accent, overlays, showLabels = true }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;

  const toXY = (value: number, index: number) => {
    const angle = angleStep * index - Math.PI / 2;
    return { x: cx + r * value * Math.cos(angle), y: cy + r * value * Math.sin(angle) };
  };

  const polyPoints = (pts: RadarDataPoint[]) =>
    pts.map((d, i) => { const p = toXY(d.value, i); return `${p.x},${p.y}`; }).join(' ');

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Grid rings */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={data.map((_, i) => { const p = toXY(level, i); return `${p.x},${p.y}`; }).join(' ')}
          fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_8)} strokeWidth="1"
        />
      ))}
      {/* Axis lines */}
      {data.map((_, i) => {
        const p = toXY(1, i);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={withOpacity(OVERLAY_WHITE, OPACITY_6)} strokeWidth="1" />;
      })}
      {/* Overlay polygons */}
      {overlays?.map((overlay) => (
        <polygon
          key={overlay.label}
          points={polyPoints(overlay.data)}
          fill={withOpacity(overlay.color, OPACITY_8)} stroke={overlay.color} strokeWidth="1.5" strokeDasharray="4 2"
        />
      ))}
      {/* Primary polygon */}
      <polygon points={polyPoints(data)} fill={withOpacity(accent, OPACITY_12)} stroke={accent} strokeWidth="2" />
      {/* Data points */}
      {data.map((d, i) => {
        const p = toXY(d.value, i);
        return <circle key={i} cx={p.x} cy={p.y} r="3" fill={accent} style={{ filter: `drop-shadow(${GLOW_SM} ${accent})` }} />;
      })}
      {/* Labels */}
      {showLabels && data.map((d, i) => {
        const p = toXY(1.15, i);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
            className="text-xs font-mono font-bold uppercase tracking-wider fill-[var(--text-muted)]"
          >
            {d.axis}
          </text>
        );
      })}
    </svg>
  );
}

/* ── LiveMetricGauge ─────────────────────────────────────────────────────── */

interface LiveMetricGaugeProps {
  metric: GaugeMetric;
  size?: number;
  accent?: string;
}

export function LiveMetricGauge({ metric, size = 88, accent }: LiveMetricGaugeProps) {
  const pct = Math.min(metric.current / metric.target, 1.5);
  const clamped = Math.min(pct, 1);
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const color = pct < 0.75 ? STATUS_SUCCESS : pct < 0.95 ? STATUS_WARNING : STATUS_ERROR;
  const finalColor = accent && pct < 0.75 ? accent : color;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_5)} strokeWidth="4" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={finalColor} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - clamped)}
            strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease-out', filter: `drop-shadow(${GLOW_SM} ${finalColor})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
          <span className="text-sm font-mono font-bold" style={{ color: finalColor }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-mono font-bold text-text-muted uppercase tracking-wider truncate max-w-[80px]">{metric.label}</div>
        <div className="text-sm font-mono text-text">
          {metric.current.toFixed(metric.unit === 'ms' || metric.unit === '%' ? 1 : 0)}
          <span className="text-text-muted text-xs">{metric.unit}</span>
        </div>
      </div>
    </div>
  );
}

/* ── NormalizedLineChart ──────────────────────────────────────────────────── */

interface NormalizedLineChartProps {
  /** Tailwind height class, e.g. "h-[260px]" — defaults to "h-[220px]" */
  height?: string;
  /** Show horizontal grid lines at 25 / 50 / 75 % */
  showGrid?: boolean;
  /** Grid stroke color — default OVERLAY_WHITE at OPACITY_6 */
  gridColor?: string;
  /** Y-axis labels rendered top→bottom on the left edge */
  yLabels?: string[];
  /** X-axis labels rendered left→right along the bottom edge */
  xLabels?: string[];
  /** Extra SVG <defs> (gradients, clip paths, etc.) */
  defs?: ReactNode;
  /** SVG child elements (polylines, paths, circles, etc.) */
  children: ReactNode;
  /** Extra content rendered *outside* the SVG but inside the container (legends, badges) */
  overlay?: ReactNode;
  /** Optional style override for the outer container */
  style?: CSSProperties;
}

export function NormalizedLineChart({
  height = 'h-[220px]',
  showGrid = true,
  gridColor = withOpacity(OVERLAY_WHITE, OPACITY_6),
  yLabels,
  xLabels,
  defs,
  children,
  overlay,
  style,
}: NormalizedLineChartProps) {
  return (
    <div className={`w-full ${height} bg-surface-deep/30 rounded-xl relative p-4 border border-border/40 min-h-[200px]`} style={style}>
      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        {defs}
        {showGrid && [25, 50, 75].map(pct => (
          <line key={pct} x1="0" y1={pct} x2="100" y2={pct} stroke={gridColor} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {children}
      </svg>

      {yLabels && yLabels.length > 0 && (
        <div className="absolute left-1 top-4 bottom-4 flex flex-col justify-between text-xs text-text-muted font-mono">
          {yLabels.map((label, i) => <span key={i}>{label}</span>)}
        </div>
      )}

      {xLabels && xLabels.length > 0 && (
        <div className="absolute left-4 right-4 bottom-0 flex justify-between text-xs text-text-muted font-mono">
          {xLabels.map((label, i) => <span key={i}>{label}</span>)}
        </div>
      )}

      {overlay}
    </div>
  );
}
