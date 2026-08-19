'use client';

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
import { BriefView } from '@/components/modules/evaluator/BriefView';
import { InsightCard } from '@/components/modules/evaluator/InsightCard';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { MatrixScopeBanner } from '@/components/modules/shared/FeatureMatrix/MatrixScopeBanner';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, ACCENT_VIOLET, MODULE_COLORS } from '@/lib/chart-colors';
import type { Props } from './types';
import { useUnifiedSummaryView } from './useUnifiedSummaryView';
import { ViewModeToggle } from './ViewModeToggle';
import { CombinedHealthGauge } from './CombinedHealthGauge';
import { DimensionBar } from './DimensionBar';
import { SourceBadge } from './SourceBadge';
import { ModuleHealthCell } from './ModuleHealthCell';
import { QuickNavCard } from './QuickNavCard';

export type { TabId, Props, ViewMode } from './types';

// ─── Component ───────────────────────────────────────────────────────────────

export function UnifiedSummaryView({ onNavigateTab }: Props) {
  const {
    aggregates,
    analytics,
    statusMap,
    isLoading,
    error,
    viewMode,
    setViewMode,
    lastScan,
    fetchAll,
    correlation,
    insights,
    health,
    brief,
    sourceStatus,
    activeSources,
    scope,
    scopedRows,
  } = useUnifiedSummaryView();

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
      {/* A source that failed to load is reported, not folded into the composite
          as a zero — an unreported failure reads as a genuinely unhealthy (or
          never-reviewed) project. Rendered in both view modes. */}
      {error && (
        <InlineErrorRetry message={`Some project data couldn't be loaded — ${error}`} onRetry={fetchAll} />
      )}

      {/* The composite folds a missing feature-matrix input in as a zero, so rows
          held by ANOTHER project depress the health gauge exactly like an
          unreviewed project would. Rendered in both view modes, above the gauge. */}
      <MatrixScopeBanner scope={scope} visibleRows={scopedRows} testId="pof-unified-summary-scope" />

      {/* ── View-mode toggle (Detailed engineer view vs Brief stakeholder view) ── */}
      <div className="flex items-center justify-between">
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        {viewMode === 'brief' && (
          <button
            onClick={fetchAll}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
            title="Refresh all data"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {viewMode === 'brief' ? (
        <BriefView brief={brief} />
      ) : (
      <>
      {/* ── Combined Health Score ──────────────────────────────────────────── */}
      <div className="flex items-start gap-5">
        {/* Radial gauge */}
        <div className="flex-shrink-0">
          <CombinedHealthGauge score={health.overallScore} />
        </div>

        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2 mb-1.5">
            <Shield className="w-4 h-4" style={{ color: STATUS_ERROR }} />
            <h3 className="text-sm font-semibold text-text">Combined Project Health</h3>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mb-3">
            Weighted composite across quality ({Math.round(0.4 * 100)}%), dependencies ({Math.round(0.3 * 100)}%), coverage ({Math.round(0.2 * 100)}%), and activity ({Math.round(0.1 * 100)}%).
            {health.topWeakness && (
              <> Weakest area: <span className="font-medium" style={{ color: STATUS_WARNING }}>{health.topWeakness}</span>.</>
            )}
          </p>

          {/* Dimension bars */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <DimensionBar label="Quality" value={health.dimensionAverages.quality} icon={Activity} color={STATUS_ERROR} />
            <DimensionBar label="Dep Health" value={health.dimensionAverages.dependencyHealth} icon={Link2} color={STATUS_INFO} />
            <DimensionBar label="Coverage" value={health.dimensionAverages.coverage} icon={Zap} color={STATUS_SUCCESS} />
            <DimensionBar label="Activity" value={health.dimensionAverages.activity} icon={BarChart3} color={ACCENT_VIOLET} />
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
          <Sparkles className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />
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
            <Sparkles className="w-3.5 h-3.5" style={{ color: STATUS_WARNING }} />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Cross-Dashboard Insights
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              {criticalInsights.length > 0 && (
                <span className="text-2xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_ERROR}15`, color: STATUS_ERROR }}>
                  {criticalInsights.length} critical
                </span>
              )}
              {warningInsights.length > 0 && (
                <span className="text-2xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_WARNING}15`, color: STATUS_WARNING }}>
                  {warningInsights.length} warning
                </span>
              )}
              {positiveInsights.length > 0 && (
                <span className="text-2xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_SUCCESS}15`, color: STATUS_SUCCESS }}>
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
          color={STATUS_ERROR}
          sub={aggregates.length > 0 ? `${aggregates.length} modules` : 'No data'}
          onClick={() => onNavigateTab('quality')}
        />
        <QuickNavCard
          label="Dependencies"
          icon={Link2}
          color={STATUS_INFO}
          sub={statusMap.size > 0 ? `${statusMap.size} tracked` : 'No data'}
          onClick={() => onNavigateTab('dependencies')}
        />
        <QuickNavCard
          label="Session Analytics"
          icon={BarChart3}
          color={ACCENT_VIOLET}
          sub={analytics ? `${analytics.totalSessions} sessions` : 'No data'}
          onClick={() => onNavigateTab('analytics')}
        />
        <QuickNavCard
          label="Project Scanner"
          icon={Radar}
          color={MODULE_COLORS.evaluator}
          sub={lastScan ? `Score: ${lastScan.overallScore}` : 'No scan'}
          onClick={() => onNavigateTab('scanner')}
        />
      </div>

      {/* ── Empty state when no data ──────────────────────────────────────── */}
      {/* Only when the loads SUCCEEDED and found nothing. With an error in play
          the banner above is the truth; "run some reviews" would be a lie. */}
      {activeSources === 0 && !error && (
        <SurfaceCard level={3} className="p-8 text-center">
          <Shield className="w-10 h-10 mx-auto text-border-bright mb-3" />
          <h3 className="text-sm font-semibold text-text mb-2">No Evaluation Data Yet</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
            Run quality reviews, check dependencies, use the CLI, or scan your project to populate the unified dashboard with correlated insights.
          </p>
        </SurfaceCard>
      )}
      </>
      )}
    </div>
  );
}
