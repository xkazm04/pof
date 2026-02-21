'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  HeartPulse, RefreshCw, TrendingUp, TrendingDown, Minus,
  Target, BarChart3, Activity, Layers, CheckCircle2,
  AlertTriangle, XCircle, Clock, Zap, ChevronRight,
  ArrowUpRight, Gauge, Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useProjectHealthStore } from '@/stores/projectHealthStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import type {
  ModuleHealthSummary,
  ModuleHealthStatus,
  Milestone,
  VelocityPoint,
  QualityPoint,
  BurnChartPoint,
  SubsystemSignal,
} from '@/types/project-health';
import { ACCENT_EMERALD, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_NEUTRAL, OPACITY_10, OPACITY_20 } from '@/lib/chart-colors';

// ── Constants ───────────────────────────────────────────────────────────────

const EMPTY_MODULE_HEALTH: ModuleHealthSummary[] = [];
const EMPTY_MILESTONES: Milestone[] = [];
const EMPTY_VELOCITY: VelocityPoint[] = [];
const EMPTY_QUALITY: QualityPoint[] = [];
const EMPTY_BURN: BurnChartPoint[] = [];
const EMPTY_SIGNALS: SubsystemSignal[] = [];

const STATUS_COLORS: Record<ModuleHealthStatus, string> = {
  healthy: ACCENT_EMERALD,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
  'not-started': '#4b5563',
};

const STATUS_BADGE: Record<ModuleHealthStatus, 'success' | 'warning' | 'error' | 'default'> = {
  healthy: 'success',
  warning: 'warning',
  critical: 'error',
  'not-started': 'default',
};

const SIGNAL_COLORS: Record<string, string> = {
  healthy: ACCENT_EMERALD,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
  inactive: STATUS_NEUTRAL,
};

type ViewTab = 'overview' | 'velocity' | 'quality' | 'milestones';

// ── Main Component ──────────────────────────────────────────────────────────

