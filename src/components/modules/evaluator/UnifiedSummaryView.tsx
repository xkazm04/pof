'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Link2,
  Loader2,
  Radar,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { correlateModuleData } from '@/lib/evaluator/correlation-engine';
import { generateInsights } from '@/lib/evaluator/insight-generator';
import { computeProjectHealth } from '@/lib/evaluator/combined-health';
import type { CorrelationResult } from '@/lib/evaluator/correlation-engine';
import type { CorrelatedInsight } from '@/lib/evaluator/insight-generator';
import type { ProjectHealthSummary, HealthBreakdown } from '@/lib/evaluator/combined-health';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';
import type { AnalyticsDashboard } from '@/types/session-analytics';
import type { EvaluatorReport } from '@/types/evaluator';
import { MODULE_FEATURE_DEFINITIONS, buildDependencyMap, computeBlockers } from '@/lib/feature-definitions';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { InsightCard } from './InsightCard';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = 'quality' | 'dependencies' | 'analytics' | 'scanner';

interface Props {
  onNavigateTab: (tab: TabId) => void;
}

// ─── Score coloring ──────────────────────────────────────────────────────────

function healthColor(score: number): string {
  if (score >= 70) return '#4ade80';
  if (score >= 45) return '#fbbf24';
  if (score >= 25) return '#fb923c';
  return '#f87171';
}

