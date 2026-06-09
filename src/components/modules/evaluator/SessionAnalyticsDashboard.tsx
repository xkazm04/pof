'use client';

import { useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Clock, CheckCircle, XCircle, AlertTriangle,
  Lightbulb, ChevronDown, ChevronRight, Zap, Target, Activity, Circle,
} from 'lucide-react';
import { useSessionDashboard } from '@/hooks/useSessionAnalytics';
import { FetchError } from '../shared/FetchError';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import { Tooltip } from '@/components/ui/Tooltip';
import { StatBar } from '@/components/ui/StatBar';
import type {
  ModuleStats,
  PromptInsight,
  PromptQualityScore,
  SessionRecord,
} from '@/types/session-analytics';

import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_STALE, OPACITY_10 } from '@/lib/chart-colors';

const EVALUATOR_ACCENT = MODULE_COLORS.evaluator;

interface SessionAnalyticsDashboardProps {
  onNavigateTab?: (tab: string) => void;
}

export function SessionAnalyticsDashboard({ onNavigateTab }: SessionAnalyticsDashboardProps) {
  const { dashboard, isLoading, error, retry, refetch } = useSessionDashboard();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();
  const [barsAnimated, setBarsAnimated] = useState(false);
  // Honor prefers-reduced-motion: bars are "ready" (full width) immediately,
  // skipping the requestAnimationFrame grow-in. Derived purely so we never call
  // setState in an effect for the reduced-motion path.
  const barsReady = prefersReduced || barsAnimated;

  useEffect(() => {
    if (prefersReduced) return; // bars are derived "ready"; nothing to schedule
    if (!isLoading && dashboard.totalSessions > 0) {
      const frame = requestAnimationFrame(() => setBarsAnimated(true));
      return () => cancelAnimationFrame(frame);
    }
    const frame = requestAnimationFrame(() => setBarsAnimated(false));
    return () => cancelAnimationFrame(frame);
  }, [isLoading, dashboard.totalSessions, prefersReduced]);

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
      <EmptyState
        icon={BarChart3}
        title="No sessions recorded yet"
        description="Run CLI tasks from any module to start building your analytics profile. The system learns from every interaction to optimize future prompts."
        iconColor={EVALUATOR_ACCENT}
        action={onNavigateTab ? {
          label: 'Go to Features',
          onClick: () => onNavigateTab('features'),
          color: EVALUATOR_ACCENT,
        } : undefined}
      />
    );
  }

  const avgDurationSec = dashboard.totalDurationMs / dashboard.totalSessions / 1000;

  return (
    <div className="space-y-6">
      {/* Overview stats row — collapses to 2 columns on the narrow evaluator panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Total Sessions"
          value={dashboard.totalSessions.toString()}
          icon={Activity}
          accent={STATUS_INFO}
        />
        <MetricCard
          label="Success Rate"
          value={`${Math.round(dashboard.overallSuccessRate * 100)}%`}
          icon={Target}
          accent={dashboard.overallSuccessRate >= 0.7 ? STATUS_SUCCESS : dashboard.overallSuccessRate >= 0.4 ? STATUS_WARNING : STATUS_ERROR}
        />
        <MetricCard
          label="Avg Duration"
          value={avgDurationSec < 60 ? `${Math.round(avgDurationSec)}s` : `${Math.round(avgDurationSec / 60)}m`}
          icon={Clock}
          accent={STATUS_STALE}
        />
        <MetricCard
          label="Modules Active"
          value={dashboard.moduleStats.length.toString()}
          icon={Zap}
          accent={MODULE_COLORS.content}
        />
      </div>

      {/* Insights section */}
      {dashboard.insights.length > 0 && (
        <div>
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5" style={{ color: STATUS_WARNING }} />
              <h3 className="text-xs font-semibold text-text">Learned Insights</h3>
              <span
                className="text-2xs px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
              >
                {dashboard.insights.length}
              </span>
            </div>
            <p className="text-2xs text-text-muted mt-1">
              Patterns the assistant noticed across your past sessions — higher confidence means a stronger, more reliable trend.
            </p>
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
          <div className="mb-3">
            <h3 className="text-xs font-semibold text-text">Prompt Quality by Module</h3>
            <p className="text-2xs text-text-muted mt-1">
              How clear and effective your prompts have been, scored 0–100: Good (70+), Fair (40–69), or Low (below 40).
            </p>
          </div>
          <div className="space-y-1.5">
            {dashboard.qualityScores.map((qs, i) => (
              <QualityScoreRow key={qs.moduleId} score={qs} index={i} animate={barsReady} />
            ))}
          </div>
        </div>
      )}

      {/* Module breakdown */}
      {dashboard.moduleStats.length > 0 && (
        <div>
          <div className="mb-3">
            <h3 className="text-xs font-semibold text-text">Module Performance</h3>
            <p className="text-2xs text-text-muted mt-1">
              The share of CLI tasks that finished successfully in each module. Click a row for the breakdown.
            </p>
          </div>
          <div className="space-y-1">
            {dashboard.moduleStats
              .sort((a, b) => b.totalSessions - a.totalSessions)
              .map((ms, i) => (
                <ModuleStatsRow
                  key={ms.moduleId}
                  stats={ms}
                  index={i}
                  animate={barsReady}
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
          <div className="mb-3">
            <h3 className="text-xs font-semibold text-text">Recent Sessions</h3>
            <p className="text-2xs text-text-muted mt-1">
              Your most recent CLI task runs, newest first. Hover a row to read the full module and prompt.
            </p>
          </div>
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

/**
 * Map a 0-100 score / success-rate to a color-blind-safe status band: a
 * semantic color PLUS a distinct icon shape PLUS a short word, so status is
 * never conveyed by hue alone. Shared by the quality, module-performance, and
 * context-impact views to keep their Good/Fair/Low encoding consistent.
 */
function scoreBand(value: number): { color: string; label: string; Icon: typeof CheckCircle } {
  if (value >= 70) return { color: STATUS_SUCCESS, label: 'Good', Icon: CheckCircle };
  if (value >= 40) return { color: STATUS_WARNING, label: 'Fair', Icon: AlertTriangle };
  return { color: STATUS_ERROR, label: 'Low', Icon: XCircle };
}

function InsightCard({ insight }: { insight: PromptInsight }) {
  const confidencePercent = Math.round(insight.confidence * 100);

  return (
    <SurfaceCard level={2} className="flex items-start gap-3 px-3 py-2.5">
      <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: STATUS_WARNING }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-text">{insight.message}</span>
          <span className="text-2xs px-1 py-0.5 rounded bg-border text-text-muted flex-shrink-0">
            {confidencePercent}% confidence
          </span>
        </div>
        <p className="text-xs text-text-muted-hover leading-relaxed">{insight.suggestion}</p>
        <span className="text-2xs text-text-muted mt-0.5 inline-block">{insight.moduleId}</span>
      </div>
    </SurfaceCard>
  );
}

function QualityScoreRow({ score, index, animate }: { score: PromptQualityScore; index: number; animate: boolean }) {
  const TrendIcon = score.trend === 'improving' ? TrendingUp : score.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = score.trend === 'improving' ? STATUS_SUCCESS : score.trend === 'declining' ? STATUS_ERROR : 'var(--text-muted)';
  const band = scoreBand(score.score);
  const BandIcon = band.Icon;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors">
      {/* Module name */}
      <TruncateWithTooltip className="text-xs text-text w-36 truncate">{score.moduleId}</TruncateWithTooltip>

      {/* Score bar */}
      <div className="flex-1 flex items-center gap-2">
        <StatBar value={score.score} color={band.color} animate={animate} delayMs={index * 50} height={6} className="flex-1" />
        <span className="text-xs font-bold w-8 text-right" style={{ color: band.color }}>
          {score.score}
        </span>
        {/* Redundant encoding: icon shape + word + color, readable without hue */}
        <span className="flex items-center gap-0.5 w-14" style={{ color: band.color }}>
          <BandIcon className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
          <span className="text-2xs">{band.label}</span>
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
  index,
  animate,
  isExpanded,
  onToggle,
}: {
  stats: ModuleStats;
  index: number;
  animate: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const successPercent = Math.round(stats.successRate * 100);
  const band = scoreBand(successPercent);
  const BandIcon = band.Icon;

  const panelId = `module-details-${stats.moduleId}`;

  return (
    <div className="rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted-hover" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted-hover" aria-hidden="true" />
        )}

        <TruncateWithTooltip className="text-xs text-text w-36 truncate">{stats.moduleId}</TruncateWithTooltip>

        {/* Mini success bar */}
        <StatBar
          value={successPercent}
          color={band.color}
          animate={animate}
          delayMs={index * 50}
          height={4}
          className="flex-1"
          ariaLabel={`${stats.moduleId} success rate`}
        />

        {/* Redundant encoding: icon shape + word + percent + color, readable without hue */}
        <span className="flex items-center gap-1 w-24 justify-end" style={{ color: band.color }}>
          <BandIcon className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
          <span className="text-2xs font-medium">{band.label}</span>
          <span className="text-xs font-medium">{successPercent}%</span>
        </span>

        <span className="text-2xs text-text-muted w-8 text-right">{stats.totalSessions}</span>
      </button>

      {isExpanded && (
        <div id={panelId} role="region" aria-label={`${stats.moduleId} details`} className="px-8 py-3 bg-surface-hover space-y-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-2xs text-text-muted block">Success</span>
              <span className="text-xs font-medium" style={{ color: STATUS_SUCCESS }}>{stats.successCount}</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Failed</span>
              <span className="text-xs font-medium" style={{ color: STATUS_ERROR }}>{stats.failCount}</span>
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
                {/* Shape-coded markers (filled check vs hollow circle) so the two
                    series are distinguishable without relying on color */}
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-2.5 h-2.5 flex-shrink-0" style={{ color: STATUS_SUCCESS }} aria-hidden="true" />
                  <span className="text-xs text-text">
                    With context: {Math.round(stats.contextInjectedSuccessRate * 100)}%
                  </span>
                  <span className="text-2xs text-text-muted">({stats.contextInjectedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Circle className="w-2.5 h-2.5 flex-shrink-0 text-text-muted" aria-hidden="true" />
                  <span className="text-xs text-text">
                    Without context: {Math.round(stats.noContextSuccessRate * 100)}%
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
    <div className="flex items-center gap-3 px-3 py-1.5 rounded hover:bg-surface-hover transition-colors">
      {session.success ? (
        <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_SUCCESS }} aria-label="Session succeeded" />
      ) : (
        <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} aria-label="Session failed" />
      )}
      <TruncateWithTooltip className="text-xs text-text-muted-hover w-28 truncate flex-shrink-0">{session.moduleId}</TruncateWithTooltip>
      <TruncateWithTooltip className="text-xs text-text-muted-hover flex-1 min-w-0 truncate">{session.promptPreview}</TruncateWithTooltip>
      <span className="text-2xs text-text-muted flex-shrink-0">{durationStr}</span>
      {session.hadProjectContext && (
        <Tooltip content="Used project context">
          <span
            tabIndex={0}
            className="text-2xs px-1 py-0.5 rounded flex-shrink-0 cursor-default focus-ring"
            style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS }}
          >context</span>
        </Tooltip>
      )}
    </div>
  );
}
