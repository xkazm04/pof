'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { OPACITY_10, OPACITY_30,
  withOpacity, OPACITY_5, OPACITY_25, OPACITY_37, OPACITY_80,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../../unique-tabs/_design';
import { ACCENT } from '../_shared/data';
import { RISK_COLORS } from '../_shared/data-perf';
import type { CrashOverall, CrashRisk, RiskLevel } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';

const OVERALL_RISK: Record<CrashOverall, RiskLevel> = { LOW: 'GREEN', MEDIUM: 'AMBER', HIGH: 'RED' };

/** Overall risk is the worst derived factor; factors a capture cannot measure are listed, not invented. */
export function CrashPredictionSection({ crash, recommendations }: { crash: CrashRisk; recommendations: string[] }) {
  const tone = RISK_COLORS[OVERALL_RISK[crash.overall]];
  const OverallIcon = crash.overall === 'LOW' ? CheckCircle2 : AlertTriangle;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <SectionHeader label="CRASH_PREDICTION_ENGINE" color={ACCENT} icon={ShieldAlert} />
      <BlueprintPanel color={ACCENT} className="p-3">
        {/* Overall risk */}
        <div className="flex items-center gap-3 mb-2.5 p-3 rounded border" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_10)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
          <div className="flex items-center gap-1.5">
            <OverallIcon className="w-5 h-5" style={{ color: tone }} />
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">OVERALL RISK</span>
          </div>
          <span className="text-lg font-mono font-bold ml-auto px-3 py-0.5 rounded border"
            style={{ color: tone, backgroundColor: `${tone}${OPACITY_10}`, borderColor: `${tone}${OPACITY_30}`, textShadow: `0 0 12px ${withOpacity(tone, OPACITY_25)}` }}>
            {crash.overall}
          </span>
        </div>

        {/* Risk factors */}
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">RISK FACTORS</div>
        <div className="space-y-1.5 mb-2.5">
          {crash.factors.map((rf) => (
            <div key={rf.factor} className="flex items-center gap-3 px-2 py-1.5 rounded transition-colors border border-transparent hover:border-border hover:bg-surface-deep/30">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: RISK_COLORS[rf.risk], boxShadow: `0 0 4px ${withOpacity(RISK_COLORS[rf.risk], OPACITY_37)}` }} />
              <span className="text-xs font-mono uppercase tracking-[0.15em] w-36" style={{ color: `${withOpacity(ACCENT, OPACITY_80)}` }}>{rf.factor}</span>
              <span className="text-xs font-mono px-1.5 py-[1px] rounded border flex-shrink-0"
                style={{ color: RISK_COLORS[rf.risk], backgroundColor: `${RISK_COLORS[rf.risk]}${OPACITY_10}`, borderColor: `${RISK_COLORS[rf.risk]}${OPACITY_30}` }}>
                {rf.risk}
              </span>
              <span className="text-xs font-mono text-text-muted ml-2 truncate">{rf.detail}</span>
            </div>
          ))}
        </div>

        <div className="text-xs font-mono text-text-muted mb-2.5">Not in this capture: {crash.notInCapture.join(', ')}.</div>

        {/* Recommendations */}
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">RECOMMENDED ACTIONS</div>
        <div className="space-y-1.5">
          {recommendations.length === 0 && (
            <div className="text-xs font-mono text-text-muted">No factor over its threshold in this capture.</div>
          )}
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs font-mono text-text-muted leading-relaxed">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: `${withOpacity(ACCENT, OPACITY_30)}` }} />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
