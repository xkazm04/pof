'use client';

import { Bug, TrendingDown, Shield, AlertOctagon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_BLOCKER,
  OPACITY_12,
} from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface DirectorRegressionPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

const STATS = { tracked: 42, open: 8, regressed: 3, fixed: 28, regressionRate: 0.12 };

const CHRONIC_ISSUES = [
  { title: 'Hit registration desync', regressions: 4, status: 'regressed' as const, severity: 'critical' as const },
  { title: 'Camera snap on dodge', regressions: 3, status: 'open' as const, severity: 'high' as const },
  { title: 'Inventory duplication', regressions: 2, status: 'fixed' as const, severity: 'high' as const },
] as const;

const STATUS_COLORS: Record<string, string> = {
  open: STATUS_BLOCKER,
  fixed: STATUS_SUCCESS,
  regressed: STATUS_ERROR,
  resolved: STATUS_SUCCESS,
};

/* ── Micro density ──────────────────────────────────────────────────────── */

function RegressionMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Bug className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{STATS.regressed} regressed</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function RegressionCompact() {
  const ratePercent = Math.round(STATS.regressionRate * 100);
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-text-muted">Regression Rate</span>
        <span className="font-mono font-bold" style={{ color: ratePercent > 20 ? STATUS_ERROR : ratePercent > 10 ? STATUS_WARNING : STATUS_SUCCESS }}>
          {ratePercent}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-text-muted">Tracked</span>
        <span className="font-mono text-text">{STATS.tracked}</span>
        <span className="text-text-muted ml-auto">Open</span>
        <span className="font-mono" style={{ color: STATUS_BLOCKER }}>{STATS.open}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-text-muted">Fixed</span>
        <span className="font-mono" style={{ color: STATUS_SUCCESS }}>{STATS.fixed}</span>
        <span className="text-text-muted ml-auto">Regressed</span>
        <span className="font-mono" style={{ color: STATUS_ERROR }}>{STATS.regressed}</span>
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function RegressionFull() {
  const ratePercent = Math.round(STATS.regressionRate * 100);

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Regression tracker monitoring bug recurrence across playtest sessions with trend analysis and chronic issue identification.
      </SurfaceCard>

      {/* Stats grid */}
      <div className={`grid grid-cols-4 ${DZIN_SPACING.full.gap}`}>
        <MiniStat label="Tracked" value={STATS.tracked} color={ACCENT} />
        <MiniStat label="Open" value={STATS.open} color={STATUS_BLOCKER} />
        <MiniStat label="Regressed" value={STATS.regressed} color={STATUS_ERROR} />
        <MiniStat label="Fixed" value={STATS.fixed} color={STATUS_SUCCESS} />
      </div>

      {/* Regression rate */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel icon={TrendingDown} label="Regression Rate" color={ACCENT} />
          <span className="text-xs font-bold" style={{ color: ratePercent > 20 ? STATUS_ERROR : ratePercent > 10 ? STATUS_WARNING : STATUS_SUCCESS }}>
            {ratePercent}%
          </span>
        </div>
        <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(ratePercent, 100)}%` }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="h-full rounded-full"
            style={{ backgroundColor: ratePercent > 20 ? STATUS_ERROR : ratePercent > 10 ? STATUS_WARNING : STATUS_SUCCESS }}
          />
        </div>
      </SurfaceCard>

      {/* Chronic issues */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Shield} label="Chronic Regressions" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {CHRONIC_ISSUES.map((issue, i) => (
            <motion.div
              key={issue.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: i * 0.06 }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background text-xs"
            >
              {issue.severity === 'critical' ? (
                <AlertOctagon className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} />
              ) : (
                <Bug className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_BLOCKER }} />
              )}
              <span className="text-text flex-1 truncate">{issue.title}</span>
              <span
                className="text-2xs font-mono px-1.5 py-0.5 rounded"
                style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_12}` }}
              >
                {issue.regressions}x
              </span>
              <span
                className="text-2xs font-medium px-1.5 py-0.5 rounded capitalize"
                style={{ color: STATUS_COLORS[issue.status], backgroundColor: `${STATUS_COLORS[issue.status]}${OPACITY_12}` }}
              >
                {issue.status}
              </span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <SurfaceCard level={2} className="p-2.5 text-center">
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-2xs text-text-muted">{label}</div>
    </SurfaceCard>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DirectorRegressionPanel({ featureMap, defs }: DirectorRegressionPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Regression Tracker" icon={<Bug className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <RegressionMicro />}
          {density === 'compact' && <RegressionCompact />}
          {density === 'full' && <RegressionFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
