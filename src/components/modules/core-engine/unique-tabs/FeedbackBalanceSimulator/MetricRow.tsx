'use client';

import { Heart } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, OPACITY_15 } from '@/lib/chart-colors';
import { formatMetricValue, formatDelta } from './types';

/* ── MetricCell ─ Single metric readout ──────────────────────────────── */

function MetricCell({ label, value, unit, icon: Icon, color, muted }: {
  label: string; value: number; unit?: string;
  icon: typeof Heart; color: string; muted?: boolean;
}) {
  const bg = muted ? 'var(--color-surface-deep)' : `${color}${OPACITY_15}`;
  const iconColor = muted ? 'var(--color-text-muted)' : color;
  const valueColor = muted ? 'var(--color-text)' : color;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2 rounded-md"
      style={{ backgroundColor: bg, opacity: muted ? 0.7 : 1 }}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: iconColor }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{label}</div>
        <span className="text-xs font-bold font-mono" style={{ color: valueColor }}>
          {formatMetricValue(value, unit)}
        </span>
      </div>
    </div>
  );
}

/* ── MetricRow ─ Side-by-side comparison with delta connector ──────── */

export function MetricRow({ label, feedbackOn, feedbackOff, unit, higherIsBetter, icon, color }: {
  label: string; feedbackOn: number; feedbackOff: number; unit?: string;
  higherIsBetter: boolean; icon: typeof Heart; color: string;
}) {
  const delta = feedbackOn - feedbackOff;
  const better = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = Math.abs(delta) < 0.01;
  const deltaColor = neutral ? 'var(--color-text-muted)' : better ? STATUS_SUCCESS : STATUS_ERROR;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0">
      <MetricCell label={label} value={feedbackOn} unit={unit} icon={icon} color={color} />
      {/* Connector line with delta */}
      <div className="flex items-center w-20 px-1">
        <div className="flex-1 h-px" style={{ backgroundColor: `${deltaColor}40` }} />
        <span
          className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ color: deltaColor, backgroundColor: `${deltaColor}15` }}
        >
          {neutral ? '=' : `${delta > 0 ? '+' : ''}${formatDelta(delta, unit)}`}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: `${deltaColor}40` }} />
      </div>
      <MetricCell label={label} value={feedbackOff} unit={unit} icon={icon} color={color} muted />
    </div>
  );
}
