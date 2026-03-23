'use client';

import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';

/* ── Hero Metric ─ Large centered stat with optional delta ─────────────── */

export function HeroMetric({ label, value, unit, icon: Icon, color, compareValue, lowerIsBetter }: {
  label: string;
  value: number;
  unit: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  compareValue?: number;
  lowerIsBetter?: boolean;
}) {
  const fmtVal = (v: number) => {
    if (!isFinite(v)) return '\u221E';
    if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(1)}k`;
    if (Math.abs(v) >= 100) return v.toFixed(0);
    return v.toFixed(1);
  };
  const delta = compareValue != null ? value - compareValue : undefined;
  const isGood = delta != null && delta !== 0
    ? (lowerIsBetter ? delta < 0 : delta > 0) : undefined;
  return (
    <div className="flex flex-col items-center p-3 rounded-xl border bg-surface-deep/50"
      style={{ borderColor: `${color}25` }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color, filter: `drop-shadow(0 0 4px ${color}80)` }} />
        <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color }}>{label}</span>
      </div>
      <span className="text-2xl font-mono font-black text-text leading-none"
        style={{ textShadow: `0 0 20px ${color}30` }}>
        {fmtVal(value)}
      </span>
      <span className="text-[10px] font-mono text-text-muted mt-0.5">{unit}</span>
      {delta != null && delta !== 0 && (
        <span className="text-xs font-mono font-bold mt-1" style={{ color: isGood ? STATUS_SUCCESS : STATUS_ERROR }}>
          {delta > 0 ? '+' : ''}{fmtVal(delta)}
        </span>
      )}
    </div>
  );
}

/* ── Sim Stat Line ─ Single-row stat with bar and optional delta ───────── */

export function SimStatLine({ label, value, formula, color, barPct, delta, lowerIsBetter }: {
  label: string;
  value: string;
  formula: string;
  color: string;
  barPct: number;
  delta?: { display: string; raw: number };
  lowerIsBetter?: boolean;
}) {
  const isGood = delta ? (lowerIsBetter ? delta.raw < 0 : delta.raw > 0) : undefined;
  return (
    <div className="px-2 py-1 rounded-md hover:bg-surface/40 transition-colors" title={formula}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{label}</span>
        <div className="flex items-center gap-1.5">
          {delta && delta.raw !== 0 && (
            <span className="text-xs font-mono font-bold" style={{ color: isGood ? STATUS_SUCCESS : STATUS_ERROR }}>
              {delta.raw > 0 ? '+' : ''}{delta.display}
            </span>
          )}
          <span className="text-xs font-mono font-bold text-text" style={{ textShadow: `0 0 12px ${color}40` }}>{value}</span>
        </div>
      </div>
      <div className="relative h-1.5 bg-surface-deep rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.max(barPct, 0), 100)}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
