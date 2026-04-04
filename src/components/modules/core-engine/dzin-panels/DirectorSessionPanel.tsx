'use client';

import {
  Clapperboard, Target, Activity, Camera, Clock, Gamepad2,
  AlertOctagon, AlertTriangle, Info, CheckCircle2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_ORANGE, ACCENT_PURPLE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  OPACITY_8,
} from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface DirectorSessionPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'positive';

const SEV_STYLES: Record<Severity, { icon: typeof AlertOctagon; color: string }> = {
  critical: { icon: AlertOctagon, color: STATUS_ERROR },
  high: { icon: AlertTriangle, color: STATUS_ERROR },
  medium: { icon: Info, color: STATUS_WARNING },
  low: { icon: Info, color: STATUS_INFO },
  positive: { icon: CheckCircle2, color: STATUS_SUCCESS },
};

const SESSION = {
  name: 'Sprint 12 – Combat Flow',
  score: 82,
  findings: 7,
  systems: 5,
  screenshots: 12,
  playtimeSeconds: 342,
};

const FINDINGS = [
  { title: 'Combo chain drops input', severity: 'critical' as Severity, confidence: 92 },
  { title: 'Camera clips through wall', severity: 'high' as Severity, confidence: 87 },
  { title: 'Smooth dodge animation', severity: 'positive' as Severity, confidence: 95 },
] as const;

const EVENTS = [
  { type: 'action', message: 'Started combat encounter with Goblin Pack', time: '00:12' },
  { type: 'observation', message: 'Dodge animation is responsive and fluid', time: '00:28' },
  { type: 'finding', message: 'Combo chain drops input on 3rd hit', time: '00:45' },
  { type: 'screenshot', message: 'Captured camera clipping artifact', time: '01:02' },
  { type: 'action', message: 'Tested inventory during combat', time: '01:15' },
] as const;

const COVERAGE: Record<string, number> = {
  combat: 85,
  movement: 72,
  inventory: 45,
  'enemy-ai': 60,
  camera: 38,
};

function scoreColor(score: number): string {
  if (score >= 70) return STATUS_SUCCESS;
  if (score >= 40) return STATUS_WARNING;
  return STATUS_ERROR;
}

const EVENT_ICONS: Record<string, typeof Activity> = {
  action: Activity,
  observation: Info,
  screenshot: Camera,
  finding: Target,
  error: AlertOctagon,
};

/* ── Micro density ──────────────────────────────────────────────────────── */

function SessionMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Clapperboard className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{SESSION.score}/100</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function SessionCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-text font-medium truncate">{SESSION.name}</span>
        <span className="font-mono font-bold" style={{ color: scoreColor(SESSION.score) }}>{SESSION.score}</span>
      </div>
      <div className="flex items-center gap-3 text-text-muted">
        <span>{SESSION.findings} findings</span>
        <span>{SESSION.systems} systems</span>
        <span>{Math.floor(SESSION.playtimeSeconds / 60)}m play</span>
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function SessionFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Session detail view showing findings, event timeline, and test coverage for the most recent playtest session.
      </SurfaceCard>

      {/* Session header with score */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="17"
                fill="none"
                stroke={scoreColor(SESSION.score)}
                strokeWidth="3"
                strokeDasharray={`${(SESSION.score / 100) * 106.8} 106.8`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text">{SESSION.score}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-text truncate">{SESSION.name}</div>
            <div className="flex items-center gap-3 mt-0.5 text-2xs text-text-muted">
              <span className="flex items-center gap-1"><Target className="w-3 h-3" />{SESSION.findings}</span>
              <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" />{SESSION.systems}</span>
              <span className="flex items-center gap-1"><Camera className="w-3 h-3" />{SESSION.screenshots}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.floor(SESSION.playtimeSeconds / 60)}m</span>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Findings */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Target} label="Top Findings" color={ACCENT} />
          <div className="space-y-1.5 mt-2">
            {FINDINGS.map((f, i) => {
              const style = SEV_STYLES[f.severity];
              const Icon = style.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.05 }}
                  className="flex items-center gap-2 text-xs rounded-md px-2 py-1.5"
                  style={{ backgroundColor: `${style.color}${OPACITY_8}` }}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: style.color }} />
                  <span className="text-text flex-1 truncate">{f.title}</span>
                  <span className="text-2xs text-text-muted">{f.confidence}%</span>
                </motion.div>
              );
            })}
          </div>
        </SurfaceCard>

        {/* Event timeline */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Activity} label="Event Timeline" color={ACCENT_PURPLE} />
          <div className="relative pl-4 mt-2">
            <div className="absolute left-1 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-1.5">
              {EVENTS.map((ev, i) => {
                const Icon = EVENT_ICONS[ev.type] ?? Activity;
                const isFinding = ev.type === 'finding';
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, delay: i * 0.04 }}
                    className="relative flex items-start gap-2 text-2xs"
                  >
                    <div
                      className="absolute left-[-12px] top-1 w-2 h-2 rounded-full"
                      style={{ backgroundColor: isFinding ? STATUS_WARNING : 'var(--border-bright)' }}
                    />
                    <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: isFinding ? STATUS_WARNING : 'var(--text-muted)' }} />
                    <span className="text-text flex-1">{ev.message}</span>
                    <span className="text-text-muted flex-shrink-0">{ev.time}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* Coverage bars */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Gamepad2} label="Test Coverage" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {Object.entries(COVERAGE).map(([cat, pct], idx) => (
            <div key={cat} className="flex items-center gap-3 text-xs">
              <span className="text-text-muted w-20 capitalize">{cat.replace(/-/g, ' ')}</span>
              <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.2 + idx * 0.05 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: pct >= 80 ? STATUS_SUCCESS : pct >= 50 ? STATUS_WARNING : STATUS_ERROR }}
                />
              </div>
              <span className="font-mono text-text w-8 text-right">{pct}%</span>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DirectorSessionPanel({ featureMap, defs }: DirectorSessionPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Session Detail" icon={<Clapperboard className="w-4 h-4" />}>
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
