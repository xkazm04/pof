'use client';

import { Calendar, Clock, CheckCircle2, Circle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EvalRoadmapPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.evaluator;

const ROADMAP_WEEKS = [
  { week: 'W14', focus: 'Combat polish', progress: 85, status: 'done' as const },
  { week: 'W15', focus: 'Inventory refactor', progress: 60, status: 'active' as const },
  { week: 'W16', focus: 'World streaming', progress: 20, status: 'planned' as const },
  { week: 'W17', focus: 'Enemy AI tuning', progress: 0, status: 'planned' as const },
  { week: 'W18', focus: 'Performance pass', progress: 0, status: 'planned' as const },
] as const;

const DIGEST_ITEMS = [
  { label: 'Features completed', value: '12', color: STATUS_SUCCESS },
  { label: 'Reviews pending', value: '5', color: STATUS_WARNING },
  { label: 'Blockers active', value: '2', color: STATUS_WARNING },
  { label: 'Next milestone', value: 'W16', color: STATUS_INFO },
] as const;

const STATUS_COLORS = { done: STATUS_SUCCESS, active: STATUS_WARNING, planned: STATUS_INFO } as const;
const STATUS_ICON = { done: CheckCircle2, active: Clock, planned: Circle } as const;

const completedWeeks = ROADMAP_WEEKS.filter(w => w.status === 'done').length;

/* ── Micro density ──────────────────────────────────────────────────────── */

function RoadmapMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Calendar className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">W{15} active</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function RoadmapCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {ROADMAP_WEEKS.map((w) => {
        const Icon = STATUS_ICON[w.status];
        return (
          <div key={w.week} className="flex items-center gap-2">
            <Icon className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_COLORS[w.status] }} />
            <span className="font-mono text-text-muted w-8">{w.week}</span>
            <span className="text-text truncate flex-1">{w.focus}</span>
            <span className="font-mono text-text-muted">{w.progress}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function RoadmapFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Calendar roadmap with weekly focus areas, progress tracking,
        and weekly digest summaries for project planning.
      </SurfaceCard>

      {/* Weekly roadmap */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Calendar} label="Weekly Roadmap" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {ROADMAP_WEEKS.map((w, i) => {
            const Icon = STATUS_ICON[w.status];
            const color = STATUS_COLORS[w.status];
            return (
              <motion.div
                key={w.week}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="rounded-lg border px-3 py-2"
                style={{ backgroundColor: color + OPACITY_8, borderColor: color + OPACITY_20 }}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                  <span className="font-mono font-bold text-text w-8">{w.week}</span>
                  <span className="text-text flex-1">{w.focus}</span>
                  <div className="w-16 h-1.5 rounded-full bg-surface-deep overflow-hidden">
                    <div className="h-full rounded-full" style={{ backgroundColor: color, width: `${w.progress}%` }} />
                  </div>
                  <span className="font-mono text-text-muted w-10 text-right">{w.progress}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Weekly digest */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Clock} label="Weekly Digest" color={ACCENT} />
        <div className="grid grid-cols-2 gap-2 mt-2">
          {DIGEST_ITEMS.map((d, i) => (
            <motion.div
              key={d.label}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
              className="text-center p-2 rounded-lg bg-surface-deep/50"
            >
              <div className="font-mono text-lg font-bold" style={{ color: d.color }}>{d.value}</div>
              <div className="text-xs text-text-muted">{d.label}</div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Summary */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Roadmap Summary</div>
        <div className="space-y-1.5 text-xs text-text-muted">
          <div>{completedWeeks}/{ROADMAP_WEEKS.length} weeks completed</div>
          <div>Current focus: <span className="font-mono font-bold text-text">Inventory refactor</span></div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EvalRoadmapPanel({ featureMap, defs }: EvalRoadmapPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Roadmap" icon={<Calendar className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <RoadmapMicro />}
          {density === 'compact' && <RoadmapCompact />}
          {density === 'full' && <RoadmapFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
