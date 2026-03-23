'use client';

import { motion } from 'framer-motion';
import { TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, OPACITY_10, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT } from './data';
import {
  REGRESSION_METRICS, REGRESSION_STATUS_COLORS,
  REGRESSION_BUILDS,
} from './data-perf';

export function RegressionSection() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
      <SectionHeader label="PERF_REGRESSION_DETECTOR" color={ACCENT} icon={TrendingDown} />
      <BlueprintPanel color={ACCENT} className="p-3">
        {/* Regression report */}
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">REGRESSION REPORT -- LATEST BUILD</div>
        <div className="space-y-1 mb-2.5">
          {REGRESSION_METRICS.map((rm) => (
            <div key={rm.metric} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-deep/30 transition-colors">
              {rm.status === 'PASS' ? (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
              ) : rm.status === 'AMBER' ? (
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_WARNING }} />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_ERROR }} />
              )}
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] w-28" style={{ color: `${ACCENT}cc` }}>{rm.metric}</span>
              <span className="text-[10px] font-mono px-1.5 py-[1px] rounded border flex-shrink-0"
                style={{ color: REGRESSION_STATUS_COLORS[rm.status], backgroundColor: `${REGRESSION_STATUS_COLORS[rm.status]}${OPACITY_10}`, borderColor: `${REGRESSION_STATUS_COLORS[rm.status]}${OPACITY_30}` }}>
                {rm.status}
              </span>
              <span className="text-[10px] font-mono text-text-muted truncate flex-1">{rm.detail}</span>
              {rm.delta && (
                <span className="text-[10px] font-mono font-bold flex-shrink-0"
                  style={{ color: rm.status === 'PASS' ? STATUS_SUCCESS : rm.status === 'AMBER' ? STATUS_WARNING : STATUS_ERROR }}>
                  {rm.delta}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Historical build chart */}
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">HISTORICAL TREND ACROSS BUILDS</div>
        <div className="relative h-28 min-h-[200px] rounded-sm overflow-hidden mb-2" style={{ backgroundColor: `${ACCENT}06` }}>
          {[25, 50, 75].map((pct) => (
            <div key={pct} className="absolute left-0 right-0 border-t" style={{ top: `${100 - pct}%`, borderColor: `${ACCENT}10` }} />
          ))}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              points={REGRESSION_BUILDS.map((b, i) => {
                const x = (i / (REGRESSION_BUILDS.length - 1)) * 100;
                const y = 100 - ((b.fps - 50) / 30) * 100;
                return `${x},${y}`;
              }).join(' ')}
              fill="none" stroke={STATUS_SUCCESS} strokeWidth="1.5" vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={REGRESSION_BUILDS.map((b, i) => {
                const x = (i / (REGRESSION_BUILDS.length - 1)) * 100;
                const y = 100 - ((b.memory - 300) / 200) * 100;
                return `${x},${y}`;
              }).join(' ')}
              fill="none" stroke={STATUS_WARNING} strokeWidth="1.5" strokeDasharray="4 2" vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={REGRESSION_BUILDS.map((b, i) => {
                const x = (i / (REGRESSION_BUILDS.length - 1)) * 100;
                const y = 100 - ((b.drawCalls - 600) / 400) * 100;
                return `${x},${y}`;
              }).join(' ')}
              fill="none" stroke={ACCENT_CYAN} strokeWidth="1.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {/* Build labels */}
        <div className="flex justify-between text-[10px] font-mono text-text-muted mb-2">
          {REGRESSION_BUILDS.map((b) => <span key={b.build}>{b.build}</span>)}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-[2px] rounded" style={{ backgroundColor: STATUS_SUCCESS }} />
            <span className="text-text-muted uppercase tracking-[0.15em]">FPS</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-[2px] rounded border-t border-dashed" style={{ borderColor: STATUS_WARNING }} />
            <span className="text-text-muted uppercase tracking-[0.15em]">Memory</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-[2px] rounded border-t border-dotted" style={{ borderColor: ACCENT_CYAN }} />
            <span className="text-text-muted uppercase tracking-[0.15em]">Draw Calls</span>
          </span>
        </div>

        {/* Bisect suggestion */}
        <div className="mt-3 p-2 rounded border flex items-start gap-2" style={{ borderColor: `${ACCENT}18`, backgroundColor: `${ACCENT}06` }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: `${ACCENT}60` }} />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold" style={{ color: `${ACCENT}cc` }}>BISECT SUGGESTION</div>
            <div className="text-[10px] font-mono text-text-muted mt-0.5">
              Memory regression detected between v0.9.0 and v0.9.1 (+8.1%). Consider running
              <span className="mx-1" style={{ color: `${ACCENT}dd` }}>git bisect</span>
              on commits between these builds to isolate the allocation change.
            </div>
          </div>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
