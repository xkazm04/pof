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
import { MODULE_FEATURE_DEFINITIONS, buildDependencyMap, computeBlockers } from '@/lib/feature-definitions';
import { tryApiFetch } from '@/lib/api-utils';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleAggregates } from '@/hooks/useModuleAggregates';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import type { ViewMode } from './types';

export function useUnifiedSummaryView() {
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [isOwnLoading, setIsOwnLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');

  const lastScan = useEvaluatorStore((s) => s.lastScan);

  // Cross-module statuses and the per-module roll-up both come from their ONE
  // shared path — this view mounts beside the other Evaluator dashboards, which
  // used to mean one full-table scan AND one roll-up query each.
  const { statusMap, isLoading: statusesLoading, loaded: statusesLoaded, error: statusesError } = useFeatureStatuses();
  const {
    aggregates, isLoading: aggLoading, loaded: aggLoaded, error: aggError,
    refresh: refreshFeatureData,
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

  const brief = useMemo(
    () => buildProducersBrief(insights, health),
    [insights, health],
  );

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
  };
}
