'use client';

import { useMemo } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_INFO, STATUS_ERROR, STATUS_SUCCESS,
  withOpacity, OPACITY_10,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT, MAX_LEVEL } from '../_shared/data';
import { curveDelta } from '@/components/modules/core-engine/sub_progression/_shared/curveModel';
import { DEFAULT_RATE } from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';

/* -- Curve Delta Summary -------------------------------------------------- */

interface CurveDeltaSummaryProps {
  snapshotBaseXp: number;
  snapshotCurveExp: number;
  liveBaseXp: number;
  liveCurveExp: number;
}

/**
 * Snapshot-vs-live comparison. Every figure comes from the one curve model
 * (curveModel.ts): totals are the export's XPTotal at the cap, time to max is
 * the Rewards-tab clock.
 */
export function CurveDeltaSummary({
  snapshotBaseXp, snapshotCurveExp,
  liveBaseXp, liveCurveExp,
}: CurveDeltaSummaryProps) {
  const delta = useMemo(
    () => curveDelta({ baseXp: snapshotBaseXp, curveExp: snapshotCurveExp }, { baseXp: liveBaseXp, curveExp: liveCurveExp }),
    [snapshotBaseXp, snapshotCurveExp, liveBaseXp, liveCurveExp],
  );
  const deltas = delta.rows;
  const snapTotalXp = delta.snapshot.totalXp;
  const liveTotalXp = delta.live.totalXp;
  const totalDiff = liveTotalXp - snapTotalXp;
  const totalPct = delta.totalPct;
  const snapHours = delta.snapshot.hoursToMax;
  const liveHours = delta.live.hoursToMax;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 relative z-10"
    >
      <BlueprintPanel color={STATUS_INFO} className="p-3">
        <SectionHeader label="Delta Summary" icon={GitCompareArrows} color={STATUS_INFO} />

        {/* Per-level comparison table */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {deltas.map((d) => (
            <div key={d.level} className="bg-surface/40 rounded-lg p-2 border border-border/30 text-center">
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Lv {d.level}</div>
              <div className="text-xs font-mono" style={{ color: STATUS_INFO }}>{d.snapXp.toLocaleString()}</div>
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">vs</div>
              <div className="text-xs font-mono" style={{ color: ACCENT }}>{d.liveXp.toLocaleString()}</div>
              <div
                className="text-xs font-mono font-bold mt-1 px-1.5 py-0.5 rounded-full"
                style={{
                  color: d.diff > 0 ? STATUS_ERROR : d.diff < 0 ? STATUS_SUCCESS : 'var(--text-muted)',
                  backgroundColor: d.diff > 0 ? `${withOpacity(STATUS_ERROR, OPACITY_10)}` : d.diff < 0 ? `${withOpacity(STATUS_SUCCESS, OPACITY_10)}` : 'transparent',
                }}
              >
                {d.diff > 0 ? '+' : ''}{d.pct.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>

        {/* Summary stats row */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-surface/30 rounded-lg p-2 border border-border/30">
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-0.5">Total XP to L{MAX_LEVEL}</div>
            <div className="flex justify-between items-center">
              <span className="font-mono" style={{ color: STATUS_INFO }}>{snapTotalXp.toLocaleString()}</span>
              <span className="font-mono" style={{ color: ACCENT }}>{liveTotalXp.toLocaleString()}</span>
            </div>
            <div className="text-xs font-mono font-bold mt-0.5" style={{ color: totalDiff > 0 ? STATUS_ERROR : totalDiff < 0 ? STATUS_SUCCESS : 'var(--text-muted)' }}>
              {totalDiff > 0 ? '+' : ''}{totalPct.toFixed(0)}%
            </div>
          </div>
          <div className="bg-surface/30 rounded-lg p-2 border border-border/30">
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-0.5">Time to max (h)</div>
            <div className="flex justify-between items-center">
              <span className="font-mono" style={{ color: STATUS_INFO }}>{snapHours.toFixed(2)}h</span>
              <span className="font-mono" style={{ color: ACCENT }}>{liveHours.toFixed(2)}h</span>
            </div>
            <div className="text-xs font-mono font-bold mt-0.5" style={{ color: delta.hoursDiff > 0 ? STATUS_ERROR : delta.hoursDiff < 0 ? STATUS_SUCCESS : 'var(--text-muted)' }}>
              {delta.hoursDiff > 0 ? '+' : ''}{delta.hoursDiff.toFixed(2)}h
            </div>
          </div>
          <div className="bg-surface/30 rounded-lg p-2 border border-border/30">
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-0.5">Param Changes</div>
            <div className="text-xs font-mono">
              <span className="text-text-muted">Base: </span>
              <span style={{ color: STATUS_INFO }}>{snapshotBaseXp}</span>
              <span className="text-text-muted"> {'->'} </span>
              <span style={{ color: ACCENT }}>{liveBaseXp}</span>
            </div>
            <div className="text-xs font-mono">
              <span className="text-text-muted">Exp: </span>
              <span style={{ color: STATUS_INFO }}>{snapshotCurveExp.toFixed(2)}</span>
              <span className="text-text-muted"> {'->'} </span>
              <span style={{ color: ACCENT }}>{liveCurveExp.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <p data-testid="delta-rate-basis" className="mt-2 text-2xs font-mono text-text-muted">
          Totals = XPTotal at L{MAX_LEVEL} in the exported XP table. Time on the Rewards-tab clock: {DEFAULT_RATE.xpPerMinAtL1} XP/min at L1 x L^{DEFAULT_RATE.rateGrowth}.
        </p>
      </BlueprintPanel>
    </motion.div>
  );
}
