'use client';

import { motion } from 'framer-motion';
import {
  Plus, Gamepad2, AlertTriangle, CheckCircle2, TrendingUp,
  ChevronRight, Loader2, Target,
  Clapperboard, BarChart3,
} from 'lucide-react';
import type { PlaytestSession } from '@/types/game-director';
import type { DirectorStats, HealthTrendPoint } from '@/lib/game-director-db';
import {
  ACCENT_ORANGE, STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO,
} from '@/lib/chart-colors';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { MeterBar } from '@/components/ui/MeterBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState as SharedEmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import { SESSION_STATUS_TOKENS, resolveSessionSource } from '@/lib/game-director-styles';
import { HealthTrendChart } from './HealthTrendChart';
import {
  AggregateProvenanceNotice, ProvenanceChip, sessionScoreRingLabel,
} from './ProvenanceNotice';

const ACCENT = ACCENT_ORANGE;

interface DirectorOverviewProps {
  sessions: PlaytestSession[];
  stats: DirectorStats | null;
  trend: HealthTrendPoint[];
  loading: boolean;
  onViewSession: (id: string) => void;
  onNewSession: () => void;
}

export function DirectorOverview({
  sessions,
  stats,
  trend,
  loading,
  onViewSession,
  onNewSession,
}: DirectorOverviewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Sessions"
          value={stats?.totalSessions ?? 0}
          icon={Gamepad2}
          accent={ACCENT}
          animate
          delay={0}
        />
        <MetricCard
          label="Findings"
          value={stats?.totalFindings ?? 0}
          icon={Target}
          accent={STATUS_INFO}
          animate
          delay={0.05}
        />
        <MetricCard
          label="Critical Issues"
          value={stats?.criticalFindings ?? 0}
          icon={AlertTriangle}
          accent={STATUS_ERROR}
          animate
          delay={0.1}
        />
        <MetricCard
          label={stats?.scoreSource === 'external' ? 'Avg Score' : 'Avg Score (simulated)'}
          value={stats?.avgScore != null ? `${stats.avgScore}/100` : '—'}
          icon={TrendingUp}
          accent={STATUS_SUCCESS}
          animate
          delay={0.15}
        />
      </div>

      {/* Trend over time — answers "is the game getting better or worse over builds?" */}
      {trend.length > 0 && <HealthTrendChart data={trend} />}

      {/* Score visualization */}
      {stats?.avgScore != null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.2 }}
          className="p-4 bg-surface border border-border rounded-xl"
        >
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-4 h-4 text-text-muted" />
            {/* The label is qualified at the source: a "Game Health Score" over
                simulated sessions is a score of the fixture, not of the game. */}
            <span className="text-xs font-medium text-text">
              {stats.scoreSource === 'external' ? 'Game Health Score' : 'Game Health Score (simulated)'}
            </span>
          </div>
          <AggregateProvenanceNotice
            scoreSource={stats.scoreSource}
            sessionCount={stats.scoredSessions}
            what="This average"
            className="mb-3"
          />
          <div className="flex items-center gap-4">
            <ScoreRing
              value={stats.avgScore}
              size={64}
              strokeWidth={4}
              ariaLabel={
                stats.scoreSource === 'external'
                  ? `Game health score: ${stats.avgScore} out of 100, measured`
                  : `Simulated game health score: ${stats.avgScore} out of 100 — not measured, averaged over canned playtest sessions`
              }
            />
            <div className="flex-1 space-y-1.5">
              <ScoreBar label="Completed" value={stats.completedSessions} max={stats.totalSessions} color={STATUS_SUCCESS} />
              <ScoreBar label="Findings" value={stats.totalFindings} max={Math.max(stats.totalFindings, 20)} color={STATUS_INFO} />
              <ScoreBar label="Critical" value={stats.criticalFindings} max={Math.max(stats.totalFindings, 5)} color={STATUS_ERROR} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Sessions list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-medium text-text">Playtest Sessions</h2>
            <span className="text-2xs text-text-muted">{sessions.length} total</span>
          </div>
          <button
            onClick={onNewSession}
            className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: `${ACCENT}15`,
              color: ACCENT,
              border: `1px solid ${ACCENT}30`,
            }}
          >
            <Plus className="w-3 h-3" />
            New Session
          </button>
        </div>

        {sessions.length === 0 ? (
          <EmptyState onNewSession={onNewSession} />
        ) : (
          <div className="space-y-2">
            {sessions.map((session, idx) => (
              <SessionCard
                key={session.id}
                session={session}
                index={idx}
                onClick={() => onViewSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted w-16 text-right">{label}</span>
      <MeterBar
        value={value}
        max={max}
        color={color}
        delayMs={300}
        ariaLabel={label}
        valueText={`${value} of ${max}`}
        className="flex-1"
      />
      <span className="text-xs font-medium text-text-muted-hover w-6 text-right">{value}</span>
    </div>
  );
}

function SessionCard({
  session,
  index,
  onClick,
}: {
  session: PlaytestSession;
  index: number;
  onClick: () => void;
}) {
  const statusToken = SESSION_STATUS_TOKENS[session.status] ?? SESSION_STATUS_TOKENS.configuring;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.03 }}
      onClick={onClick}
      className="focus-ring w-full text-left flex items-center gap-3 px-3.5 py-3 bg-surface-deep border border-border rounded-lg hover:border-border-bright hover:bg-surface transition-all group"
    >
      {/* Score ring or status dot */}
      {session.summary ? (
        <ScoreRing
          value={session.summary.overallScore}
          size={36}
          strokeWidth={2.5}
          ariaLabel={sessionScoreRingLabel(session.summary.overallScore, session)}
          className="flex-shrink-0"
        />
      ) : (
        <div
          className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${statusToken.color}10`, border: `1px solid ${statusToken.color}25` }}
        >
          <Gamepad2 className="w-4 h-4" style={{ color: statusToken.color }} />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{session.name}</span>
          <StatusChip token={statusToken} className="flex-shrink-0" />
          {/* Provenance rides beside the status on every row — the list is where
              a simulated run and a measured one are most easily confused. */}
          <ProvenanceChip source={resolveSessionSource(session)} className="flex-shrink-0" />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {session.findingsCount > 0 && (
            <span className="text-2xs text-text-muted">
              {session.findingsCount} finding{session.findingsCount !== 1 ? 's' : ''}
            </span>
          )}
          {session.systemsTestedCount > 0 && (
            <span className="text-2xs text-text-muted">
              {session.systemsTestedCount} system{session.systemsTestedCount !== 1 ? 's' : ''} tested
            </span>
          )}
          <span className="text-2xs text-text-muted">
            {new Date(session.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-muted transition-colors flex-shrink-0" />
    </motion.button>
  );
}

function EmptyState({ onNewSession }: { onNewSession: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <SharedEmptyState
        icon={Clapperboard}
        iconColor={ACCENT}
        satelliteIcons={[Target, CheckCircle2]}
        title="No playtest sessions yet"
        description="Create a session, then either run the built-in simulator (authored findings — nothing is launched or measured) or have a real playtest harness POST its results through the writer API."
        action={{ label: 'Create First Session', onClick: onNewSession, icon: Plus }}
      />
    </motion.div>
  );
}
