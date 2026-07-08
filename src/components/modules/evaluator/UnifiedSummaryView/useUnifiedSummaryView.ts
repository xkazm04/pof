'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { correlateModuleData } from '@/lib/evaluator/correlation-engine';
import { generateInsights } from '@/lib/evaluator/insight-generator';
import { computeProjectHealth } from '@/lib/evaluator/combined-health';
import { buildProducersBrief } from '@/lib/evaluator/brief-narrator';
import type { CorrelationResult } from '@/lib/evaluator/correlation-engine';
import type { CorrelatedInsight } from '@/lib/evaluator/insight-generator';
import type { ProjectHealthSummary } from '@/lib/evaluator/combined-health';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';
import type { AnalyticsDashboard } from '@/types/session-analytics';
import { MODULE_FEATURE_DEFINITIONS, buildDependencyMap, computeBlockers } from '@/lib/feature-definitions';
import { tryApiFetch } from '@/lib/api-utils';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import type { ViewMode } from './types';

export function useUnifiedSummaryView() {
  const [aggregates, setAggregates] = useState<ModuleAggregate[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');

  const lastScan = useEvaluatorStore((s) => s.lastScan);

  // ── Fetch all data sources in parallel ─────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      // All three routes return the standard apiSuccess(...) envelope, so the real
      // payload lives at data.data.*. tryApiFetch unwraps it — reading off the raw
      // fetch silently left aggregates/analytics/status all empty or mis-shaped.
      const [aggRes, analyticsRes, statusRes] = await Promise.all([
        tryApiFetch<{ modules: ModuleAggregate[] }>('/api/feature-matrix/aggregate'),
        tryApiFetch<AnalyticsDashboard>('/api/session-analytics?action=dashboard'),
        tryApiFetch<{ statuses: { moduleId: string; featureName: string; status: string }[] }>('/api/feature-matrix/all-statuses'),
      ]);

      if (aggRes.ok) setAggregates(aggRes.data.modules ?? []);
      if (analyticsRes.ok) setAnalytics(analyticsRes.data);
      if (statusRes.ok) {
        const map = new Map<string, string>();
        for (const row of statusRes.data.statuses ?? []) {
          map.set(`${row.moduleId}::${row.featureName}`, row.status);
        }
        setStatusMap(map);
      }
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
