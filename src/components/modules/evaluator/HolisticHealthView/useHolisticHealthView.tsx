import { useEffect, useMemo, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useProjectHealthStore } from '@/stores/projectHealthStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import type {
  PerfHealthInput,
  CrashHealthInput,
} from '@/types/project-health';
import type { ViewTab } from './types';

export function useHolisticHealthView() {
  const summary = useProjectHealthStore((s) => s.summary);
  const moduleHealth = useProjectHealthStore((s) => s.moduleHealth);
  const velocityHistory = useProjectHealthStore((s) => s.velocityHistory);
  const qualityHistory = useProjectHealthStore((s) => s.qualityHistory);
  const milestones = useProjectHealthStore((s) => s.milestones);
  const burnChart = useProjectHealthStore((s) => s.burnChart);
  const subsystemSignals = useProjectHealthStore((s) => s.subsystemSignals);
  const isLoading = useProjectHealthStore((s) => s.isLoading);
  const error = useProjectHealthStore((s) => s.error);
  const fetchHealth = useProjectHealthStore((s) => s.fetchHealth);

  const checklistProgress = useModuleStore((s) => s.checklistProgress);
  const scanHistory = useEvaluatorStore((s) => s.scanHistory);
  const lastScan = useEvaluatorStore((s) => s.lastScan);

  // Performance triage (in-memory per session) + crash stats (server-persisted)
  // are the two specialist signals fused into the holistic summary.
  const perfTriage = usePerformanceProfilingStore((s) => s.triage);
  const perfSession = usePerformanceProfilingStore((s) => s.activeSession);
  const crashStats = useCrashAnalyzerStore((s) => s.stats);
  const fetchCrashAnalysis = useCrashAnalyzerStore((s) => s.fetchAnalysis);

  const [viewTab, setViewTab] = useState<ViewTab>('overview');

  // Pull persisted crash data once so the crash signal is real even when the
  // user hasn't opened the Crashes tab this session.
  useEffect(() => {
    fetchCrashAnalysis();
  }, [fetchCrashAnalysis]);

  const perfInput = useMemo<PerfHealthInput | null>(() => {
    if (!perfTriage) return null;
    return {
      overallScore: perfTriage.overallScore,
      bottleneck: perfTriage.bottleneck,
      avgFPS: perfSession?.summary.avgFPS ?? null,
      findingCount: perfTriage.findings.length,
      sessionName: perfSession?.name ?? null,
    };
  }, [perfTriage, perfSession]);

  const crashInput = useMemo<CrashHealthInput | null>(() => {
    if (crashStats.totalCrashes === 0 && crashStats.patternsDetected === 0) return null;
    return {
      totalCrashes: crashStats.totalCrashes,
      recentCrashes: crashStats.recentCrashes,
      criticalCrashes: crashStats.crashesBySeverity.critical,
      systemicIssues: crashStats.systemicIssues,
      mostAffectedModule: crashStats.mostAffectedModule,
    };
  }, [crashStats]);

  const handleRefresh = useCallback(() => {
    fetchHealth(checklistProgress, scanHistory, lastScan, perfInput, crashInput);
  }, [fetchHealth, checklistProgress, scanHistory, lastScan, perfInput, crashInput]);

  // The server result is a pure, deterministic function of exactly these five
  // inputs (see computeProjectHealth). `checklistProgress`/`scanHistory`/`lastScan`
  // are fresh object/array references on every store touch, so depending on their
  // identity re-POSTs even when their *values* are unchanged. Key the auto-fetch on
  // a primitive value-signature instead: it changes iff the POST body changes, so we
  // refetch exactly when the inputs that affect the output change — no missed refetch
  // (any genuine change alters the serialization) and no redundant ones (identity-only
  // churn no longer counts). `handleRefresh` is intentionally excluded; the signature
  // captures every value it reads.
  const inputsSignature = useMemo(
    () => JSON.stringify({ checklistProgress, scanHistory, lastScan, perfInput, crashInput }),
    [checklistProgress, scanHistory, lastScan, perfInput, crashInput],
  );

  useEffect(() => {
    handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsSignature]);

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

  return {
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
  };
}
