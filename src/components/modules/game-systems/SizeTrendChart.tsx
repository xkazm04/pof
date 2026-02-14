'use client';

import { useMemo } from 'react';
import type { SizeTrendPoint } from '@/lib/packaging/build-history-store';

interface SizeTrendChartProps {
  data: SizeTrendPoint[];
  height?: number;
  accentColor?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const PADDING = { top: 20, right: 16, bottom: 28, left: 56 };

export function SizeTrendChart({ data, height = 180, accentColor = '#8b5cf6' }: SizeTrendChartProps) {
  const width = 400; // SVG viewBox width, scales responsively

  const { points, yTicks, xLabels, minVal, maxVal } = useMemo(() => {
    if (data.length === 0) return { points: '', yTicks: [], xLabels: [], minVal: 0, maxVal: 0 };

    const sizes = data.map((d) => d.sizeBytes);
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

    return { points: polyline, yTicks: yT, xLabels: xL, minVal: min, maxVal: max };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-muted text-xs" style={{ height }}>
        No build size data yet
      </div>
    );
  }

  // Compute delta from first to last
  const delta = data.length >= 2 ? data[data.length - 1].sizeBytes - data[0].sizeBytes : 0;
  const deltaPercent = data.length >= 2 && data[0].sizeBytes > 0
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
        <span className="text-xs font-medium text-text">Package Size Trend</span>
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

        {/* Data points */}
        {useMemo(() => {
          const sizes = data.map((d) => d.sizeBytes);
          const min = Math.min(...sizes);
          const max = Math.max(...sizes);
          const range = max - min || 1;
          const padded = { min: min - range * 0.1, max: max + range * 0.1 };
          return data.map((d, i) => {
            const x = PADDING.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
            const y = PADDING.top + chartH - ((d.sizeBytes - padded.min) / (padded.max - padded.min)) * chartH;
            return (
              <g key={d.id}>
                <circle cx={x} cy={y} r="3" fill={accentColor} />
                <title>{`${formatBytes(d.sizeBytes)}${d.version ? ` (v${d.version})` : ''}\n${new Date(d.createdAt).toLocaleDateString()}`}</title>
              </g>
            );
          });
        }, [data, accentColor, chartW, chartH])}

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
