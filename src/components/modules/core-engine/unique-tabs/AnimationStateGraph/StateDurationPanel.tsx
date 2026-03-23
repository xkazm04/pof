'use client';

import { STATUS_WARNING } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, STATE_DURATIONS, DURATION_SCALE_MAX } from './data';

export function StateDurationPanel() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="State Duration Statistics" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Box-and-whisker distribution of time spent in each animation state (seconds).
      </p>
      <div className="space-y-3">
        {STATE_DURATIONS.map((d) => {
          if (d.isInfinite) {
            return (
              <div key={d.state} className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-text-muted w-20">{d.state}</span>
                <div className="flex-1 h-6 rounded bg-surface-deep flex items-center justify-center">
                  <span className="text-xs font-mono text-text-muted italic">--- terminal state ---</span>
                </div>
              </div>
            );
          }
          const toPercent = (v: number) => Math.min((v / DURATION_SCALE_MAX) * 100, 100);
          const whiskerLeft = toPercent(d.min);
          const boxLeft = toPercent(d.q1);
          const medianPos = toPercent(d.median);
          const boxRight = toPercent(d.q3);
          const whiskerRight = toPercent(d.max);
          return (
            <div key={d.state} className="flex items-center gap-3">
              <span className={`text-xs font-mono font-bold w-20 ${d.hasOutlier ? 'text-amber-400' : 'text-text-muted'}`}>{d.state}</span>
              <div className="flex-1 relative h-6 rounded bg-surface-deep">
                {/* Whisker line */}
                <div
                  className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-text-muted/30"
                  style={{ left: `${whiskerLeft}%`, width: `${whiskerRight - whiskerLeft}%` }}
                />
                {/* Min/max caps */}
                <div className="absolute top-1 w-[2px] h-4 bg-text-muted/40" style={{ left: `${whiskerLeft}%` }} />
                <div className="absolute top-1 w-[2px] h-4 bg-text-muted/40" style={{ left: `${whiskerRight}%` }} />
                {/* Box (Q1 to Q3) */}
                <div
                  className="absolute top-0.5 h-5 rounded-sm"
                  style={{
                    left: `${boxLeft}%`,
                    width: `${boxRight - boxLeft}%`,
                    backgroundColor: d.hasOutlier ? `${STATUS_WARNING}30` : `${ACCENT}25`,
                    border: `1px solid ${d.hasOutlier ? STATUS_WARNING : ACCENT}50`,
                  }}
                />
                {/* Median line */}
                <div
                  className="absolute top-0 w-[2px] h-6"
                  style={{ left: `${medianPos}%`, backgroundColor: d.hasOutlier ? STATUS_WARNING : ACCENT }}
                />
                {/* Outlier marker */}
                {d.hasOutlier && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                    style={{ left: `${whiskerRight}%`, backgroundColor: STATUS_WARNING, boxShadow: `0 0 6px ${STATUS_WARNING}` }}
                    title={`Outlier: ${d.max}s`}
                  />
                )}
              </div>
              <span className="text-[11px] font-mono text-text-muted w-14 text-right">
                {d.median.toFixed(1)}s med
              </span>
            </div>
          );
        })}
        {/* Scale */}
        <div className="flex items-center gap-3 mt-1">
          <span className="w-20" />
          <div className="flex-1 flex justify-between text-[11px] font-mono text-text-muted/50">
            <span>0s</span><span>8s</span><span>16s</span><span>24s</span><span>32s</span>
          </div>
          <span className="w-14" />
        </div>
      </div>
    </BlueprintPanel>
  );
}
