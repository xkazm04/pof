'use client';

import { BarChart3, Users, Clock, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, ACCENT_CYAN } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EvalSessionAnalyticsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.evaluator;

const SESSION_STATS = [
  { label: 'Total Sessions', value: '48', icon: Users, color: ACCENT_CYAN },
  { label: 'Avg Duration', value: '34m', icon: Clock, color: STATUS_WARNING },
  { label: 'Tasks/Session', value: '6.2', icon: Zap, color: STATUS_SUCCESS },
  { label: 'Success Rate', value: '87%', icon: BarChart3, color: STATUS_SUCCESS },
] as const;

const RECENT_SESSIONS = [
  { id: 'S-048', module: 'arpg-combat', tasks: 8, duration: '42m', outcome: 'success' as const },
  { id: 'S-047', module: 'arpg-loot', tasks: 5, duration: '28m', outcome: 'partial' as const },
  { id: 'S-046', module: 'arpg-world', tasks: 7, duration: '38m', outcome: 'success' as const },
  { id: 'S-045', module: 'arpg-enemy-ai', tasks: 4, duration: '22m', outcome: 'success' as const },
  { id: 'S-044', module: 'arpg-character', tasks: 6, duration: '31m', outcome: 'partial' as const },
] as const;

const MODULE_ACTIVITY = [
  { name: 'arpg-combat', sessions: 14, pct: 29 },
  { name: 'arpg-character', sessions: 10, pct: 21 },
  { name: 'arpg-loot', sessions: 8, pct: 17 },
  { name: 'arpg-world', sessions: 7, pct: 15 },
  { name: 'arpg-enemy-ai', sessions: 5, pct: 10 },
  { name: 'other', sessions: 4, pct: 8 },
] as const;

const OUTCOME_COLORS = { success: STATUS_SUCCESS, partial: STATUS_WARNING } as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function SessionMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <BarChart3 className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">48 sessions</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function SessionCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {RECENT_SESSIONS.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: OUTCOME_COLORS[s.outcome] }}
          />
          <span className="font-mono text-text-muted w-10">{s.id}</span>
          <span className="text-text flex-1 truncate">{s.module.replace('arpg-', '')}</span>
          <span className="font-mono text-text-muted">{s.duration}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function SessionFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Session analytics dashboard showing CLI task history, module activity distribution,
        success rates, and session-level performance metrics.
      </SurfaceCard>

      {/* KPI grid */}
      <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {SESSION_STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
            >
              <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} text-center`}>
                <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: s.color }} />
                <div className="font-mono text-lg font-bold text-text">{s.value}</div>
                <div className="text-xs text-text-muted">{s.label}</div>
              </SurfaceCard>
            </motion.div>
          );
        })}
      </div>

      {/* Module activity */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={BarChart3} label="Module Activity" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {MODULE_ACTIVITY.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 text-xs"
            >
              <span className="text-text-muted w-20 truncate">{m.name.replace('arpg-', '')}</span>
              <div className="flex-1 h-2 rounded-full bg-surface-deep overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: STATUS_INFO }}
                  initial={{ width: 0 }} animate={{ width: `${m.pct}%` }} transition={{ delay: i * 0.08, duration: 0.4 }}
                />
              </div>
              <span className="font-mono text-text-muted w-8 text-right">{m.pct}%</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Recent sessions */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Clock} label="Recent Sessions" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {RECENT_SESSIONS.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 text-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: OUTCOME_COLORS[s.outcome] }} />
              <span className="font-mono text-text w-10">{s.id}</span>
              <span className="text-text-muted flex-1 truncate">{s.module.replace('arpg-', '')}</span>
              <span className="font-mono text-text-muted">{s.tasks}t</span>
              <span className="font-mono text-text-muted">{s.duration}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EvalSessionAnalyticsPanel({ featureMap, defs }: EvalSessionAnalyticsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Session Analytics" icon={<BarChart3 className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <SessionMicro />}
          {density === 'compact' && <SessionCompact />}
          {density === 'full' && <SessionFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
