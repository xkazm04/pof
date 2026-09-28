'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { correlateModuleData } from '@/lib/evaluator/correlation-engine';
import { generateInsights } from '@/lib/evaluator/insight-generator';
import { computeProjectHealth } from '@/lib/evaluator/combined-health';
import { buildProducersBrief } from '@/lib/evaluator/brief-narrator';
import type { CorrelationResult } from '@/lib/evaluator/correlation-engine';
import type { CorrelatedInsight } from '@/lib/evaluator/insight-generator';
import type { ProjectHealthSummary } from '@/lib/evaluator/combined-health';
import type { AnalyticsDashboard } from '@/types/session-analytics';
import { buildModuleTopology } from '@/lib/topology/moduleGraph';
import { tryApiFetch } from '@/lib/api-utils';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleAggregates } from '@/hooks/useModuleAggregates';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { countAggregateRows } from '@/components/modules/shared/FeatureMatrix/matrixScope';
import { rankModuleLifts, topProjectLifts, type HealthLift } from '@/lib/evaluator/health-lifts';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { getAppOrigin } from '@/lib/constants';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { TaskFactory } from '@/lib/cli-task';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useNavigationStore } from '@/stores/navigationStore';
import type { SubModuleId } from '@/types/modules';
import type { TabId, ViewMode } from './types';

const NO_LIFTS: HealthLift[] = [];

export function useUnifiedSummaryView(onNavigateTab?: (tab: TabId) => void) {
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [isOwnLoading, setIsOwnLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const lastScan = useEvaluatorStore((s) => s.lastScan);

  // Cross-module statuses and the per-module roll-up both come from their ONE
  // shared path — this view mounts beside the other Evaluator dashboards, which
  // used to mean one full-table scan AND one roll-up query each.
  const { statusMap, isLoading: statusesLoading, loaded: statusesLoaded, error: statusesError } = useFeatureStatuses();
  const {
    aggregates, isLoading: aggLoading, loaded: aggLoaded, error: aggError,
    refresh: refreshFeatureData, scope,
  } = useModuleAggregates();

  // ── Fetch this view's own data source ──────────────────────────────────────

  const fetchOwn = useCallback(async () => {
    setIsOwnLoading(true);
    try {
      // The route returns the standard apiSuccess(...) envelope, so the real payload
      // lives at data.data.*. tryApiFetch unwraps it — reading off the raw fetch
      // silently left analytics empty or mis-shaped.
      const analyticsRes = await tryApiFetch<AnalyticsDashboard>('/api/session-analytics?action=dashboard');
      setAnalyticsError(analyticsRes.ok ? null : analyticsRes.error);
      if (analyticsRes.ok) setAnalytics(analyticsRes.data);
    } finally {
      setIsOwnLoading(false);
    }
  }, []);

  const fetchAll = useCallback(() => {
    // One call invalidates both feature-matrix caches (statuses + aggregates).
    refreshFeatureData();
    fetchOwn();
  }, [fetchOwn, refreshFeatureData]);

  useEffect(() => {
    fetchOwn();
  }, [fetchOwn]);

  const isLoading = isOwnLoading || (aggLoading && !aggLoaded) || (statusesLoading && !statusesLoaded);
  // A source that FAILED is not a source that is empty. The health composite
  // treats a missing input as a zero, so an unreported failure reads as a
  // genuinely unhealthy project — surface the reason instead.
  const error = aggError ?? statusesError ?? analyticsError;

  // ── Compute dependency blocked/count maps ──────────────────────────────────

  // Per-module blocked-feature and cross-module-dependency counts come from the
  // ONE module-topology projection (the Dependencies / Nexus graphs read it too).
  const { depBlockedMap, depCountMap } = useMemo(() => {
    const { nodes } = buildModuleTopology(statusMap);
    return {
      depBlockedMap: new Map(nodes.map((n) => [n.moduleId as string, n.blockedCount])),
      depCountMap: new Map(nodes.map((n) => [n.moduleId as string, n.crossDepCount])),
    };
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

  const brief = useMemo(
    () => buildProducersBrief(insights, health),
    [insights, health],
  );

  // ── Lift plans: points per fix, priced with the breakdown's own weights ─────

  const liftsByModule = useMemo(() => {
    const byId = new Map(correlation.modules.map((c) => [c.moduleId, c]));
    const n = health.moduleScores.length;
    return new Map(health.moduleScores.map((ms) => [ms.moduleId as string, rankModuleLifts(ms, byId.get(ms.moduleId), n)]));
  }, [health, correlation]);

  const topLifts = useMemo(
    () => topProjectLifts(health.moduleScores, correlation.modules, 3),
    [health, correlation],
  );

  const toggleModule = useCallback((moduleId: string) => {
    setSelectedModuleId((cur) => (cur === moduleId ? null : moduleId));
  }, []);

  // The Review remedy dispatches the module's feature-review through the standard
  // useModuleCLI door (spend preflight, project context, analytics) — on click only.
  const { execute, isRunning: isReviewing } = useModuleCLI({
    moduleId: 'core-engine' as SubModuleId,
    sessionKey: 'unified-summary-review',
    label: 'Health Review',
    accentColor: MODULE_COLORS.evaluator,
  });

  const actOnLift = useCallback((lift: HealthLift) => {
    const action = lift.action;
    if (action.kind === 'open-tab') {
      onNavigateTab?.(action.tab);
    } else if (action.kind === 'open-module') {
      useNavigationStore.getState().navigateToModule(action.moduleId);
    } else {
      const defs = MODULE_FEATURE_DEFINITIONS[action.moduleId] ?? [];
      if (defs.length === 0) return;
      void execute(TaskFactory.featureReview(action.moduleId, lift.label, defs, getAppOrigin(), `${lift.label} Review`));
    }
  }, [execute, onNavigateTab]);

  // ── Data source availability badges ────────────────────────────────────────

  const sourceStatus = useMemo(() => ({
    quality: aggregates.length > 0,
    dependencies: statusMap.size > 0,
    analytics: analytics !== null && analytics.totalSessions > 0,
    scanner: lastScan !== null,
  }), [aggregates, statusMap, analytics, lastScan]);

  const activeSources = Object.values(sourceStatus).filter(Boolean).length;

  return {
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
    /** Per scored module: its ranked lifts (dimensions losing points, with remedies). */
    liftsByModule,
    /** The project's biggest levers across all scored modules. */
    topLifts,
    selectedModuleId,
    selectedLifts: (selectedModuleId && liftsByModule.get(selectedModuleId)) || NO_LIFTS,
    toggleModule,
    actOnLift,
    isReviewing,
    /** What the project scope let the feature-matrix half of this composite see. */
    scope,
    /** The roll-up's own row count, for the scope banner's empty-view escalation. */
    scopedRows: countAggregateRows(aggregates),
  };
}
