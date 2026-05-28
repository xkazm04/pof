'use client';

import { useMemo } from 'react';
import type { DurationTrendPoint } from '@/lib/ue5-bridge/build-health';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_NEUTRAL, STATUS_WARNING,
} from '@/lib/chart-colors';

interface BuildDurationTrendChartProps {
  data: DurationTrendPoint[];
  /** Optional rolling/average baseline drawn as a dashed reference line. */
  baselineMs?: number | null;
  height?: number;
}

const PADDING = { top: 16, right: 16, bottom: 26, left: 52 };
const ACCENT = MODULE_COLORS.systems;

function fmtSeconds(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function statusColor(status: DurationTrendPoint['status']): string {
  if (status === 'success') return STATUS_SUCCESS;
  if (status === 'failed') return STATUS_ERROR;
  if (status === 'aborted') return STATUS_WARNING;
  return STATUS_NEUTRAL;
}

/**
 * Compact SVG line chart of build duration over time. Each point is tinted by
 * its build status; an optional dashed baseline marks the average so spikes
 * read at a glance.
 */
export function BuildDurationTrendChart({ data, baselineMs, height = 180 }: BuildDurationTrendChartProps) {
  const width = 400;

  const view = useMemo(() => {
    if (data.length === 0) return null;

    const durations = data.map((d) => d.durationMs);
    const min = Math.min(...durations, baselineMs ?? Infinity);
    const max = Math.max(...durations, baselineMs ?? -Infinity);
    const range = max - min || 1;
    const padded = { min: Math.max(0, min - range * 0.1), max: max + range * 0.1 };

    const chartW = width - PADDING.left - PADDING.right;
    const chartH = height - PADDING.top - PADDING.bottom;

    const yFor = (v: number) =>
      PADDING.top + chartH - ((v - padded.min) / (padded.max - padded.min)) * chartH;

    const pts = data.map((d, i) => ({
      x: PADDING.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
      y: yFor(d.durationMs),
      d,
    }));

    const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');

    const tickCount = 4;
    const yTicks = Array.from({ length: tickCount }, (_, i) => {
      const val = padded.min + (i / (tickCount - 1)) * (padded.max - padded.min);
      return { y: PADDING.top + chartH - (i / (tickCount - 1)) * chartH, label: fmtSeconds(Math.round(val)) };
    });

    const labelIdx = data.length <= 3 ? data.map((_, i) => i) : [0, Math.floor(data.length / 2), data.length - 1];
    const xLabels = labelIdx.map((idx) => {
      const date = new Date(pts[idx].d.createdAt);
      return { x: pts[idx].x, label: `${date.getMonth() + 1}/${date.getDate()}` };
    });

    const baselineY = baselineMs != null ? yFor(baselineMs) : null;

    return { pts, polyline, yTicks, xLabels, baselineY };
  }, [data, baselineMs, height]);

  if (!view) {
    return (
      <div className="flex items-center justify-center text-text-muted text-xs" style={{ height }}>
        No build duration data yet
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Build duration trend">
      {/* Grid lines */}
      {view.yTicks.map((t, i) => (
        <line key={i} x1={PADDING.left} y1={t.y} x2={width - PADDING.right} y2={t.y} stroke="var(--border)" strokeWidth="0.5" />
      ))}

      {/* Baseline reference */}
      {view.baselineY != null && (
        <line
          x1={PADDING.left}
          y1={view.baselineY}
          x2={width - PADDING.right}
          y2={view.baselineY}
          stroke={ACCENT}
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.5"
        />
      )}

      {/* Line */}
      {data.length > 1 && (
        <polyline points={view.polyline} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Status-tinted points */}
      {view.pts.map((p) => (
        <g key={p.d.buildId}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={statusColor(p.d.status)} stroke="var(--background)" strokeWidth="1" />
          <title>{`${fmtSeconds(p.d.durationMs)} · ${p.d.status}${p.d.errorCount > 0 ? ` · ${p.d.errorCount} err` : ''}\n${new Date(p.d.createdAt).toLocaleString()}`}</title>
        </g>
      ))}

      {/* Y-axis labels */}
      {view.yTicks.map((t, i) => (
        <text key={i} x={PADDING.left - 4} y={t.y + 3} textAnchor="end" className="fill-text-muted" fontSize="9" fontFamily="monospace">
          {t.label}
        </text>
      ))}

      {/* X-axis labels */}
      {view.xLabels.map((l, i) => (
        <text key={i} x={l.x} y={height - 4} textAnchor="middle" className="fill-text-muted" fontSize="9" fontFamily="monospace">
          {l.label}
        </text>
      ))}
    </svg>
  );
}
