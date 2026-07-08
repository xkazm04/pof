'use client';

import {
  HeartPulse, RefreshCw, XCircle, Zap, Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { ACCENT_EMERALD, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL, OPACITY_10 } from '@/lib/chart-colors';
import type { HolisticHealthViewProps } from './types';
import { useHolisticHealthView } from './useHolisticHealthView';
import { SubTab } from './SubTab';
import { PerformanceStatCard } from './PerformanceStatCard';
import { OverviewTab } from './OverviewTab';
import { VelocityTab } from './VelocityTab';
import { QualityTab } from './QualityTab';
import { MilestonesTab } from './MilestonesTab';

export type { HolisticHealthViewProps } from './types';

// ── Main Component ──────────────────────────────────────────────────────────

export function HolisticHealthView({ onNavigateTab }: HolisticHealthViewProps = {}) {
  const {
    summary,
    moduleHealth,
    velocityHistory,
    qualityHistory,
    milestones,
    burnChart,
    subsystemSignals,
    isLoading,
    error,
    perfTriage,
    perfSession,
    viewTab,
    setViewTab,
    handleRefresh,
    trendIcon,
    healthyModules,
    warningModules,
    criticalModules,
  } = useHolisticHealthView();

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        icon={HeartPulse}
        title="Project Health Dashboard"
        subtitle="Unified view of completion, quality, velocity, and milestone predictions"
        accent="emerald"
        variant="soft"
        size="md"
        action={
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        }
      />

      {/* Error */}
      {error && (
        <SurfaceCard level={2}>
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        </SurfaceCard>
      )}

      {/* Loading */}
      {isLoading && !summary && (
        <SurfaceCard>
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-emerald-400 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-text-muted">Computing project health...</p>
          </div>
        </SurfaceCard>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!summary && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4" style={{ backgroundColor: `${ACCENT_EMERALD}${OPACITY_10}` }}>
            <HeartPulse className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-text mb-1">No Health Data Yet</h3>
          <p className="text-xs text-text-muted max-w-xs leading-relaxed">
            Complete checklist items, run evaluator scans, and use CLI tasks to build your project health profile with velocity tracking and milestone predictions.
          </p>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 mt-4 px-4 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Compute Health
          </button>
        </div>
      )}

      {/* ── Top Stats Row ────────────────────────────────────────── */}
      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Overall completion */}
            <SurfaceCard level={2}>
              <div className="flex items-center gap-3">
                <ProgressRing
                  value={summary.overallCompletion}
                  size={48}
                  strokeWidth={5}
                  color={summary.overallCompletion >= 70 ? ACCENT_EMERALD : summary.overallCompletion >= 40 ? STATUS_WARNING : STATUS_ERROR}
                />
                <div>
                  <p className="text-2xs text-text-muted">Overall Completion</p>
                  <p className="text-lg font-bold text-text">{summary.overallCompletion}%</p>
                  <p className="text-2xs text-text-muted">{summary.completedChecklistItems}/{summary.totalChecklistItems} items</p>
                </div>
              </div>
            </SurfaceCard>

            {/* Quality score */}
            <SurfaceCard level={2}>
              <div className="flex items-center gap-3">
                <ProgressRing
                  value={summary.currentQualityScore ?? 0}
                  size={48}
                  strokeWidth={5}
                  color={
                    summary.currentQualityScore === null
                      ? STATUS_NEUTRAL
                      : summary.currentQualityScore >= 70
                        ? ACCENT_EMERALD
                        : summary.currentQualityScore >= 40
                          ? STATUS_WARNING
                          : STATUS_ERROR
                  }
                />
                <div>
                  <p className="text-2xs text-text-muted">Quality Score</p>
                  <p className="text-lg font-bold text-text">
                    {summary.currentQualityScore !== null ? summary.currentQualityScore : '—'}
                  </p>
                  <div className="flex items-center gap-1">
                    {trendIcon}
                    <span className="text-2xs text-text-muted">{summary.qualityTrend}</span>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            {/* Performance — fused from the latest profiling triage, drills into the Perf tab */}
            <PerformanceStatCard
              score={summary.performanceScore}
              bottleneck={perfTriage?.bottleneck ?? null}
              avgFPS={perfSession?.summary.avgFPS ?? null}
              onDrill={onNavigateTab ? () => onNavigateTab('perf') : undefined}
            />

            {/* Velocity */}
            <SurfaceCard level={2}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xs text-text-muted">Avg Velocity</p>
                  <p className="text-lg font-bold text-text">{summary.avgVelocity}</p>
                  <p className="text-2xs text-text-muted">items/week</p>
                </div>
              </div>
            </SurfaceCard>

            {/* Module health */}
            <SurfaceCard level={2}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xs text-text-muted">Module Health</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {healthyModules > 0 && <Badge variant="success">{healthyModules}</Badge>}
                    {warningModules > 0 && <Badge variant="warning">{warningModules}</Badge>}
                    {criticalModules > 0 && <Badge variant="error">{criticalModules}</Badge>}
                  </div>
                </div>
              </div>
            </SurfaceCard>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            <SubTab label="Overview" active={viewTab === 'overview'} onClick={() => setViewTab('overview')} />
            <SubTab label="Velocity" active={viewTab === 'velocity'} onClick={() => setViewTab('velocity')} />
            <SubTab label="Quality" active={viewTab === 'quality'} onClick={() => setViewTab('quality')} />
            <SubTab label="Milestones" active={viewTab === 'milestones'} onClick={() => setViewTab('milestones')} />
          </div>

          {/* ── Overview Tab ───────────────────────────────────────── */}
          {viewTab === 'overview' && (
            <OverviewTab
              moduleHealth={moduleHealth}
              milestones={milestones}
              subsystemSignals={subsystemSignals}
              onNavigateTab={onNavigateTab}
            />
          )}

          {/* ── Velocity Tab ───────────────────────────────────────── */}
          {viewTab === 'velocity' && (
            <VelocityTab velocityHistory={velocityHistory} burnChart={burnChart} summary={summary} />
          )}

          {/* ── Quality Tab ────────────────────────────────────────── */}
          {viewTab === 'quality' && (
            <QualityTab qualityHistory={qualityHistory} />
          )}

          {/* ── Milestones Tab ─────────────────────────────────────── */}
          {viewTab === 'milestones' && (
            <MilestonesTab burnChart={burnChart} summary={summary} milestones={milestones} />
          )}
        </>
      )}
    </div>
  );
}
