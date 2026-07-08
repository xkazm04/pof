'use client';

import { useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  BarChart3, Clock, Lightbulb, Zap, Target, Activity,
} from 'lucide-react';
import { useSessionDashboard } from '@/hooks/useSessionAnalytics';
import { FetchError } from '../../shared/FetchError';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/EmptyState';

import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_STALE, OPACITY_10 } from '@/lib/chart-colors';
import { EVALUATOR_ACCENT } from './constants';
import type { SessionAnalyticsDashboardProps } from './types';
import { InsightCard } from './InsightCard';
import { QualityScoreRow } from './QualityScoreRow';
import { ModuleStatsRow } from './ModuleStatsRow';
import { RecentSessionRow } from './RecentSessionRow';

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
