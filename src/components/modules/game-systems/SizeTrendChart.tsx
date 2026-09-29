'use client';

import { useMemo } from 'react';
import type { SizeTrendPoint } from '@/lib/packaging/build-history-store';
import type { ComparePair, TrendPointState } from '@/lib/packaging/size-trend-model';
import { normalizePlatformId } from '@/lib/packaging/build-profiles';
import { MODULE_COLORS, STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import { formatBytes } from '@/lib/format';

/** A trend point, optionally judged by the size-trend model. */
type ChartPoint = SizeTrendPoint & { state?: TrendPointState; comparePair?: ComparePair | null };

interface SizeTrendChartProps {
  data: ChartPoint[];
  height?: number;
  accentColor?: string;
  title?: string;
  /** Draws the platform's absolute budget as a dashed line (and keeps it in the y-range). */
  budgetBytes?: number;
  /** Called with the (baseline, regressor) pair when a flagged point is activated. */
  onOpenPair?: (pair: ComparePair) => void;
}

const PADDING = { top: 20, right: 16, bottom: 28, left: 56 };

export function SizeTrendChart({
  data, height = 180, accentColor = MODULE_COLORS.systems, title = 'Package Size Trend', budgetBytes, onOpenPair,
}: SizeTrendChartProps) {
  const width = 400; // SVG viewBox width, scales responsively

  const { points, yTicks, xLabels, dotPoints, budgetY } = useMemo(() => {
    if (data.length === 0) return { points: '', yTicks: [], xLabels: [], dotPoints: [], budgetY: null };

    // The budget joins the y-domain so the line the gate judges against is always visible.
    const sizes = [...data.map((d) => d.sizeBytes), ...(budgetBytes && budgetBytes > 0 ? [budgetBytes] : [])];
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    const range = max - min || 1;
    const padded = { min: min - range * 0.1, max: max + range * 0.1 };

    const chartW = width - PADDING.left - PADDING.right;
    const chartH = height - PADDING.top - PADDING.bottom;

    const pts = data.map((d, i) => {
      const x = PADDING.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
      const y = PADDING.top + chartH - ((d.sizeBytes - padded.min) / (padded.max - padded.min)) * chartH;
      return { x, y, d };
    });

    const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');

    // Y-axis ticks (3-4 values)
    const tickCount = 4;
    const yT = Array.from({ length: tickCount }, (_, i) => {
      const val = padded.min + (i / (tickCount - 1)) * (padded.max - padded.min);
      const y = PADDING.top + chartH - (i / (tickCount - 1)) * chartH;
      return { y, label: formatBytes(Math.round(val)) };
    });

    // X-axis labels (first, middle, last)
    const xL: Array<{ x: number; label: string }> = [];
    const indices = data.length <= 3
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 2), data.length - 1];
    for (const idx of indices) {
      const p = pts[idx];
      const date = new Date(p.d.createdAt);
      xL.push({ x: p.x, label: `${date.getMonth() + 1}/${date.getDate()}` });
    }

    const bY = budgetBytes && budgetBytes > 0
      ? PADDING.top + chartH - ((budgetBytes - padded.min) / (padded.max - padded.min)) * chartH
      : null;

    return { points: polyline, yTicks: yT, xLabels: xL, dotPoints: pts, budgetY: bY };
  }, [data, height, budgetBytes]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-muted text-xs" style={{ height }}>
        No build size data yet
      </div>
    );
  }

  // Delta from first to last — only meaningful WITHIN one platform. Across interleaved
  // platforms (a Win64 build followed by an Android one) it read as a huge shrink.
  const singlePlatform = new Set(data.map((d) => normalizePlatformId(d.platform))).size === 1;
  const delta = singlePlatform && data.length >= 2 ? data[data.length - 1].sizeBytes - data[0].sizeBytes : 0;
  const deltaPercent = singlePlatform && data.length >= 2 && data[0].sizeBytes > 0
    ? ((delta / data[0].sizeBytes) * 100).toFixed(1)
    : null;

  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  // Gradient area points
  const areaPoints = `${PADDING.left},${PADDING.top + chartH} ${points} ${PADDING.left + chartW},${PADDING.top + chartH}`;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text">{title}</span>
        {deltaPercent !== null && (
          <span className={`text-xs font-mono ${delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-400' : 'text-text-muted'}`}>
            {delta > 0 ? '+' : ''}{deltaPercent}% ({formatBytes(Math.abs(delta))})
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="sizeTrendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={PADDING.left}
            y1={t.y}
            x2={width - PADDING.right}
            y2={t.y}
            stroke="var(--border)"
            strokeWidth="0.5"
          />
        ))}

        {/* Area fill */}
        {data.length > 1 && (
          <polygon points={areaPoints} fill="url(#sizeTrendGrad)" />
        )}

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Budget line */}
        {budgetY != null && budgetBytes != null && (
          <g data-testid="size-budget-line">
            <line x1={PADDING.left} y1={budgetY} x2={width - PADDING.right} y2={budgetY} stroke={STATUS_WARNING} strokeWidth="1" strokeDasharray="4 3" />
            <text x={width - PADDING.right} y={budgetY - 3} textAnchor="end" fill={STATUS_WARNING} fontSize="9" fontFamily="monospace">
              budget {formatBytes(budgetBytes)}
            </text>
          </g>
        )}

        {/* Data points — a flagged one is red and opens its comparison pair; a point
            with no baseline is hollow (growth was not evaluated). */}
        {dotPoints.map((p) => {
          const tip = `${formatBytes(p.d.sizeBytes)}${p.d.version ? ` (v${p.d.version})` : ''}\n${new Date(p.d.createdAt).toLocaleDateString()}`;
          const pair = p.d.comparePair;
          if (p.d.state === 'flagged') {
            const open = pair && onOpenPair ? () => onOpenPair(pair) : undefined;
            const label = `Build #${p.d.id} ${formatBytes(p.d.sizeBytes)} flagged${open && pair ? ` — compare with #${pair.left}` : ''}`;
            return (
              <g key={p.d.id}>
                <circle
                  cx={p.x} cy={p.y} r="4.5" fill={STATUS_ERROR}
                  role={open ? 'button' : 'img'} aria-label={label} tabIndex={open ? 0 : undefined}
                  className={open ? 'cursor-pointer' : undefined}
                  onClick={open}
                  onKeyDown={open ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : undefined}
                />
                <title>{`${tip}\n${label}`}</title>
              </g>
            );
          }
          const hollow = p.d.state === 'no-baseline';
          return (
            <g key={p.d.id}>
              <circle cx={p.x} cy={p.y} r="3" fill={hollow ? 'none' : accentColor} stroke={accentColor} strokeWidth={hollow ? 1.5 : 0} />
              <title>{hollow ? `${tip}\nno baseline in this window — growth not evaluated` : tip}</title>
            </g>
          );
        })}

        {/* Y-axis labels */}
        {yTicks.map((t, i) => (
          <text
            key={i}
            x={PADDING.left - 4}
            y={t.y + 3}
            textAnchor="end"
            className="fill-text-muted"
            fontSize="9"
            fontFamily="monospace"
          >
            {t.label}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={height - 4}
            textAnchor="middle"
            className="fill-text-muted"
            fontSize="9"
            fontFamily="monospace"
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
