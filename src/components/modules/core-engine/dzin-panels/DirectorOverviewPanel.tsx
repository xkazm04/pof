'use client';

import { Gamepad2, Target, AlertTriangle, TrendingUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface DirectorOverviewPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

const SESSIONS = [
  { name: 'Sprint 12 – Combat Flow', status: 'complete' as const, score: 82, findings: 7 },
  { name: 'Sprint 11 – Inventory UX', status: 'complete' as const, score: 65, findings: 12 },
  { name: 'Sprint 10 – World Traversal', status: 'complete' as const, score: 74, findings: 9 },
  { name: 'Sprint 13 – Enemy AI', status: 'playing' as const, score: null, findings: 3 },
] as const;

const STATS = { sessions: 14, findings: 87, critical: 5, avgScore: 72 };

function statusColor(status: string): string {
  if (status === 'complete') return STATUS_SUCCESS;
  if (status === 'playing') return STATUS_INFO;
  if (status === 'failed') return STATUS_ERROR;
  return STATUS_WARNING;
}

function scoreColor(score: number): string {
  if (score >= 70) return STATUS_SUCCESS;
  if (score >= 40) return STATUS_WARNING;
  return STATUS_ERROR;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function OverviewMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Gamepad2 className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{STATS.sessions} sessions</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function OverviewCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>{STATS.sessions} sessions</span>
        <span className="font-mono font-medium text-text">{STATS.avgScore}/100</span>
      </div>
      {SESSIONS.slice(0, 3).map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColor(s.status) }}
          />
          <span className="text-text-muted flex-1 truncate">{s.name}</span>
          {s.score !== null && (
            <span className="font-mono text-text font-medium" style={{ color: scoreColor(s.score) }}>
              {s.score}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function OverviewFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Game Director session overview with playtest history, health scores, and aggregate statistics.
      </SurfaceCard>

      {/* Stats row */}
      <div className={`grid grid-cols-4 ${DZIN_SPACING.full.gap}`}>
        <StatBadge icon={Gamepad2} label="Sessions" value={STATS.sessions} color={ACCENT} delay={0} />
        <StatBadge icon={Target} label="Findings" value={STATS.findings} color={STATUS_INFO} delay={0.05} />
        <StatBadge icon={AlertTriangle} label="Critical" value={STATS.critical} color={STATUS_ERROR} delay={0.1} />
        <StatBadge icon={TrendingUp} label="Avg Score" value={`${STATS.avgScore}/100`} color={STATUS_SUCCESS} delay={0.15} />
      </div>

      {/* Sessions list */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Gamepad2} label="Recent Sessions" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {SESSIONS.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 text-xs"
            >
              {s.score !== null ? (
                <div className="relative w-7 h-7 flex-shrink-0">
                  <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="11" fill="none" stroke="var(--border)" strokeWidth="2" />
                    <circle
                      cx="14" cy="14" r="11"
                      fill="none"
                      stroke={scoreColor(s.score)}
                      strokeWidth="2"
                      strokeDasharray={`${(s.score / 100) * 69.1} 69.1`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-text">{s.score}</span>
                </div>
              ) : (
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${statusColor(s.status)}10`, border: `1px solid ${statusColor(s.status)}25` }}
                >
                  <Gamepad2 className="w-3 h-3" style={{ color: statusColor(s.status) }} />
                </span>
              )}
              <span className="text-text flex-1 truncate">{s.name}</span>
              <span
                className="text-2xs px-1.5 py-0.5 rounded capitalize"
                style={{ backgroundColor: `${statusColor(s.status)}12`, color: statusColor(s.status) }}
              >
                {s.status}
              </span>
              <span className="text-text-muted">{s.findings} findings</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

function StatBadge({ icon: Icon, label, value, color, delay }: {
  icon: typeof Gamepad2; label: string; value: number | string; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, delay }}
    >
      <SurfaceCard level={2} className="p-2.5 text-center">
        <Icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color }} />
        <div className="text-sm font-bold text-text">{value}</div>
        <div className="text-2xs text-text-muted">{label}</div>
      </SurfaceCard>
    </motion.div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DirectorOverviewPanel({ featureMap, defs }: DirectorOverviewPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Director Overview" icon={<Gamepad2 className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <OverviewMicro />}
          {density === 'compact' && <OverviewCompact />}
          {density === 'full' && <OverviewFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
