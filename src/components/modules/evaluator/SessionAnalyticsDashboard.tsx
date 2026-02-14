'use client';

import { useState } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Clock, CheckCircle, XCircle,
  Lightbulb, ChevronDown, ChevronRight, Zap, Target, Activity,
} from 'lucide-react';
import { useSessionDashboard } from '@/hooks/useSessionAnalytics';
import { FetchError } from '../shared/FetchError';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type {
  ModuleStats,
  PromptInsight,
  PromptQualityScore,
  SessionRecord,
} from '@/types/session-analytics';

const EVALUATOR_ACCENT = '#ef4444';

export function SessionAnalyticsDashboard() {
  const { dashboard, isLoading, error, retry, refetch } = useSessionDashboard();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="w-5 h-5 animate-spin text-text-muted-hover" />
      </div>
    );
  }

  if (error) {
    return <FetchError message={error} onRetry={retry} />;
  }

  if (dashboard.totalSessions === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <BarChart3 className="w-10 h-10 mx-auto text-border-bright" />
        <div>
          <h3 className="text-sm font-semibold text-text">No Sessions Recorded Yet</h3>
          <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
            Run CLI tasks from any module to start building your analytics profile. The system learns from every interaction to optimize future prompts.
          </p>
        </div>
      </div>
    );
  }

  const avgDurationSec = dashboard.totalDurationMs / dashboard.totalSessions / 1000;

  return (
    <div className="space-y-6">
      {/* Overview stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Total Sessions"
          value={dashboard.totalSessions.toString()}
          icon={Activity}
          color="#60a5fa"
        />
        <StatCard
          label="Success Rate"
          value={`${Math.round(dashboard.overallSuccessRate * 100)}%`}
          icon={Target}
          color={dashboard.overallSuccessRate >= 0.7 ? '#4ade80' : dashboard.overallSuccessRate >= 0.4 ? '#fbbf24' : '#f87171'}
        />
        <StatCard
          label="Avg Duration"
          value={avgDurationSec < 60 ? `${Math.round(avgDurationSec)}s` : `${Math.round(avgDurationSec / 60)}m`}
          icon={Clock}
          color="#a78bfa"
        />
        <StatCard
          label="Modules Active"
          value={dashboard.moduleStats.length.toString()}
          icon={Zap}
          color="#f59e0b"
        />
      </div>

      {/* Insights section */}
      {dashboard.insights.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-3.5 h-3.5 text-[#fbbf24]" />
            <h3 className="text-xs font-semibold text-text">Learned Insights</h3>
            <span className="text-2xs px-1.5 py-0.5 rounded bg-[#fbbf2418] text-[#fbbf24] font-medium">
              {dashboard.insights.length}
            </span>
          </div>
          <div className="space-y-2">
            {dashboard.insights.slice(0, 5).map((insight, i) => (
              <InsightCard key={`${insight.moduleId}-${insight.type}-${i}`} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Prompt Quality Scores */}
      {dashboard.qualityScores.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text mb-3">Prompt Quality by Module</h3>
          <div className="space-y-1.5">
            {dashboard.qualityScores.map((qs) => (
              <QualityScoreRow key={qs.moduleId} score={qs} />
            ))}
          </div>
        </div>
      )}

      {/* Module breakdown */}
      {dashboard.moduleStats.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text mb-3">Module Performance</h3>
          <div className="space-y-1">
            {dashboard.moduleStats
              .sort((a, b) => b.totalSessions - a.totalSessions)
              .map((ms) => (
                <ModuleStatsRow
                  key={ms.moduleId}
                  stats={ms}
                  isExpanded={expandedModule === ms.moduleId}
                  onToggle={() => setExpandedModule(expandedModule === ms.moduleId ? null : ms.moduleId)}
                />
              ))
            }
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {dashboard.recentSessions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text mb-3">Recent Sessions</h3>
          <div className="space-y-0.5">
            {dashboard.recentSessions.map((session) => (
              <RecentSessionRow key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  color: string;
}) {
  return (
    <SurfaceCard level={2} className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">{label}</span>
      </div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </SurfaceCard>
  );
}

function InsightCard({ insight }: { insight: PromptInsight }) {
  const confidencePercent = Math.round(insight.confidence * 100);

  return (
    <SurfaceCard level={2} className="flex items-start gap-3 px-3 py-2.5">
      <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#fbbf24]" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-text">{insight.message}</span>
          <span className="text-2xs px-1 py-0.5 rounded bg-border text-text-muted flex-shrink-0">
            {confidencePercent}% conf
          </span>
        </div>
        <p className="text-xs text-text-muted-hover leading-relaxed">{insight.suggestion}</p>
        <span className="text-2xs text-[#4a4e6a] mt-0.5 inline-block">{insight.moduleId}</span>
      </div>
    </SurfaceCard>
  );
}

function QualityScoreRow({ score }: { score: PromptQualityScore }) {
  const TrendIcon = score.trend === 'improving' ? TrendingUp : score.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = score.trend === 'improving' ? '#4ade80' : score.trend === 'declining' ? '#f87171' : 'var(--text-muted)';
  const scoreColor = score.score >= 70 ? '#4ade80' : score.score >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#111130] transition-colors">
      {/* Module name */}
      <span className="text-xs text-text w-36 truncate">{score.moduleId}</span>

      {/* Score bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score.score}%`, backgroundColor: scoreColor }}
          />
        </div>
        <span className="text-xs font-bold w-8 text-right" style={{ color: scoreColor }}>
          {score.score}
        </span>
      </div>

      {/* Trend */}
      <TrendIcon className="w-3 h-3 flex-shrink-0" style={{ color: trendColor }} />

      {/* Sessions count */}
      <span className="text-2xs text-text-muted w-16 text-right">{score.sessionsRecorded} sessions</span>
    </div>
  );
}

function ModuleStatsRow({
  stats,
  isExpanded,
  onToggle,
}: {
  stats: ModuleStats;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const successPercent = Math.round(stats.successRate * 100);
  const successColor = successPercent >= 70 ? '#4ade80' : successPercent >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div className="rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted-hover" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted-hover" />
        )}

        <span className="text-xs text-text w-36 truncate">{stats.moduleId}</span>

        {/* Mini success bar */}
        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${successPercent}%`, backgroundColor: successColor }}
          />
        </div>

        <span className="text-xs font-medium w-10 text-right" style={{ color: successColor }}>
          {successPercent}%
        </span>

        <span className="text-2xs text-text-muted w-8 text-right">{stats.totalSessions}</span>
      </button>

      {isExpanded && (
        <div className="px-8 py-3 bg-[#111130] space-y-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-2xs text-text-muted block">Success</span>
              <span className="text-xs text-[#4ade80] font-medium">{stats.successCount}</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Failed</span>
              <span className="text-xs text-[#f87171] font-medium">{stats.failCount}</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Avg Time</span>
              <span className="text-xs text-text-muted-hover font-medium">
                {stats.avgDurationMs > 60000
                  ? `${Math.round(stats.avgDurationMs / 60000)}m`
                  : `${Math.round(stats.avgDurationMs / 1000)}s`
                }
              </span>
            </div>
          </div>

          {/* Context injection comparison */}
          {stats.contextInjectedCount > 0 && stats.noContextCount > 0 && (
            <div className="pt-2 border-t border-border">
              <span className="text-2xs text-text-muted block mb-1">Context Injection Impact</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#4ade80]" />
                  <span className="text-xs text-text">
                    With: {Math.round(stats.contextInjectedSuccessRate * 100)}%
                  </span>
                  <span className="text-2xs text-text-muted">({stats.contextInjectedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-text-muted" />
                  <span className="text-xs text-text">
                    Without: {Math.round(stats.noContextSuccessRate * 100)}%
                  </span>
                  <span className="text-2xs text-text-muted">({stats.noContextCount})</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecentSessionRow({ session }: { session: SessionRecord }) {
  const durationStr = session.durationMs > 60000
    ? `${Math.round(session.durationMs / 60000)}m`
    : `${Math.round(session.durationMs / 1000)}s`;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded hover:bg-[#111130] transition-colors">
      {session.success ? (
        <CheckCircle className="w-3 h-3 text-[#4ade80] flex-shrink-0" />
      ) : (
        <XCircle className="w-3 h-3 text-[#f87171] flex-shrink-0" />
      )}
      <span className="text-xs text-text-muted-hover w-28 truncate flex-shrink-0">{session.moduleId}</span>
      <span className="text-xs text-[#d0d4e8] flex-1 min-w-0 truncate">{session.promptPreview}</span>
      <span className="text-2xs text-text-muted flex-shrink-0">{durationStr}</span>
      {session.hadProjectContext && (
        <span className="text-2xs px-1 py-0.5 rounded bg-[#4ade8018] text-[#4ade80] flex-shrink-0">ctx</span>
      )}
    </div>
  );
}
