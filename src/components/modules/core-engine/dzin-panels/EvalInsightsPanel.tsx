'use client';

import { Lightbulb, AlertTriangle, AlertOctagon, Info, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_ORANGE, SEVERITY_COLORS, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { InsightSeverity } from '@/lib/evaluator/insight-generator';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EvalInsightsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

const SEVERITY_ICONS: Record<InsightSeverity, typeof AlertTriangle> = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
  positive: CheckCircle2,
};

const MOCK_INSIGHTS = [
  { severity: 'critical' as InsightSeverity, title: 'Brittle Module: arpg-world', desc: 'High dependency count (6) with low quality (2.8)' },
  { severity: 'warning' as InsightSeverity, title: 'Blocked Progress: arpg-loot', desc: '2 features blocked by unresolved cross-module deps' },
  { severity: 'warning' as InsightSeverity, title: 'Coverage Gap: arpg-save', desc: 'Only 45% of features have been reviewed' },
  { severity: 'info' as InsightSeverity, title: 'Quality Disconnect: arpg-combat', desc: 'Scan score 85 but quality avg only 4.2' },
  { severity: 'positive' as InsightSeverity, title: 'Strong Module: arpg-character', desc: 'High quality (3.8) with good coverage and upward trend' },
] as const;

const criticalCount = MOCK_INSIGHTS.filter(i => i.severity === 'critical').length;
const warningCount = MOCK_INSIGHTS.filter(i => i.severity === 'warning').length;

/* ── Micro density ──────────────────────────────────────────────────────── */

function InsightsMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Lightbulb className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{MOCK_INSIGHTS.length} insights</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function InsightsCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {MOCK_INSIGHTS.map((insight) => {
        const Icon = SEVERITY_ICONS[insight.severity];
        return (
          <div key={insight.title} className="flex items-center gap-2">
            <Icon
              className="w-3 h-3 flex-shrink-0"
              style={{ color: SEVERITY_COLORS[insight.severity] }}
            />
            <span className="text-text truncate">{insight.title}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function InsightsFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Correlated insights from quality analysis, dependency graph, analytics, and scanner data
        — prioritized by severity and actionability.
      </SurfaceCard>

      {/* Insight list */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Lightbulb} label="Active Insights" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {MOCK_INSIGHTS.map((insight, i) => {
            const Icon = SEVERITY_ICONS[insight.severity];
            const color = SEVERITY_COLORS[insight.severity];
            return (
              <motion.div
                key={insight.title}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="rounded-lg border px-3 py-2"
                style={{ backgroundColor: color + OPACITY_8, borderColor: color + OPACITY_20 }}
              >
                <div className="flex items-start gap-2">
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
                  <div>
                    <div className="text-xs font-semibold text-text">{insight.title}</div>
                    <div className="text-xs text-text-muted mt-0.5">{insight.desc}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Summary */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Insight Summary</div>
        <div className="space-y-1.5 text-xs text-text-muted">
          <div><span className="font-mono font-bold" style={{ color: SEVERITY_COLORS.critical }}>{criticalCount}</span> critical, <span className="font-mono font-bold" style={{ color: SEVERITY_COLORS.warning }}>{warningCount}</span> warning, {MOCK_INSIGHTS.length - criticalCount - warningCount} info/positive</div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EvalInsightsPanel({ featureMap, defs }: EvalInsightsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Insights" icon={<Lightbulb className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <InsightsMicro />}
          {density === 'compact' && <InsightsCompact />}
          {density === 'full' && <InsightsFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
