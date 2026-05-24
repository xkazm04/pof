'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  ACCENT_EMERALD, ACCENT_CYAN,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_5, OPACITY_8, OPACITY_15, OPACITY_25, OPACITY_50,
  GLOW_SM,
  BORDER_DEFAULT,
  withOpacity,
} from '@/lib/chart-colors';
import { motionSafe, EASE_OUT } from '@/lib/motion';
import { BlueprintPanel } from '../../unique-tabs/_design';
import { ACCENT } from './constants';

/* ── Shimmer Skeleton ─ shown while sim is running ───────────────────── */

function SkeletonStat({ color, delay }: { color: string; delay: number }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionSafe({ duration: 0.22, ease: EASE_OUT, delay }, prefersReduced)}
      className="relative p-3 rounded-lg border overflow-hidden"
      style={{
        borderColor: withOpacity(color, BORDER_DEFAULT),
        backgroundColor: withOpacity(color, OPACITY_5),
      }}
    >
      <div
        className="h-2 w-12 rounded animate-pulse mb-2"
        style={{ backgroundColor: withOpacity(color, OPACITY_15) }}
      />
      <div
        className="h-5 w-16 rounded animate-pulse"
        style={{ backgroundColor: withOpacity(color, OPACITY_25) }}
      />
    </motion.div>
  );
}

function IndeterminateProgressBar({ color }: { color: string }) {
  const prefersReduced = useReducedMotion();
  return (
    <div
      className="w-full rounded-full overflow-hidden relative"
      style={{ height: 4, backgroundColor: withOpacity(color, OPACITY_8) }}
      role="progressbar"
      aria-label="Simulation running"
      aria-busy="true"
    >
      {prefersReduced ? (
        <div
          className="h-full rounded-full animate-pulse"
          style={{
            width: '40%',
            backgroundColor: color,
            boxShadow: `${GLOW_SM} ${withOpacity(color, OPACITY_50)}`,
          }}
        />
      ) : (
        <motion.div
          className="h-full rounded-full absolute top-0"
          style={{
            width: '40%',
            backgroundColor: color,
            boxShadow: `${GLOW_SM} ${withOpacity(color, OPACITY_50)}`,
          }}
          initial={{ x: '-100%' }}
          animate={{ x: '250%' }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

export function SimulationSkeleton() {
  return (
    <div className="space-y-3">
      <IndeterminateProgressBar color={ACCENT} />
      <div className="grid grid-cols-6 gap-2">
        <SkeletonStat color={ACCENT} delay={0} />
        <SkeletonStat color={ACCENT_EMERALD} delay={0.05} />
        <SkeletonStat color={ACCENT_CYAN} delay={0.1} />
        <SkeletonStat color={STATUS_SUCCESS} delay={0.15} />
        <SkeletonStat color={STATUS_WARNING} delay={0.2} />
        <SkeletonStat color={STATUS_ERROR} delay={0.25} />
      </div>
      <BlueprintPanel color={ACCENT} className="p-3 space-y-3">
        <div
          className="h-3 w-32 rounded animate-pulse"
          style={{ backgroundColor: withOpacity(ACCENT, OPACITY_15) }}
        />
        <div
          className="h-[200px] rounded-lg animate-pulse"
          style={{ backgroundColor: withOpacity(ACCENT, OPACITY_8) }}
        />
      </BlueprintPanel>
    </div>
  );
}
