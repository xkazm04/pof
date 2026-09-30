'use client';

import { motion } from 'framer-motion';
import { MOTION } from '@/lib/constants';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO, ACCENT_VIOLET } from '@/lib/chart-colors';
import type { HealthBreakdown } from '@/lib/evaluator/combined-health';
import { LIFT_DIMENSION_LABELS, type HealthLift } from '@/lib/evaluator/health-lifts';
import { healthColor, healthBg } from './helpers';

export function ModuleHealthCell({
  label,
  breakdown,
  index,
  topLift,
  selected,
  onSelect,
}: {
  label: string;
  breakdown: HealthBreakdown;
  index: number;
  /** The module's biggest lift (its first-ranked remedy), if it is losing points. */
  topLift: HealthLift | undefined;
  /** This cell's lift plan is open. */
  selected: boolean;
  onSelect: () => void;
}) {
  const color = healthColor(breakdown.combined);
  const bg = healthBg(breakdown.combined);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      aria-label={`${label} health ${breakdown.combined} — ${selected ? 'hide' : 'show'} lift plan`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: MOTION.base, delay: index * 0.03 }}
      className={`w-full text-left rounded-lg border p-3 transition-colors hover:border-border-bright focus-ring ${selected ? 'border-border-bright' : 'border-border/60'}`}
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

      {topLift && (
        <p className="mt-2 text-2xs text-text-muted truncate">
          {LIFT_DIMENSION_LABELS[topLift.dimension]} <span className="font-semibold text-text">+{topLift.moduleGain}</span>
        </p>
      )}
    </motion.button>
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
