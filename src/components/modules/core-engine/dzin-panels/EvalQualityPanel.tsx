'use client';

import { Activity, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  SectionLabel,
  RadarChart,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EvalQualityPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.evaluator;

const QUALITY_MODULES = [
  { name: 'arpg-combat', score: 4.2, trend: 'up' as const },
  { name: 'arpg-character', score: 3.8, trend: 'up' as const },
  { name: 'arpg-inventory', score: 3.5, trend: 'stable' as const },
  { name: 'arpg-loot', score: 3.1, trend: 'down' as const },
  { name: 'arpg-world', score: 2.8, trend: 'down' as const },
  { name: 'arpg-enemy-ai', score: 3.9, trend: 'up' as const },
] as const;

const QUALITY_RADAR: RadarDataPoint[] = [
  { axis: 'Structure', value: 0.78 },
  { axis: 'Quality', value: 0.65 },
  { axis: 'Perf', value: 0.72 },
  { axis: 'Coverage', value: 0.58 },
  { axis: 'Docs', value: 0.45 },
];

function scoreColor(score: number): string {
  if (score >= 4) return STATUS_SUCCESS;
  if (score >= 3) return STATUS_WARNING;
  return STATUS_ERROR;
}

const avgScore = (QUALITY_MODULES.reduce((s, m) => s + m.score, 0) / QUALITY_MODULES.length).toFixed(1);

/* ── Micro density ──────────────────────────────────────────────────────── */

function QualityMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Activity className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">avg {avgScore}</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function QualityCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {QUALITY_MODULES.map((m) => (
        <div key={m.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: scoreColor(m.score) }}
          />
          <span className="text-text-muted flex-1">{m.name.replace('arpg-', '')}</span>
          <span className="font-mono text-text font-medium">{m.score.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function QualityFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Aggregate quality dashboard showing 3-pass evaluation scores (structure, quality, performance)
        across all modules with trend tracking.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Module scores */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Star} label="Module Scores" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {QUALITY_MODULES.map((m, i) => {
              const TrendIcon = m.trend === 'up' ? TrendingUp : m.trend === 'down' ? TrendingDown : Activity;
              return (
                <motion.div
                  key={m.name}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: scoreColor(m.score), boxShadow: `0 0 6px ${scoreColor(m.score)}40` }}
                  />
                  <span className="text-text-muted flex-1">{m.name.replace('arpg-', '')}</span>
                  <TrendIcon className="w-3 h-3" style={{ color: scoreColor(m.score) }} />
                  <span className="font-mono font-bold text-text">{m.score.toFixed(1)}/5</span>
                </motion.div>
              );
            })}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={QUALITY_RADAR} size={160} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Summary */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Quality Summary</div>
        <div className="space-y-1.5 text-xs text-text-muted">
          <div>Average score: <span className="font-mono font-bold text-text">{avgScore}/5</span></div>
          <div>{QUALITY_MODULES.filter(m => m.trend === 'up').length} modules trending up, {QUALITY_MODULES.filter(m => m.trend === 'down').length} trending down</div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EvalQualityPanel({ featureMap, defs }: EvalQualityPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Quality Dashboard" icon={<Activity className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <QualityMicro />}
          {density === 'compact' && <QualityCompact />}
          {density === 'full' && <QualityFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
