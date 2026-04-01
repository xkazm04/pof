'use client';

import { TrendingUp, SlidersHorizontal, Camera } from 'lucide-react';
import { STATUS_INFO } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, MAX_LEVEL } from './data';
import { XpCurveChart } from './XpCurveChart';
import { CurveDeltaSummary } from './CurveDeltaSummary';

/* -- Main Chart Area (single view + compare split-pane) ------------------- */

interface MainChartAreaProps {
  chartData: { level: number; xp: number }[];
  maxXp: number;
  sharedMaxXp: number;
  compareMode: boolean;
  baseXp: number;
  curveExp: number;
  snapshotChartData: { level: number; xp: number }[];
  snapshotBaseXp: number;
  snapshotCurveExp: number;
}

export function MainChartArea({
  chartData, maxXp, sharedMaxXp,
  compareMode, baseXp, curveExp,
  snapshotChartData, snapshotBaseXp, snapshotCurveExp,
}: MainChartAreaProps) {
  return (
    <BlueprintPanel color={compareMode ? STATUS_INFO : ACCENT} className="lg:col-span-2 p-5">
      <div className="flex justify-between items-center mb-2.5">
        <SectionHeader
          label={compareMode ? 'Curve Comparison' : 'Required XP per Level Curve'}
          icon={TrendingUp}
          color={ACCENT}
        />
        <div className="text-xs font-mono uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border" style={{ color: ACCENT, backgroundColor: `${ACCENT}10`, borderColor: `${ACCENT}20` }}>
          Max Level: {MAX_LEVEL} | Max XP: {(compareMode ? sharedMaxXp : maxXp).toLocaleString()}
        </div>
      </div>

      {compareMode ? (
        <div>
          {/* Split-pane: Snapshot (left) vs Live (right) */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Camera className="w-3 h-3" style={{ color: STATUS_INFO }} />
                <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: STATUS_INFO }}>
                  Snapshot
                </span>
                <span className="text-xs font-mono text-text-muted">
                  Base {snapshotBaseXp} | Exp {snapshotCurveExp.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-[220px] bg-surface-deep/30 rounded-xl relative p-3 border border-border/40" style={{ borderColor: `${STATUS_INFO}30` }}>
                <XpCurveChart data={snapshotChartData} maxXp={sharedMaxXp} chartId="snapshot" color={STATUS_INFO} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <SlidersHorizontal className="w-3 h-3" style={{ color: ACCENT }} />
                <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: ACCENT }}>
                  Live
                </span>
                <span className="text-xs font-mono text-text-muted">
                  Base {baseXp} | Exp {curveExp.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-[220px] bg-surface-deep/30 rounded-xl relative p-3 border border-border/40" style={{ borderColor: `${ACCENT}30` }}>
                <XpCurveChart data={chartData} maxXp={sharedMaxXp} chartId="live" color={ACCENT} />
              </div>
            </div>
          </div>

          <CurveDeltaSummary
            snapshotData={snapshotChartData}
            liveData={chartData}
            snapshotBaseXp={snapshotBaseXp}
            snapshotCurveExp={snapshotCurveExp}
            liveBaseXp={baseXp}
            liveCurveExp={curveExp}
          />
        </div>
      ) : (
        <div className="w-full h-[280px] mt-2 bg-surface-deep/30 rounded-xl relative p-4 border border-border/40 min-h-[200px]">
          <XpCurveChart data={chartData} maxXp={maxXp} chartId="main" color={ACCENT} />
        </div>
      )}
    </BlueprintPanel>
  );
}