function healthBg(score: number): string {
  if (score >= 70) return '#4ade8010';
  if (score >= 45) return '#fbbf2410';
  if (score >= 25) return '#fb923c10';
  return '#f8717110';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UnifiedSummaryView({ onNavigateTab }: Props) {
  const [aggregates, setAggregates] = useState<ModuleAggregate[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const lastScan = useEvaluatorStore((s) => s.lastScan);

  // ── Fetch all data sources in parallel ─────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [aggRes, analyticsRes, statusRes] = await Promise.all([
        fetch('/api/feature-matrix/aggregate'),
        fetch('/api/session-analytics?action=dashboard'),
        fetch('/api/feature-matrix/all-statuses'),
      ]);

      if (aggRes.ok) {
        const data = await aggRes.json();
        setAggregates(data.modules ?? []);
      }
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        const map = new Map<string, string>();
        for (const row of data.statuses ?? []) {
          map.set(`${row.moduleId}::${row.featureName}`, row.status);
        }
        setStatusMap(map);
      }
    } catch (err) {
      console.error('UnifiedSummaryView fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Compute dependency blocked/count maps ──────────────────────────────────

  const { depBlockedMap, depCountMap } = useMemo(() => {
    const base = buildDependencyMap();
    const resolved = computeBlockers(base, statusMap);

    const blocked = new Map<string, number>();
    const counts = new Map<string, number>();

    for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
      let moduleBlocked = 0;
      let moduleDeps = 0;

      for (const feat of features) {
        const key = `${moduleId}::${feat.featureName}`;
        const info = resolved.get(key);
        if (!info) continue;

        // Cross-module deps
        const crossDeps = info.deps.filter((d) => d.moduleId !== moduleId);
        moduleDeps += crossDeps.length;

        const status = statusMap.get(key) ?? 'unknown';
        if (info.isBlocked && status !== 'implemented') {
          moduleBlocked++;
        }
      }

      blocked.set(moduleId, moduleBlocked);
      counts.set(moduleId, moduleDeps);
    }

    return { depBlockedMap: blocked, depCountMap: counts };
  }, [statusMap]);

  // ── Run correlation engine ─────────────────────────────────────────────────

  const correlation: CorrelationResult = useMemo(
    () => correlateModuleData(aggregates, analytics, lastScan, depBlockedMap, depCountMap),
    [aggregates, analytics, lastScan, depBlockedMap, depCountMap],
  );

  const insights: CorrelatedInsight[] = useMemo(
    () => generateInsights(correlation.modules),
    [correlation],
  );

  const health: ProjectHealthSummary = useMemo(
    () => computeProjectHealth(correlation.modules),
    [correlation],
  );

  // ── Data source availability badges ────────────────────────────────────────

  const sourceStatus = useMemo(() => ({
    quality: aggregates.length > 0,
    dependencies: statusMap.size > 0,
    analytics: analytics !== null && analytics.totalSessions > 0,
    scanner: lastScan !== null,
  }), [aggregates, statusMap, analytics, lastScan]);

  const activeSources = Object.values(sourceStatus).filter(Boolean).length;

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  const criticalInsights = insights.filter((i) => i.severity === 'critical');
  const warningInsights = insights.filter((i) => i.severity === 'warning');
  const positiveInsights = insights.filter((i) => i.severity === 'positive');

  return (
    <div className="space-y-5">
      {/* ── Combined Health Score ──────────────────────────────────────────── */}
      <div className="flex items-start gap-5">
        {/* Radial gauge */}
        <div className="flex-shrink-0">
          <CombinedHealthGauge score={health.overallScore} />
        </div>

        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2 mb-1.5">
            <Shield className="w-4 h-4 text-[#ef4444]" />
            <h3 className="text-sm font-semibold text-text">Combined Project Health</h3>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mb-3">
            Weighted composite across quality ({Math.round(0.4 * 100)}%), dependencies ({Math.round(0.3 * 100)}%), coverage ({Math.round(0.2 * 100)}%), and activity ({Math.round(0.1 * 100)}%).
            {health.topWeakness && (
              <> Weakest area: <span className="text-[#fbbf24] font-medium">{health.topWeakness}</span>.</>
            )}
          </p>

          {/* Dimension bars */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <DimensionBar label="Quality" value={health.dimensionAverages.quality} icon={Activity} color="#f87171" />
            <DimensionBar label="Dep Health" value={health.dimensionAverages.dependencyHealth} icon={Link2} color="#60a5fa" />
            <DimensionBar label="Coverage" value={health.dimensionAverages.coverage} icon={Zap} color="#4ade80" />
            <DimensionBar label="Activity" value={health.dimensionAverages.activity} icon={BarChart3} color="#a78bfa" />
          </div>
        </div>

        {/* Refresh + source badges */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button
            onClick={fetchAll}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
            title="Refresh all data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <SourceBadge label="Q" active={sourceStatus.quality} icon={Activity} />
            <SourceBadge label="D" active={sourceStatus.dependencies} icon={Link2} />
            <SourceBadge label="A" active={sourceStatus.analytics} icon={BarChart3} />
            <SourceBadge label="S" active={sourceStatus.scanner} icon={Radar} />
          </div>
          <span className="text-2xs text-text-muted">{activeSources}/4 sources</span>
        </div>
      </div>

      {/* ── Module Health Grid ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-[#ef4444]" />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Module Health Overview
          </span>
          <span className="text-2xs text-text-muted">
            {health.moduleScores.length} modules scored
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {health.moduleScores.map((ms, i) => (
            <ModuleHealthCell
              key={ms.moduleId}
              label={ms.label}
              breakdown={ms.breakdown}
              index={i}
              correlation={correlation.modules.find((c) => c.moduleId === ms.moduleId)}
            />
          ))}
        </div>
      </div>

      {/* ── Correlated Insights ───────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Cross-Dashboard Insights
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              {criticalInsights.length > 0 && (
                <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-[#f8717115] text-[#f87171]">
                  {criticalInsights.length} critical
                </span>
              )}
              {warningInsights.length > 0 && (
                <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-[#fbbf2415] text-[#fbbf24]">
                  {warningInsights.length} warning
                </span>
              )}
              {positiveInsights.length > 0 && (
                <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-[#4ade8015] text-[#4ade80]">
                  {positiveInsights.length} strong
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {insights.map((insight, i) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                index={i}
                onDrillDown={onNavigateTab}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Navigation ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        <QuickNavCard
          label="Quality Dashboard"
          icon={Activity}
          color="#f87171"
          sub={aggregates.length > 0 ? `${aggregates.length} modules` : 'No data'}
          onClick={() => onNavigateTab('quality')}
        />
        <QuickNavCard
          label="Dependencies"
          icon={Link2}
          color="#60a5fa"
          sub={statusMap.size > 0 ? `${statusMap.size} tracked` : 'No data'}
          onClick={() => onNavigateTab('dependencies')}
        />
        <QuickNavCard
          label="Session Analytics"
          icon={BarChart3}
          color="#a78bfa"
          sub={analytics ? `${analytics.totalSessions} sessions` : 'No data'}
          onClick={() => onNavigateTab('analytics')}
        />
        <QuickNavCard
          label="Project Scanner"
          icon={Radar}
          color="#ef4444"
          sub={lastScan ? `Score: ${lastScan.overallScore}` : 'No scan'}
          onClick={() => onNavigateTab('scanner')}
        />
      </div>

      {/* ── Empty state when no data ──────────────────────────────────────── */}
      {activeSources === 0 && (
        <SurfaceCard level={3} className="p-8 text-center">
          <Shield className="w-10 h-10 mx-auto text-border-bright mb-3" />
          <h3 className="text-sm font-semibold text-text mb-2">No Evaluation Data Yet</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
            Run quality reviews, check dependencies, use the CLI, or scan your project to populate the unified dashboard with correlated insights.
          </p>
        </SurfaceCard>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CombinedHealthGauge({ score }: { score: number }) {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const sweepAngle = 270;

  const polarToCart = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };

  const arcPath = (startDeg: number, endDeg: number, r: number) => {
    const start = polarToCart(startDeg, r);
    const end = polarToCart(endDeg, r);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const trackPath = arcPath(startAngle, startAngle + sweepAngle, radius);
  const clamped = Math.max(0, Math.min(100, score));
  const scoreEndAngle = startAngle + (clamped / 100) * sweepAngle;
  const scorePath = clamped > 0 ? arcPath(startAngle, scoreEndAngle, radius) : '';
  const color = healthColor(score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45 }}
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        <path d={trackPath} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} strokeLinecap="round" />
        {clamped > 0 && (
          <motion.path
            d={scorePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-bold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-2xs text-text-muted font-medium mt-0.5">/100</span>
      </div>
    </motion.div>
  );
}

function DimensionBar({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <span className="text-xs text-text-muted w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold w-7 text-right" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function SourceBadge({
  label,
  active,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  icon: typeof Activity;
}) {
  return (
    <div
      className="flex items-center justify-center w-6 h-6 rounded-md transition-colors"
      style={{
        backgroundColor: active ? 'var(--border)' : 'var(--surface-deep)',
        border: `1px solid ${active ? 'var(--border-bright)' : 'var(--border)'}`,
      }}
      title={`${label}: ${active ? 'Data available' : 'No data'}`}
    >
      <Icon
        className="w-3 h-3"
        style={{ color: active ? 'var(--text)' : '#3a3a5a' }}
      />
    </div>
  );
}

function ModuleHealthCell({
  label,
  breakdown,
  index,
  correlation,
}: {
  label: string;
  breakdown: HealthBreakdown;
  index: number;
  correlation: import('@/lib/evaluator/correlation-engine').ModuleCorrelation | undefined;
}) {
  const color = healthColor(breakdown.combined);
  const bg = healthBg(breakdown.combined);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, delay: index * 0.03 }}
      className="rounded-lg border border-border/60 p-3 transition-colors hover:border-border-bright"
      style={{ backgroundColor: bg }}
    >
      {/* Module name + score */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text truncate pr-2">
          {label}
        </span>
        <span
          className="text-xs font-bold flex-shrink-0"
          style={{ color }}
        >
          {breakdown.combined}
        </span>
      </div>

      {/* Mini dimension bars */}
      <div className="space-y-1">
        <MiniBar value={breakdown.quality} color="#f87171" label="Q" />
        <MiniBar value={breakdown.dependencyHealth} color="#60a5fa" label="D" />
        <MiniBar value={breakdown.coverage} color="#4ade80" label="C" />
        <MiniBar value={breakdown.activity} color="#a78bfa" label="A" />
      </div>
    </motion.div>
  );
}

function MiniBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs text-text-muted w-2 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-background/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-slow"
          style={{ width: `${value}%`, backgroundColor: color, opacity: 0.7 }}
        />
      </div>
    </div>
  );
}

function QuickNavCard({
  label,
  icon: Icon,
  color,
  sub,
  onClick,
}: {
  label: string;
  icon: typeof Activity;
  color: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border border-border bg-surface p-3 transition-all hover:border-border-bright hover:bg-[#15152e] group"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 transition-colors group-hover:brightness-125" style={{ color }} />
        <span className="text-xs font-semibold text-text">{label}</span>
      </div>
      <span className="text-xs text-text-muted">{sub}</span>
    </button>
  );
}
