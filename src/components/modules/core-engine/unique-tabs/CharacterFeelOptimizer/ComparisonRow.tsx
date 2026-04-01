'use client';

import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { FEEL_FIELD_META, type FeelComparison } from '@/lib/character-feel-optimizer';
import { NeonBar } from '../_design';

/* ── Comparison Row ──────────────────────────────────────────────────────── */

function fmtValue(v: number, unit?: string): string {
  if (unit === '%') return `${(v * 100).toFixed(0)}%`;
  if (unit === 'x' || unit === 's') return v.toFixed(2);
  if (v % 1 !== 0) return v.toFixed(1);
  return String(v);
}

export function ComparisonRow({ item, colorA, colorB }: {
  item: FeelComparison;
  colorA: string;
  colorB: string;
}) {
  const meta = FEEL_FIELD_META.find((f) => f.key === item.field);
  const range = meta ? meta.max - meta.min : 1;
  const barA = meta ? Math.min(((item.valueA - meta.min) / range) * 100, 100) : 50;
  const barB = meta ? Math.min(((item.valueB - meta.min) / range) * 100, 100) : 50;

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface/20 transition-colors text-xs font-mono">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-28 truncate flex-shrink-0">
        {item.label}
      </span>
      <div className="flex-1 flex items-center gap-1">
        <span className="w-12 text-right font-bold" style={{ color: colorA }}>
          {fmtValue(item.valueA, item.unit)}
        </span>
        <div className="flex-1 relative h-3">
          <div className="absolute inset-0 bg-surface-deep rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full rounded-full opacity-60"
              style={{ width: `${barA}%`, backgroundColor: colorA }}
            />
          </div>
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full rounded-full opacity-30 border-r-2"
              style={{ width: `${barB}%`, borderColor: colorB, backgroundColor: `${colorB}30` }}
            />
          </div>
        </div>
        <span className="w-12 font-bold" style={{ color: colorB }}>
          {fmtValue(item.valueB, item.unit)}
        </span>
      </div>
      <span className="w-14 text-right flex-shrink-0" style={{
        color: item.delta > 0 ? STATUS_SUCCESS : item.delta < 0 ? STATUS_ERROR : 'var(--text-muted)',
      }}>
        {item.delta > 0 ? '+' : ''}{fmtValue(item.delta, item.unit)}
      </span>
    </div>
  );
}
