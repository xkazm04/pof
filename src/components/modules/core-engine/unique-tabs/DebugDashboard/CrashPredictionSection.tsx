'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { STATUS_SUCCESS, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';
import { ACCENT } from './data';
import {
  CRASH_RISK_OVERALL, CRASH_RISK_FACTORS,
  CRASH_RECOMMENDATIONS, RISK_COLORS,
} from './data-perf';

export function CrashPredictionSection() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <SectionHeader label="CRASH_PREDICTION_ENGINE" color={ACCENT} icon={ShieldAlert} />
      <BlueprintPanel color={ACCENT} className="p-3">
        {/* Overall risk */}
        <div className="flex items-center gap-3 mb-2.5 p-3 rounded border" style={{ borderColor: `${ACCENT}18`, backgroundColor: `${ACCENT}06` }}>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" style={{ color: STATUS_SUCCESS }} />
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">OVERALL RISK</span>
          </div>
          <span className="text-lg font-mono font-bold ml-auto px-3 py-0.5 rounded border"
            style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, borderColor: `${STATUS_SUCCESS}${OPACITY_30}`, textShadow: `0 0 12px ${STATUS_SUCCESS}40` }}>
            {CRASH_RISK_OVERALL}
          </span>
        </div>

        {/* Risk factors */}
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">RISK FACTORS</div>
        <div className="space-y-1.5 mb-2.5">
          {CRASH_RISK_FACTORS.map((rf) => (
            <div key={rf.factor} className="flex items-center gap-3 px-2 py-1.5 rounded transition-colors border border-transparent hover:border-border hover:bg-surface-deep/30">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: RISK_COLORS[rf.risk], boxShadow: `0 0 4px ${RISK_COLORS[rf.risk]}60` }} />
              <span className="text-xs font-mono uppercase tracking-[0.15em] w-36" style={{ color: `${ACCENT}cc` }}>{rf.factor}</span>
              <span className="text-xs font-mono px-1.5 py-[1px] rounded border flex-shrink-0"
                style={{ color: RISK_COLORS[rf.risk], backgroundColor: `${RISK_COLORS[rf.risk]}${OPACITY_10}`, borderColor: `${RISK_COLORS[rf.risk]}${OPACITY_30}` }}>
                {rf.risk}
              </span>
              <span className="text-xs font-mono text-text-muted ml-2 truncate">{rf.detail}</span>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">RECOMMENDED ACTIONS</div>
        <div className="space-y-1.5">
          {CRASH_RECOMMENDATIONS.map((rec, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs font-mono text-text-muted leading-relaxed">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: `${ACCENT}50` }} />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
