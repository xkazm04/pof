'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  ArrowRight,
  Link2,
  Activity,
  BarChart3,
  Radar,
} from 'lucide-react';
import type { CorrelatedInsight, InsightSeverity } from '@/lib/evaluator/insight-generator';
import { SEVERITY_COLORS, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';

// ─── Severity styling ────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<InsightSeverity, { icon: typeof AlertTriangle; text: string; bg: string; border: string; iconColor: string }> = {
  critical: {
    icon: AlertOctagon,
    text: SEVERITY_COLORS.critical,
    bg: SEVERITY_COLORS.critical + OPACITY_8,
    border: SEVERITY_COLORS.critical + OPACITY_20,
    iconColor: SEVERITY_COLORS.critical,
  },
  warning: {
    icon: AlertTriangle,
    text: SEVERITY_COLORS.warning,
    bg: SEVERITY_COLORS.warning + OPACITY_8,
    border: SEVERITY_COLORS.warning + OPACITY_20,
    iconColor: SEVERITY_COLORS.warning,
  },
  info: {
    icon: Info,
    text: SEVERITY_COLORS.info,
    bg: SEVERITY_COLORS.info + OPACITY_8,
    border: SEVERITY_COLORS.info + OPACITY_20,
    iconColor: SEVERITY_COLORS.info,
  },
  positive: {
    icon: CheckCircle2,
    text: SEVERITY_COLORS.positive,
    bg: SEVERITY_COLORS.positive + OPACITY_8,
    border: SEVERITY_COLORS.positive + OPACITY_20,
    iconColor: SEVERITY_COLORS.positive,
  },
};

const SOURCE_ICONS: Record<string, typeof Activity> = {
  quality: Activity,
  dependencies: Link2,
  analytics: BarChart3,
  scanner: Radar,
};

const SOURCE_LABELS: Record<string, string> = {
  quality: 'Quality',
  dependencies: 'Deps',
  analytics: 'Analytics',
  scanner: 'Scanner',
};

// ─── Component ───────────────────────────────────────────────────────────────

interface InsightCardProps {
  insight: CorrelatedInsight;
  index: number;
  onDrillDown: (tab: 'quality' | 'dependencies' | 'analytics' | 'scanner') => void;
}

export function InsightCard({ insight, index, onDrillDown }: InsightCardProps) {
  const style = SEVERITY_STYLES[insight.severity];
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04 }}
      className="rounded-lg border px-3.5 py-3 transition-colors hover:brightness-110"
      style={{ backgroundColor: style.bg, borderColor: style.border }}
    >
      <div className="flex items-start gap-3">
        <Icon
          className="w-4 h-4 flex-shrink-0 mt-0.5"
          style={{ color: style.iconColor }}
        />

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-text">
              {insight.title}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-text-muted-hover leading-relaxed mb-2">
            {insight.description}
          </p>

          {/* Footer: source pills + drill-down */}
          <div className="flex items-center gap-2">
            {/* Source pills */}
            <div className="flex items-center gap-1">
              {insight.sources.map((source) => {
                const SourceIcon = SOURCE_ICONS[source] ?? Activity;
                return (
                  <span
                    key={source}
                    className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-border text-text-muted"
                  >
                    <SourceIcon className="w-2.5 h-2.5" />
                    {SOURCE_LABELS[source] ?? source}
                  </span>
                );
              })}
            </div>

            {/* Drill-down button */}
            <button
              onClick={() => onDrillDown(insight.drillDownTab)}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors hover:bg-border"
              style={{ color: style.text }}
            >
              View details
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
