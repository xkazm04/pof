'use client';

import { Radar, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  SectionLabel,
  RadarChart,
  PipelineFlow,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_EMERALD, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN, ACCENT_ORANGE, ACCENT_PURPLE } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface ProjectHealthPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_EMERALD;

const HEALTH_DIMENSIONS = [
  { name: 'Feature Completion', value: 68, color: STATUS_SUCCESS },
  { name: 'Quality Coverage', value: 52, color: ACCENT_CYAN },
  { name: 'Dependency Health', value: 75, color: ACCENT_PURPLE },
  { name: 'Build Stability', value: 92, color: STATUS_SUCCESS },
  { name: 'Review Freshness', value: 45, color: ACCENT_ORANGE },
] as const;

const HEALTH_RADAR: RadarDataPoint[] = HEALTH_DIMENSIONS.map((d) => ({
  axis: d.name.split(' ')[0],
  value: d.value / 100,
}));

const HEALTH_PIPELINE = ['Scan', 'Analyze', 'Score', 'Correlate', 'Report'] as const;

const overallScore = Math.round(HEALTH_DIMENSIONS.reduce((s, d) => s + d.value, 0) / HEALTH_DIMENSIONS.length);

function healthColor(score: number): string {
  if (score >= 80) return STATUS_SUCCESS;
  if (score >= 60) return STATUS_WARNING;
  return STATUS_ERROR;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function HealthMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Radar className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{overallScore}%</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function HealthCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {HEALTH_DIMENSIONS.map((d) => (
        <div key={d.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: healthColor(d.value) }}
          />
          <span className="text-text-muted flex-1">{d.name}</span>
          <span className="font-mono text-text font-medium">{d.value}%</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function HealthFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Project health overview aggregating feature completion, quality coverage, dependency
        health, build stability, and review freshness into a unified score.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Dimensions */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Shield} label="Health Dimensions" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {HEALTH_DIMENSIONS.map((d, i) => (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-text-muted flex-1">{d.name}</span>
                  <span className="font-mono font-bold" style={{ color: healthColor(d.value) }}>{d.value}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-border/40">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: d.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${d.value}%` }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={HEALTH_RADAR} size={160} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Overall */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="flex items-center gap-3">
          {overallScore >= 70 ? (
            <CheckCircle2 className="w-5 h-5" style={{ color: STATUS_SUCCESS }} />
          ) : (
            <AlertTriangle className="w-5 h-5" style={{ color: STATUS_WARNING }} />
          )}
          <div>
            <div className="text-xs font-bold text-text">Overall Health: <span className="font-mono" style={{ color: healthColor(overallScore) }}>{overallScore}%</span></div>
            <div className="text-xs text-text-muted mt-0.5">
              {overallScore >= 80 ? 'Project is in good shape' : overallScore >= 60 ? 'Some areas need attention' : 'Multiple areas need improvement'}
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Health Scan Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...HEALTH_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ProjectHealthPanel({ featureMap, defs }: ProjectHealthPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Project Health" icon={<Radar className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <HealthMicro />}
          {density === 'compact' && <HealthCompact />}
          {density === 'full' && <HealthFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
