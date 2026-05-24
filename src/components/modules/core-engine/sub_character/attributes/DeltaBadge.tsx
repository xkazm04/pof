'use client';

import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_SUBDUED, OPACITY_5, OPACITY_12, withOpacity } from '@/lib/chart-colors';

/* ── Delta Badge ──────────────────────────────────────────────────────────── */

interface DeltaBadgeProps {
  current: number;
  optimal: number;
  label: string;
  unit: string;
  higherIsBetter?: boolean;
  delay?: number;
}

export function DeltaBadge({ current, optimal, label, unit, higherIsBetter = true, delay = 0 }: DeltaBadgeProps) {
  const delta = optimal - current;
  const isPositive = higherIsBetter ? delta > 0 : delta < 0;
  const isZero = Math.abs(delta) < 0.001;
  const color = isZero ? 'text-text-muted' : isPositive ? STATUS_SUCCESS : STATUS_ERROR;
  const sign = delta > 0 ? '+' : '';
  const displayDelta = unit === '%' ? (delta * 100).toFixed(1) : delta.toFixed(1);
  const displayCurrent = unit === '%' ? (current * 100).toFixed(1) : current.toFixed(1);
  const displayOptimal = unit === '%' ? (optimal * 100).toFixed(1) : optimal.toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center justify-between px-3 py-2 rounded-md border"
      style={{ borderColor: withOpacity(isZero ? STATUS_SUBDUED : isPositive ? STATUS_SUCCESS : STATUS_ERROR, OPACITY_12), backgroundColor: withOpacity(isZero ? STATUS_SUBDUED : isPositive ? STATUS_SUCCESS : STATUS_ERROR, OPACITY_5) }}
    >
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-text tabular-nums">{displayCurrent}{unit}</span>
        <ArrowRight className="w-3 h-3 text-text-muted" />
        <span className="text-xs font-mono font-bold text-text tabular-nums">{displayOptimal}{unit}</span>
        {!isZero && (
          <span className="text-xs font-mono font-bold tabular-nums" style={{ color }}>
            ({sign}{displayDelta}{unit})
          </span>
        )}
      </div>
    </motion.div>
  );
}
