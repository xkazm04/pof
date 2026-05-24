'use client';

import { STATUS_SUCCESS, STATUS_ERROR, OPACITY_15, withOpacity } from '@/lib/chart-colors';
import type { MiniViz } from './types';

/* ── MiniVizSvg ─ Tiny inline visualisation (donut / bar / gauge) ──── */

function MiniVizSvg({ viz, color }: { viz: MiniViz; color: string }) {
  const S = 28;

  if (viz.type === 'donut') {
    const r = 10, cx = S / 2, cy = S / 2;
    const circumference = 2 * Math.PI * r;
    const filled = Math.min(1, Math.max(0, viz.ratio)) * circumference;
    return (
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`${withOpacity(color, OPACITY_15)}`} strokeWidth={3} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (viz.type === 'bar') {
    const barW = 20, barH = 6, x0 = (S - barW) / 2, y0 = (S - barH) / 2;
    const filled = Math.min(1, Math.max(0, viz.ratio)) * barW;
    return (
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="flex-shrink-0">
        <rect x={x0} y={y0} width={barW} height={barH} rx={2} fill={`${withOpacity(color, OPACITY_15)}`} />
        <rect x={x0} y={y0} width={filled} height={barH} rx={2} fill={color} />
      </svg>
    );
  }

  // gauge
  const trackW = 22, trackH = 4, x0 = (S - trackW) / 2, y0 = S / 2 - trackH / 2;
  const clamped = Math.min(1, Math.max(0, viz.ratio));
  const markerX = x0 + clamped * trackW;
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="flex-shrink-0">
      <rect x={x0} y={y0} width={trackW} height={trackH} rx={2} fill={`${withOpacity(color, OPACITY_15)}`} />
      <rect x={x0} y={y0} width={clamped * trackW} height={trackH} rx={2} fill={color} />
      <line x1={markerX} y1={y0 - 2} x2={markerX} y2={y0 + trackH + 2}
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

/* ── FeedbackMetric ─ Compact metric tile with mini-viz ────────────── */

export function FeedbackMetric({ label, value, unit, color, description, viz }: {
  label: string; value: string; unit: string; color: string; description: string; viz?: MiniViz;
}) {
  return (
    <div
      className="flex flex-col items-center px-2 py-2 rounded-md text-center"
      style={{ backgroundColor: `${color}${OPACITY_15}` }}
    >
      <div className="flex items-center gap-1.5">
        {viz && <MiniVizSvg viz={viz} color={color} />}
        <span className="text-xs font-bold font-mono" style={{ color }}>
          {value}<span className="text-xs font-mono uppercase tracking-[0.15em]">{unit}</span>
        </span>
      </div>
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-0.5">{label}</span>
      <span className="text-xs font-mono text-text-muted opacity-60 mt-0.5">{description}</span>
    </div>
  );
}

/* ── DeltaBadge ─ Signed delta readout ───────────────────────────────── */

export function DeltaBadge({ label, delta, unit, isPercent, higherIsBetter }: {
  label: string; delta: number; unit?: string; isPercent?: boolean; higherIsBetter: boolean;
}) {
  const better = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = Math.abs(delta) < 0.01;
  const color = neutral ? 'var(--color-text-muted)' : better ? STATUS_SUCCESS : STATUS_ERROR;
  const displayValue = isPercent ? `${(delta * 100).toFixed(1)}%` : `${delta.toFixed(1)}${unit ?? ''}`;

  return (
    <div
      className="flex flex-col items-center px-2 py-1.5 rounded-md text-center"
      style={{ backgroundColor: `${neutral ? 'var(--color-border)' : color}${OPACITY_15}` }}
    >
      <span className="text-xs font-bold font-mono" style={{ color }}>
        {delta > 0 ? '+' : ''}{displayValue}
      </span>
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{label}</span>
    </div>
  );
}
