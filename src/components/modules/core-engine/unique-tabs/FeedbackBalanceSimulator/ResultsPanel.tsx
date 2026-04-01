'use client';

import {
  Copy, Swords, Shield, Heart, Timer, Pause,
  Eye, EyeOff, TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD,
  OPACITY_15,
} from '@/lib/chart-colors';
import type { FeedbackConfig, FeedbackComparisonResult } from '@/types/combat-simulator';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT } from './types';
import { MetricRow } from './MetricRow';
import { FeedbackMetric, DeltaBadge } from './FeedbackMetric';
import { BalanceInsightsPanel } from './BalanceInsightsPanel';

/* ── ResultsPanel ─ Full comparison output ───────────────────────────── */

export function ResultsPanel({ result, feedbackConfig, onCopyReport }: {
  result: FeedbackComparisonResult;
  feedbackConfig: FeedbackConfig;
  onCopyReport: () => void;
}) {
  const { withFeedback: on, withoutFeedback: off, deltas, insights } = result;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Side-by-side comparison */}
      <BlueprintPanel className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader icon={Swords} label="Feedback vs Pure Math" />
          <button
            onClick={onCopyReport}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono uppercase tracking-[0.15em] transition-colors"
            style={{ color: ACCENT_VIOLET, backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}` }}
          >
            <Copy className="w-3 h-3" />
            Copy Report
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 mb-2">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3" style={{ color: ACCENT_VIOLET }} />
            <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: ACCENT_VIOLET }}>
              With Feedback
            </span>
          </div>
          <div className="w-20 text-center">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Delta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <EyeOff className="w-3 h-3 text-text-muted" />
            <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">
              Pure Math
            </span>
          </div>
        </div>

        {/* Metric rows */}
        <div className="space-y-1.5">
          <MetricRow label="Survival Rate" feedbackOn={on.survivalRate} feedbackOff={off.survivalRate}
            unit="%" higherIsBetter icon={Heart} color={STATUS_SUCCESS} />
          <MetricRow label="Avg Duration" feedbackOn={on.avgDurationSec} feedbackOff={off.avgDurationSec}
            unit="s" higherIsBetter={false} icon={Timer} color={ACCENT_CYAN} />
          <MetricRow label="Player DPS" feedbackOn={on.avgDPS} feedbackOff={off.avgDPS}
            higherIsBetter icon={Swords} color={ACCENT_ORANGE} />
          <MetricRow label="Damage Taken" feedbackOn={on.avgDamageTaken} feedbackOff={off.avgDamageTaken}
            higherIsBetter={false} icon={Shield} color={STATUS_ERROR} />
        </div>
      </BlueprintPanel>

      {/* Feedback-Specific Metrics */}
      <BlueprintPanel className="p-3">
        <SectionHeader icon={Pause} label="Feedback Mechanics Impact" color={ACCENT_VIOLET} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          <FeedbackMetric
            label="Dodges from Hitstop"
            value={on.avgDodgesFromHitstop.toFixed(1)}
            unit="/fight"
            color={ACCENT_EMERALD}
            description={`${(feedbackConfig.hitstopDurationSec * 1000).toFixed(0)}ms freeze → ${((feedbackConfig.hitstopDurationSec + feedbackConfig.baseReactionTimeSec) * 1000).toFixed(0)}ms window`}
            viz={{ type: 'bar', ratio: Math.min(on.avgDodgesFromHitstop / 10, 1) }}
          />
          <FeedbackMetric
            label="Misses from Shake"
            value={on.avgMissesFromShake.toFixed(1)}
            unit="/fight"
            color={ACCENT_ORANGE}
            description={`${feedbackConfig.cameraShakeScale.toFixed(1)}x shake × ${(feedbackConfig.shakeAccuracyPenalty * 100).toFixed(0)}% penalty`}
            viz={{ type: 'bar', ratio: Math.min(on.avgMissesFromShake / 10, 1) }}
          />
          <FeedbackMetric
            label="Total Hitstop"
            value={on.avgTotalHitstopSec.toFixed(1)}
            unit="s/fight"
            color={ACCENT_VIOLET}
            description={`${on.avgDurationSec > 0 ? ((on.avgTotalHitstopSec / on.avgDurationSec) * 100).toFixed(1) : 0}% of fight is freeze frames`}
            viz={{ type: 'donut', ratio: on.avgDurationSec > 0 ? on.avgTotalHitstopSec / on.avgDurationSec : 0 }}
          />
          <FeedbackMetric
            label="Effective Reaction"
            value={`${(on.avgEffectiveReactionSec * 1000).toFixed(0)}`}
            unit="ms"
            color={ACCENT_CYAN}
            description="hitstop + base reaction time"
            viz={{ type: 'gauge', ratio: (on.avgEffectiveReactionSec * 1000) / 500 }}
          />
        </div>
      </BlueprintPanel>

      {/* Delta Summary Bar */}
      <BlueprintPanel className="p-3">
        <SectionHeader icon={TrendingUp} label="Net Impact (Feedback ON - OFF)" color={ACCENT} />
        <div className="grid grid-cols-4 gap-2 mt-2">
          <DeltaBadge label="Survival" delta={deltas.survivalRateDelta} isPercent higherIsBetter />
          <DeltaBadge label="Duration" delta={deltas.durationDelta} unit="s" higherIsBetter={false} />
          <DeltaBadge label="DPS" delta={deltas.dpsDelta} higherIsBetter />
          <DeltaBadge label="Dmg Taken" delta={deltas.damageTakenDelta} higherIsBetter={false} />
        </div>
      </BlueprintPanel>

      {/* Insights */}
      <BalanceInsightsPanel insights={insights} />
    </motion.div>
  );
}