export function HolisticHealthView() {
  const summary = useProjectHealthStore((s) => s.summary);
  const moduleHealth = useProjectHealthStore((s) => s.moduleHealth) ?? EMPTY_MODULE_HEALTH;
  const velocityHistory = useProjectHealthStore((s) => s.velocityHistory) ?? EMPTY_VELOCITY;
  const qualityHistory = useProjectHealthStore((s) => s.qualityHistory) ?? EMPTY_QUALITY;
  const milestones = useProjectHealthStore((s) => s.milestones) ?? EMPTY_MILESTONES;
  const burnChart = useProjectHealthStore((s) => s.burnChart) ?? EMPTY_BURN;
  const subsystemSignals = useProjectHealthStore((s) => s.subsystemSignals) ?? EMPTY_SIGNALS;
  const isLoading = useProjectHealthStore((s) => s.isLoading);
  const error = useProjectHealthStore((s) => s.error);
  const fetchHealth = useProjectHealthStore((s) => s.fetchHealth);

  const checklistProgress = useModuleStore((s) => s.checklistProgress);
  const scanHistory = useEvaluatorStore((s) => s.scanHistory);
  const lastScan = useEvaluatorStore((s) => s.lastScan);

  const [viewTab, setViewTab] = useState<ViewTab>('overview');

  const handleRefresh = useCallback(() => {
    fetchHealth(checklistProgress, scanHistory, lastScan);
  }, [fetchHealth, checklistProgress, scanHistory, lastScan]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  const trendIcon = useMemo(() => {
    if (!summary) return null;
    if (summary.qualityTrend === 'improving') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
    if (summary.qualityTrend === 'declining') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
    if (summary.qualityTrend === 'stable') return <Minus className="w-3.5 h-3.5 text-text-muted" />;
    return null;
  }, [summary]);

  const healthyModules = moduleHealth.filter((m) => m.status === 'healthy').length;
  const warningModules = moduleHealth.filter((m) => m.status === 'warning').length;
  const criticalModules = moduleHealth.filter((m) => m.status === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text">Project Health Dashboard</h2>
            <p className="text-2xs text-text-muted mt-0.5">
              Unified view of completion, quality, velocity, and milestone predictions
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
        >
          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            <div className="space-y-4">
              {/* Module Heatmap */}
              <SurfaceCard>
                <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Module Health Heatmap
                </h3>
                <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
                  {moduleHealth.map((m) => (
                    <ModuleHeatCell key={m.moduleId} module={m} />
                  ))}
                </div>
              </SurfaceCard>

              {/* Milestone predictions */}
              <SurfaceCard>
                <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  Milestone Predictions
                </h3>
                <div className="space-y-2.5">
                  {milestones.map((ms) => (
                    <MilestoneRow key={ms.id} milestone={ms} />
                  ))}
                </div>
              </SurfaceCard>

              {/* Subsystem signals */}
              <SurfaceCard>
                <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  Subsystem Status
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {subsystemSignals.map((s) => (
                    <SignalCard key={s.subsystem} signal={s} />
                  ))}
                </div>
              </SurfaceCard>
            </div>
          )}

          {/* ── Velocity Tab ───────────────────────────────────────── */}
          {viewTab === 'velocity' && (
            <div className="space-y-4">
              <SurfaceCard>
                <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  Weekly Velocity (Items Completed)
                </h3>
                <BarChartSimple data={velocityHistory.map((v) => ({ label: v.weekLabel, value: v.itemsCompleted }))} color={STATUS_INFO} />
              </SurfaceCard>

              <SurfaceCard>
                <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  Cumulative Progress (Burnup)
                </h3>
                <AreaChartSimple
                  data={burnChart.map((b) => ({
                    label: b.weekLabel,
                    completed: b.completed,
                    ideal: summary.totalChecklistItems - b.idealRemaining,
                  }))}
                  total={summary.totalChecklistItems}
                />
              </SurfaceCard>
            </div>
          )}

          {/* ── Quality Tab ────────────────────────────────────────── */}
          {viewTab === 'quality' && (
            <div className="space-y-4">
              <SurfaceCard>
                <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  Quality Score Trend
                </h3>
                <LineChartSimple data={qualityHistory.map((q) => ({ label: q.label, value: q.overallScore }))} color={ACCENT_EMERALD} />
              </SurfaceCard>

              <SurfaceCard>
                <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Issues Trend
                </h3>
                <div className="space-y-1.5">
                  {qualityHistory.map((q) => (
                    <div key={q.label} className="flex items-center gap-3">
                      <span className="text-2xs text-text-muted w-14">{q.label}</span>
                      <div className="flex-1 flex items-center gap-2">
                        {q.criticalIssues > 0 && (
                          <span className="text-2xs text-red-400">{q.criticalIssues} critical</span>
                        )}
                        {q.highIssues > 0 && (
                          <span className="text-2xs text-amber-400">{q.highIssues} high</span>
                        )}
                        {q.criticalIssues === 0 && q.highIssues === 0 && (
                          <span className="text-2xs text-emerald-400">No issues</span>
                        )}
                      </div>
                      <ProgressRing value={q.overallScore} size={24} strokeWidth={2.5} color={q.overallScore >= 70 ? ACCENT_EMERALD : STATUS_WARNING} />
                    </div>
                  ))}
                </div>
              </SurfaceCard>
            </div>
          )}

          {/* ── Milestones Tab ─────────────────────────────────────── */}
          {viewTab === 'milestones' && (
            <div className="space-y-4">
              {/* Burndown chart */}
              <SurfaceCard>
                <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-blue-400" />
                  Burndown Chart
                </h3>
                <BurndownChart data={burnChart} total={summary.totalChecklistItems} />
              </SurfaceCard>

              {/* Detailed milestone cards */}
              <div className="grid grid-cols-2 gap-3">
                {milestones.map((ms) => (
                  <MilestoneDetailCard key={ms.id} milestone={ms} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SubTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-emerald-400" />}
    </button>
  );
}

function ModuleHeatCell({ module: m }: { module: ModuleHealthSummary }) {
  return (
    <div
      className="rounded-lg border p-2.5 transition-all hover:ring-1"
      style={{
        borderColor: `${STATUS_COLORS[m.status]}30`,
        backgroundColor: `${STATUS_COLORS[m.status]}08`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs font-medium text-text truncate">{m.label}</span>
        <Badge variant={STATUS_BADGE[m.status]}>{m.status === 'not-started' ? 'N/A' : `${m.healthScore}`}</Badge>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${m.checklistCompletion}%`,
            backgroundColor: STATUS_COLORS[m.status],
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-text-muted">{m.checklistCompletion}% done</span>
        {m.issueCount > 0 && <span className="text-[10px] text-amber-400">{m.issueCount} issues</span>}
      </div>
    </div>
  );
}

function MilestoneRow({ milestone: ms }: { milestone: Milestone }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ms.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text">{ms.name}</span>
          <Badge variant={ms.currentProgress >= 100 ? 'success' : 'default'}>
            {ms.currentProgress >= 100 ? 'Done' : `${ms.currentProgress}%`}
          </Badge>
        </div>
        <div className="h-1.5 bg-surface rounded-full overflow-hidden mt-1">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, ms.currentProgress)}%`, backgroundColor: ms.color }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        {ms.predictedWeeks !== null ? (
          ms.predictedWeeks === 0 ? (
            <span className="text-2xs text-emerald-400">Achieved</span>
          ) : (
            <div>
              <span className="text-xs font-medium text-text">{ms.predictedWeeks}w</span>
              <p className="text-[10px] text-text-muted">
                {ms.predictedDate ? new Date(ms.predictedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
              </p>
            </div>
          )
        ) : (
          <span className="text-2xs text-text-muted">—</span>
        )}
      </div>
    </div>
  );
}

function MilestoneDetailCard({ milestone: ms }: { milestone: Milestone }) {
  const isAchieved = ms.predictedWeeks !== null && ms.predictedWeeks === 0;
  return (
    <SurfaceCard level={2}>
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${ms.color}15` }}>
          {isAchieved ? (
            <CheckCircle2 className="w-4 h-4" style={{ color: ms.color }} />
          ) : (
            <Target className="w-4 h-4" style={{ color: ms.color }} />
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-text">{ms.name}</p>
          <p className="text-2xs text-text-muted mt-0.5">{ms.targetCompletion}% completion target</p>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, ms.currentProgress)}%`, backgroundColor: ms.color }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xs text-text-muted">{ms.currentProgress}% progress</span>
            {ms.predictedWeeks !== null && ms.predictedWeeks > 0 && (
              <span className="text-2xs font-medium flex items-center gap-0.5" style={{ color: ms.color }}>
                <Clock className="w-3 h-3" />
                {ms.predictedWeeks} weeks
              </span>
            )}
            {isAchieved && (
              <Badge variant="success">Achieved</Badge>
            )}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function SignalCard({ signal: s }: { signal: SubsystemSignal }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SIGNAL_COLORS[s.status] }} />
        <span className="text-2xs font-medium text-text">{s.label}</span>
      </div>
      <p className="text-[10px] text-text-muted">{s.metric}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{s.detail}</p>
    </div>
  );
}

// ── Simple Chart Components (CSS-based, no chart library) ───────────────────

function BarChartSimple({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] text-text-muted">{d.value}</span>
          <div className="w-full bg-surface rounded-t relative" style={{ height: '100%' }}>
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t transition-all"
              style={{ height: `${(d.value / max) * 100}%`, backgroundColor: color, minHeight: d.value > 0 ? 4 : 0 }}
            />
          </div>
          <span className="text-[10px] text-text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function LineChartSimple({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const h = 120;

  return (
    <div className="relative" style={{ height: h + 24 }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((pct) => (
        <div
          key={pct}
          className="absolute left-0 right-0 border-t border-border/30"
          style={{ top: h - (pct / 100) * h }}
        />
      ))}
      {/* Points and lines */}
      <svg className="absolute inset-0" viewBox={`0 0 ${data.length * 60} ${h}`} preserveAspectRatio="none">
        {/* Line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={data
            .map((d, i) => `${i * 60 + 30},${h - ((d.value - min) / range) * (h - 16) - 8}`)
            .join(' ')}
        />
        {/* Dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={i * 60 + 30}
            cy={h - ((d.value - min) / range) * (h - 16) - 8}
            r="3"
            fill={color}
          />
        ))}
      </svg>
      {/* Labels */}
      <div className="absolute left-0 right-0 flex justify-around" style={{ top: h + 4 }}>
        {data.map((d) => (
          <span key={d.label} className="text-[10px] text-text-muted">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

function AreaChartSimple({ data, total }: { data: { label: string; completed: number; ideal: number }[]; total: number }) {
  if (data.length === 0) return null;
  const h = 120;
  const w = data.length * 60;

  return (
    <div className="relative" style={{ height: h + 24 }}>
      <svg className="absolute inset-0" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Ideal line (dashed) */}
        <polyline
          fill="none"
          stroke={STATUS_NEUTRAL}
          strokeWidth="1.5"
          strokeDasharray="4,3"
          points={data.map((d, i) => `${i * 60 + 30},${h - (d.ideal / total) * (h - 16) - 8}`).join(' ')}
        />
        {/* Completed area */}
        <polygon
          fill={`${ACCENT_EMERALD}${OPACITY_20}`}
          stroke={ACCENT_EMERALD}
          strokeWidth="2"
          points={[
            `${30},${h - 8}`,
            ...data.map((d, i) => `${i * 60 + 30},${h - (d.completed / total) * (h - 16) - 8}`),
            `${(data.length - 1) * 60 + 30},${h - 8}`,
          ].join(' ')}
        />
      </svg>
      <div className="absolute left-0 right-0 flex justify-around" style={{ top: h + 4 }}>
        {data.map((d) => (
          <span key={d.label} className="text-[10px] text-text-muted">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

function BurndownChart({ data, total }: { data: BurnChartPoint[]; total: number }) {
  if (data.length === 0) return null;
  const h = 120;
  const w = data.length * 60;

  return (
    <div className="relative" style={{ height: h + 24 }}>
      <svg className="absolute inset-0" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Ideal burndown (dashed) */}
        <polyline
          fill="none"
          stroke={STATUS_NEUTRAL}
          strokeWidth="1.5"
          strokeDasharray="4,3"
          points={data.map((d, i) => `${i * 60 + 30},${(d.idealRemaining / total) * (h - 16) + 8}`).join(' ')}
        />
        {/* Actual remaining */}
        <polyline
          fill="none"
          stroke={STATUS_INFO}
          strokeWidth="2"
          points={data.map((d, i) => `${i * 60 + 30},${(d.remaining / total) * (h - 16) + 8}`).join(' ')}
        />
        {/* Dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={i * 60 + 30}
            cy={(d.remaining / total) * (h - 16) + 8}
            r="3"
            fill={STATUS_INFO}
          />
        ))}
      </svg>
      <div className="absolute left-0 right-0 flex justify-around" style={{ top: h + 4 }}>
        {data.map((d) => (
          <span key={d.weekLabel} className="text-[10px] text-text-muted">{d.weekLabel}</span>
        ))}
      </div>
      {/* Legend */}
      <div className="absolute top-1 right-1 flex items-center gap-3">
        <span className="text-[10px] text-text-muted flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-400 inline-block rounded" /> Actual
        </span>
        <span className="text-[10px] text-text-muted flex items-center gap-1">
          <span className="w-3 h-0.5 bg-gray-500 inline-block rounded border-dashed" style={{ borderTop: `1.5px dashed ${STATUS_NEUTRAL}` }} /> Ideal
        </span>
      </div>
    </div>
  );
}
