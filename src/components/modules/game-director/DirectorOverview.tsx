'use client';

import { motion } from 'framer-motion';
import {
  Plus, Gamepad2, AlertTriangle, CheckCircle2, TrendingUp,
  Clock, Trash2, ChevronRight, Loader2, Target,
  Clapperboard, BarChart3,
} from 'lucide-react';
import type { PlaytestSession } from '@/types/game-director';
import type { DirectorStats } from '@/lib/game-director-db';

const ACCENT = '#f97316';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  configuring: { color: 'var(--text-muted)', label: 'Configuring' },
  launching: { color: '#fbbf24', label: 'Launching' },
  playing: { color: '#60a5fa', label: 'Playing' },
  analyzing: { color: '#c084fc', label: 'Analyzing' },
  complete: { color: '#4ade80', label: 'Complete' },
  failed: { color: '#f87171', label: 'Failed' },
};

interface DirectorOverviewProps {
  sessions: PlaytestSession[];
  stats: DirectorStats | null;
  loading: boolean;
  onViewSession: (id: string) => void;
  onNewSession: () => void;
}

export function DirectorOverview({
  sessions,
  stats,
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
        <StatCard
          label="Sessions"
          value={stats?.totalSessions ?? 0}
          icon={Gamepad2}
          color={ACCENT}
          delay={0}
        />
        <StatCard
          label="Findings"
          value={stats?.totalFindings ?? 0}
          icon={Target}
          color="#60a5fa"
          delay={0.05}
        />
        <StatCard
          label="Critical Issues"
          value={stats?.criticalFindings ?? 0}
          icon={AlertTriangle}
          color="#f87171"
          delay={0.1}
        />
        <StatCard
          label="Avg Score"
          value={stats?.avgScore != null ? `${stats.avgScore}/100` : '—'}
          icon={TrendingUp}
          color="#4ade80"
          delay={0.15}
        />
      </div>

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
            <span className="text-xs font-medium text-text">Game Health Score</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="4"
                />
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke={stats.avgScore >= 70 ? '#4ade80' : stats.avgScore >= 40 ? '#fbbf24' : '#f87171'}
                  strokeWidth="4"
                  strokeDasharray={`${(stats.avgScore / 100) * 175.9} 175.9`}
                  strokeLinecap="round"
                  className="transition-all duration-slow"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-text">
                {stats.avgScore}
              </span>
            </div>
            <div className="flex-1 space-y-1.5">
              <ScoreBar label="Completed" value={stats.completedSessions} max={stats.totalSessions} color="#4ade80" />
              <ScoreBar label="Findings" value={stats.totalFindings} max={Math.max(stats.totalFindings, 20)} color="#60a5fa" />
              <ScoreBar label="Critical" value={stats.criticalFindings} max={Math.max(stats.totalFindings, 5)} color="#f87171" />
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  delay,
}: {
  label: string;
  value: number | string;
  icon: typeof Gamepad2;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, delay }}
      className="p-3.5 bg-surface border border-border rounded-xl"
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}12`, border: `1px solid ${color}20` }}
        >
          <Icon className="w-3 h-3" style={{ color }} />
        </div>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <span className="text-xl font-bold text-text">{value}</span>
    </motion.div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-text-muted w-16 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-2xs text-text-muted-hover w-6 text-right">{value}</span>
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
  const statusCfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.configuring;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.03 }}
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-3.5 py-3 bg-surface-deep border border-border rounded-lg hover:border-border-bright hover:bg-surface transition-all group"
    >
      {/* Score ring or status dot */}
      {session.summary ? (
        <div className="relative w-9 h-9 flex-shrink-0">
          <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="2.5" />
            <circle
              cx="18" cy="18" r="15"
              fill="none"
              stroke={session.summary.overallScore >= 70 ? '#4ade80' : session.summary.overallScore >= 40 ? '#fbbf24' : '#f87171'}
              strokeWidth="2.5"
              strokeDasharray={`${(session.summary.overallScore / 100) * 94.2} 94.2`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text">
            {session.summary.overallScore}
          </span>
        </div>
      ) : (
        <div
          className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${statusCfg.color}10`, border: `1px solid ${statusCfg.color}25` }}
        >
          <Gamepad2 className="w-4 h-4" style={{ color: statusCfg.color }} />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text truncate">{session.name}</span>
          <span
            className="text-2xs px-1.5 py-0.5 rounded capitalize flex-shrink-0"
            style={{
              backgroundColor: `${statusCfg.color}12`,
              color: statusCfg.color,
              border: `1px solid ${statusCfg.color}25`,
            }}
          >
            {statusCfg.label}
          </span>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${ACCENT}08`, border: `1px solid ${ACCENT}15` }}
      >
        <Clapperboard className="w-7 h-7 text-border-bright" />
      </div>
      <h3 className="text-sm font-medium text-text mb-1">No playtest sessions yet</h3>
      <p className="text-xs text-text-muted max-w-xs mb-4">
        Create a session to launch the AI agent that plays your game, finds bugs, and generates critiques.
      </p>
      <button
        onClick={onNewSession}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
        style={{
          backgroundColor: `${ACCENT}15`,
          color: ACCENT,
          border: `1px solid ${ACCENT}30`,
        }}
      >
        <Plus className="w-3.5 h-3.5" />
        Create First Session
      </button>
    </motion.div>
  );
}
