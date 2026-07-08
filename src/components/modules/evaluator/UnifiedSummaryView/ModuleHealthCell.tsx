'use client';

import { motion } from 'framer-motion';
import { MOTION } from '@/lib/constants';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO, ACCENT_VIOLET } from '@/lib/chart-colors';
import type { HealthBreakdown } from '@/lib/evaluator/combined-health';
import { healthColor, healthBg } from './helpers';

export function ModuleHealthCell({
  label,
  breakdown,
  index,
  correlation,
}: {
  label: string;
  breakdown: HealthBreakdown;
  index: number;
  correlation: import('@/lib/evaluator/correlation-engine').ModuleCorrelation | undefined;
}) {
  const color = healthColor(breakdown.combined);
  const bg = healthBg(breakdown.combined);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: MOTION.base, delay: index * 0.03 }}
      className="rounded-lg border border-border/60 p-3 transition-colors hover:border-border-bright"
      style={{ backgroundColor: bg }}
    >
      {/* Module name + score */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text truncate pr-2">
          {label}
        </span>
        <span
          className="text-xs font-bold flex-shrink-0"
          style={{ color }}
        >
          {breakdown.combined}
        </span>
      </div>

      {/* Mini dimension bars */}
      <div className="space-y-1">
        <MiniBar value={breakdown.quality} color={STATUS_ERROR} label="Q" />
        <MiniBar value={breakdown.dependencyHealth} color={STATUS_INFO} label="D" />
        <MiniBar value={breakdown.coverage} color={STATUS_SUCCESS} label="C" />
        <MiniBar value={breakdown.activity} color={ACCENT_VIOLET} label="A" />
      </div>
    </motion.div>
  );
}

function MiniBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs text-text-muted w-2 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-background/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-slow"
          style={{ width: `${value}%`, backgroundColor: color, opacity: 0.7 }}
        />
      </div>
    </div>
  );
}
