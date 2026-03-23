'use client';

import { useMemo } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_INFO, STATUS_ERROR, STATUS_SUCCESS } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, MAX_LEVEL, calculateXpForLevel, COMPARISON_LEVELS } from './data';

/* -- Curve Delta Summary -------------------------------------------------- */

interface CurveDeltaSummaryProps {
  snapshotData: { level: number; xp: number }[];
  liveData: { level: number; xp: number }[];
  snapshotBaseXp: number;
  snapshotCurveExp: number;
  liveBaseXp: number;
  liveCurveExp: number;
}

export function CurveDeltaSummary({
  snapshotData, liveData,
  snapshotBaseXp, snapshotCurveExp,
  liveBaseXp, liveCurveExp,
}: CurveDeltaSummaryProps) {
  const deltas = useMemo(() => {
    return COMPARISON_LEVELS.map((lvl) => {
      const snapXp = calculateXpForLevel(lvl, snapshotBaseXp, snapshotCurveExp);
      const liveXp = calculateXpForLevel(lvl, liveBaseXp, liveCurveExp);
      const diff = liveXp - snapXp;
      const pct = snapXp > 0 ? ((diff / snapXp) * 100) : 0;
      return { level: lvl, snapXp, liveXp, diff, pct };
    });
  }, [snapshotBaseXp, snapshotCurveExp, liveBaseXp, liveCurveExp]);

  const snapTotalXp = snapshotData.reduce((s, d) => s + d.xp, 0);
  const liveTotalXp = liveData.reduce((s, d) => s + d.xp, 0);
  const totalDiff = liveTotalXp - snapTotalXp;
  const totalPct = snapTotalXp > 0 ? ((totalDiff / snapTotalXp) * 100) : 0;

  const XP_PER_MIN = 1000;
  const snapTimeMax = calculateXpForLevel(MAX_LEVEL, snapshotBaseXp, snapshotCurveExp) / XP_PER_MIN;
  const liveTimeMax = calculateXpForLevel(MAX_LEVEL, liveBaseXp, liveCurveExp) / XP_PER_MIN;

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
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Lv {d.level}</div>
              <div className="text-xs font-mono" style={{ color: STATUS_INFO }}>{d.snapXp.toLocaleString()}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">vs</div>
              <div className="text-xs font-mono" style={{ color: ACCENT }}>{d.liveXp.toLocaleString()}</div>
              <div
                className="text-[10px] font-mono font-bold mt-1 px-1.5 py-0.5 rounded-full"
                style={{
                  color: d.diff > 0 ? STATUS_ERROR : d.diff < 0 ? STATUS_SUCCESS : 'var(--text-muted)',
                  backgroundColor: d.diff > 0 ? `${STATUS_ERROR}15` : d.diff < 0 ? `${STATUS_SUCCESS}15` : 'transparent',
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
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-0.5">Total XP (sampled)</div>
            <div className="flex justify-between items-center">
              <span className="font-mono" style={{ color: STATUS_INFO }}>{snapTotalXp.toLocaleString()}</span>
              <span className="font-mono" style={{ color: ACCENT }}>{liveTotalXp.toLocaleString()}</span>
            </div>
            <div className="text-[10px] font-mono font-bold mt-0.5" style={{ color: totalDiff > 0 ? STATUS_ERROR : totalDiff < 0 ? STATUS_SUCCESS : 'var(--text-muted)' }}>
              {totalDiff > 0 ? '+' : ''}{totalPct.toFixed(0)}%
            </div>
          </div>
          <div className="bg-surface/30 rounded-lg p-2 border border-border/30">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-0.5">Time to Max (est.)</div>
            <div className="flex justify-between items-center">
              <span className="font-mono" style={{ color: STATUS_INFO }}>{snapTimeMax.toFixed(0)}m</span>
              <span className="font-mono" style={{ color: ACCENT }}>{liveTimeMax.toFixed(0)}m</span>
            </div>
            <div className="text-[10px] font-mono font-bold mt-0.5" style={{ color: liveTimeMax > snapTimeMax ? STATUS_ERROR : STATUS_SUCCESS }}>
              {liveTimeMax > snapTimeMax ? '+' : ''}{(liveTimeMax - snapTimeMax).toFixed(0)}m
            </div>
          </div>
          <div className="bg-surface/30 rounded-lg p-2 border border-border/30">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-0.5">Param Changes</div>
            <div className="text-[10px] font-mono">
              <span className="text-text-muted">Base: </span>
              <span style={{ color: STATUS_INFO }}>{snapshotBaseXp}</span>
              <span className="text-text-muted"> {'->'} </span>
              <span style={{ color: ACCENT }}>{liveBaseXp}</span>
            </div>
            <div className="text-[10px] font-mono">
              <span className="text-text-muted">Exp: </span>
              <span style={{ color: STATUS_INFO }}>{snapshotCurveExp.toFixed(2)}</span>
              <span className="text-text-muted"> {'->'} </span>
              <span style={{ color: ACCENT }}>{liveCurveExp.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
