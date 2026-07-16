import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { runDeepEval, runSingleModuleEval, cancelDeepEval } from '@/lib/evaluator/deep-eval-engine';
import { generateFixPlan, generateBatchFixPlan } from '@/lib/evaluator/fix-plan-generator';
import { getEvaluableModuleIds } from '@/lib/evaluator/module-eval-prompts';
import type { EvalProgress, DeepEvalResult } from '@/lib/evaluator/deep-eval-engine';
import { aggregateFindings } from '@/lib/evaluator/finding-collector';
import type { EvalFinding, ScanFindings, ModuleFindings } from '@/lib/evaluator/finding-collector';
import { diffScans, mergeBaseline } from '@/lib/evaluator/regression-diff';
import type { RegressionDiff } from '@/lib/evaluator/regression-diff';
import type { AttributionMap } from '@/lib/evaluator/git-attribution';
import type { SubModuleId } from '@/types/modules';
import { useProjectStore } from '@/stores/projectStore';
import { useDeepEvalStore } from '@/stores/deepEvalStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { apiFetch, tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { PersistedScan } from '@/lib/evaluator/evaluator-results-db';
import { EVAL_ACCENT } from './constants';

export function useDeepEvalResults() {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const [progress, setProgress] = useState<EvalProgress | null>(null);
  const [result, setResult] = useState<DeepEvalResult | null>(null);
  const [diff, setDiff] = useState<RegressionDiff | null>(null);
  const [view, setView] = useState<'new' | 'all'>('all');
  const [attribution, setAttribution] = useState<AttributionMap>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set(getEvaluableModuleIds()));
  const [showModuleSelector, setShowModuleSelector] = useState(false);

  const fixCli = useModuleCLI({
    moduleId: 'ai-behavior',
    sessionKey: 'deep-eval-fix',
    label: 'Deep Eval Fix',
    accentColor: EVAL_ACCENT,
  });

  // Which finding/module the in-flight fix targets, so only THAT row/button
  // shows the running spinner (not every Fix button on the page). Module batch
  // fixes are keyed `module:<id>`; single findings by their finding id.
  const [fixTargetId, setFixTargetId] = useState<string | null>(null);
  // Clear the target once the shared CLI finishes.
  useEffect(() => {
    if (!fixCli.isRunning) setFixTargetId(null);
  }, [fixCli.isRunning]);

  const isRunning = progress?.status === 'running';

  // ── Baseline hydration ──────────────────────────────────────────────────────

  // localStorage is the fast baseline cache; when it's empty (fresh browser /
  // cleared storage) fall back to the durable server history so regression
  // diffing still has a baseline. One-shot: never overwrites a present cache.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (useDeepEvalStore.getState().lastScan) return; // cache already warm

    let cancelled = false;
    void (async () => {
      const res = await tryApiFetch<{ scan: PersistedScan | null }>('/api/evaluator/results?latest=1');
      if (cancelled || !res.ok || !res.data.scan) return;
      // Re-check under the async gap — a scan may have completed meanwhile.
      if (useDeepEvalStore.getState().lastScan) return;
      const s = res.data.scan;
      useDeepEvalStore.getState().recordScan({
        scanId: s.scanId,
        timestamp: s.timestamp,
        findings: s.findings,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Result processing ───────────────────────────────────────────────────────

  /**
   * Apply a completed scan: diff it against the persisted previous scan to tag
   * findings NEW/PERSISTING/RESOLVED, default to the New-issues view, record the
   * merged baseline for next time, and attribute NEW findings to recent commits.
   */
  const applyScanResult = useCallback(
    async (evalResult: DeepEvalResult, opts?: { expandModule?: SubModuleId }) => {
      setResult(evalResult);

      const currentFlat = evalResult.findings.modules.flatMap((m) => m.findings);
      // "In scope" must mean "successfully evaluated": a module whose passes
      // errored produced zero findings because it FAILED, not because it is
      // clean — merging it would wipe its baseline and report every prior
      // finding as falsely RESOLVED.
      const scope = evalResult.modulesEvaluated.filter(
        (m) => !evalResult.failedModules.includes(m),
      );
      const previous = useDeepEvalStore.getState().lastScan;

      const d = diffScans(previous?.findings ?? null, currentFlat, { scopeModuleIds: scope });
      setDiff(d);
      // Regressions are the point — open on the New-issues view when there's a
      // baseline and something new actually appeared; otherwise show everything.
      setView(d.hasPrevious && d.summary.newTotal > 0 ? 'new' : 'all');
      setAttribution({});

      // Persist the merged baseline (untouched modules keep their prior findings).
      const mergedBaseline = mergeBaseline(previous?.findings ?? null, currentFlat, scope);
      const completedAt = Date.now();
      useDeepEvalStore.getState().recordScan({
        scanId: evalResult.scanId,
        timestamp: completedAt,
        findings: mergedBaseline,
      });

      // Durably persist the completed scan server-side (findings + module set +
      // timings), so history survives re-scans/reloads and the Game Director can
      // read it. localStorage stays the fast baseline cache; this is best-effort.
      void apiFetch('/api/evaluator/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId: evalResult.scanId,
          projectId: projectPath ?? '',
          scannedAt: new Date(completedAt).toISOString(),
          durationMs: evalResult.duration,
          modulesEvaluated: scope,
          failedModules: evalResult.failedModules,
          findings: mergedBaseline,
        }),
      }).catch((err) => {
        logger.error('Failed to persist deep-eval scan result:', err);
      });

      // Auto-expand modules with critical/high findings (plus any forced one).
      const expanded = new Set<string>();
      for (const mod of evalResult.findings.modules) {
        if (mod.bySeverity.critical > 0 || mod.bySeverity.high > 0) expanded.add(mod.moduleId);
      }
      if (opts?.expandModule) expanded.add(opts.expandModule);
      setExpandedModules(expanded);

      // Attribute NEW findings to the commit(s) that touched their files since
      // the previous scan (best-effort; reuses git-log parsing server-side).
      if (d.hasPrevious && projectPath) {
        const newFiles = Array.from(
          new Set(d.tagged.filter((t) => t.status === 'new' && t.file).map((t) => t.file as string)),
        );
        if (newFiles.length > 0) {
          const since = previous?.timestamp ? new Date(previous.timestamp).toISOString() : null;
          try {
            const res = await apiFetch<{ attribution: AttributionMap }>('/api/evaluator/git-attribution', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectPath, files: newFiles, since }),
            });
            setAttribution(res.attribution ?? {});
          } catch {
            // Attribution is optional — leave it empty if git/the route fails.
          }
        }
      }
    },
    [projectPath],
  );

  // ── Run evaluation ─────────────────────────────────────────────────────────

  const handleRunEval = useCallback(async () => {
    if (isRunning) return;

    const moduleIds = Array.from(selectedModuleIds);
    if (moduleIds.length === 0) return;

    setResult(null);

    try {
      const evalResult = await runDeepEval({
        moduleIds,
        projectContext: { projectName, projectPath, ueVersion },
        projectPath,
        onProgress: setProgress,
      });
      await applyScanResult(evalResult);
    } catch (err) {
      console.error('Deep eval error:', err);
    }
  }, [isRunning, selectedModuleIds, projectName, projectPath, ueVersion, applyScanResult]);

  const handleRunSingle = useCallback(async (moduleId: SubModuleId) => {
    if (isRunning) return;

    setResult(null);

    try {
      const evalResult = await runSingleModuleEval(moduleId, {
        projectContext: { projectName, projectPath, ueVersion },
        projectPath,
        onProgress: setProgress,
      });
      await applyScanResult(evalResult, { expandModule: moduleId });
    } catch (err) {
      console.error('Single module eval error:', err);
    }
  }, [isRunning, projectName, projectPath, ueVersion, applyScanResult]);

  const handleCancel = useCallback(() => {
    cancelDeepEval();
  }, []);

  // ── Fix handlers ───────────────────────────────────────────────────────────

  const handleFix = useCallback((finding: EvalFinding) => {
    const plan = generateFixPlan(finding, { projectName, projectPath, ueVersion });
    setFixTargetId(finding.id);
    fixCli.sendPrompt(plan.prompt);
  }, [fixCli, projectName, projectPath, ueVersion]);

  const handleBatchFix = useCallback((moduleFindings: ModuleFindings) => {
    const criticalAndHigh = moduleFindings.findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high',
    );
    const targets = criticalAndHigh.length > 0 ? criticalAndHigh : moduleFindings.findings.slice(0, 5);
    const plan = generateBatchFixPlan(targets, moduleFindings.moduleId, { projectName, projectPath, ueVersion });
    if (plan) {
      setFixTargetId(`module:${moduleFindings.moduleId}`);
      fixCli.sendPrompt(plan.prompt);
    }
  }, [fixCli, projectName, projectPath, ueVersion]);

  // ── Toggle helpers ─────────────────────────────────────────────────────────

  const toggleModule = (moduleId: SubModuleId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleSelectedModule = (moduleId: SubModuleId) => {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  // ── Derived view ─────────────────────────────────────────────────────────

  // Re-aggregate just the NEW findings into a module tree for the New-issues view.
  const newAggregated = useMemo<ScanFindings | null>(() => {
    if (!diff || !result) return null;
    const news = diff.tagged.filter((t) => t.status === 'new');
    return aggregateFindings(news, result.scanId);
  }, [diff, result]);

  const activeFindings: ScanFindings | null =
    view === 'new' && newAggregated ? newAggregated : result?.findings ?? null;
  // Only badge findings NEW/PERSISTING once we have a real baseline to compare to.
  const taggingActive = diff?.hasPrevious ?? false;

  return {
    progress,
    result,
    diff,
    view,
    setView,
    attribution,
    expandedModules,
    expandedCategories,
    selectedModuleIds,
    setSelectedModuleIds,
    showModuleSelector,
    setShowModuleSelector,
    fixCli,
    fixTargetId,
    isRunning,
    handleRunEval,
    handleRunSingle,
    handleCancel,
    handleFix,
    handleBatchFix,
    toggleModule,
    toggleCategory,
    toggleSelectedModule,
    activeFindings,
    taggingActive,
  };
}
