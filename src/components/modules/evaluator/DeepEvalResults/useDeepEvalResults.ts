import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { generateFixPlan, generateBatchFixPlan } from '@/lib/evaluator/fix-plan-generator';
import { getEvaluableModuleIds } from '@/lib/evaluator/module-eval-prompts';
import type { EvalProgress, DeepEvalResult } from '@/lib/evaluator/deep-eval-engine';
import type { DeepEvalJobSnapshot } from '@/lib/evaluator/deep-eval-job';
import { UI_TIMEOUTS } from '@/lib/constants';
import { aggregateFindings } from '@/lib/evaluator/finding-collector';
import type { EvalFinding, ScanFindings, ModuleFindings } from '@/lib/evaluator/finding-collector';
import { diffScans, mergeBaseline } from '@/lib/evaluator/regression-diff';
import type { RegressionDiff } from '@/lib/evaluator/regression-diff';
import type { AttributionMap } from '@/lib/evaluator/git-attribution';
import type { SubModuleId } from '@/types/modules';
import { useProjectStore } from '@/stores/projectStore';
import { useDeepEvalStore, projectIdOf } from '@/stores/deepEvalStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { apiFetch, tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { PersistedScan } from '@/lib/evaluator/evaluator-results-db';
import { EVAL_ACCENT } from './constants';

function idleProgress(): EvalProgress {
  return {
    status: 'idle', currentModule: null, currentPass: null, completedSteps: 0,
    totalSteps: 0, passStatuses: {}, findings: [], error: null,
  };
}

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
  // The project a discarded baseline belonged to, when the last scan found a cached
  // baseline from a *different* project. Reported rather than silently diffed.
  const [discardedBaselineProject, setDiscardedBaselineProject] = useState<string | null>(null);

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
  // The target only means anything while the shared CLI is running — derive that
  // rather than clearing it from an effect (which cost a cascading render and was a
  // standing `react-hooks/set-state-in-effect` error).
  const activeFixTargetId = fixCli.isRunning ? fixTargetId : null;

  const isRunning = progress?.status === 'running';

  // ── Baseline hydration ──────────────────────────────────────────────────────

  // localStorage is the fast baseline cache; when it holds no baseline FOR THIS
  // PROJECT (fresh browser / cleared storage / project switch) fall back to the
  // durable server history, scoped to the same project. Runs once per project id:
  // never overwrites a warm cache, and a project switch re-hydrates for the new one.
  const hydratedForRef = useRef<string | null>(null);
  useEffect(() => {
    const projectId = projectIdOf(projectPath);
    if (hydratedForRef.current === projectId) return;
    hydratedForRef.current = projectId;
    if (useDeepEvalStore.getState().baselineFor(projectId)) return; // cache already warm for this project

    let cancelled = false;
    void (async () => {
      const res = await tryApiFetch<{ scan: PersistedScan | null }>(
        `/api/evaluator/results?latest=1&project=${encodeURIComponent(projectId)}`,
      );
      if (cancelled || !res.ok || !res.data.scan) return;
      // Re-check under the async gap — a scan may have completed meanwhile.
      if (useDeepEvalStore.getState().baselineFor(projectId)) return;
      const s = res.data.scan;
      // The query is scoped, but a baseline is a verdict input: verify the identity
      // the server returned rather than trusting the request we sent.
      if (projectIdOf(s.projectId) !== projectId) return;
      useDeepEvalStore.getState().recordScan({
        scanId: s.scanId,
        timestamp: s.timestamp,
        projectPath: projectId,
        findings: s.findings,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

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
      // A baseline belongs to exactly one project. One from a *different* project is
      // not a baseline at all — diffing against it would tag every finding of this
      // project NEW, every finding of the other RESOLVED, and blame this project's
      // commits for them. Discard it, report it, and start a fresh baseline here.
      const projectId = projectIdOf(projectPath);
      const cached = useDeepEvalStore.getState().lastScan;
      const previous = useDeepEvalStore.getState().baselineFor(projectId);
      setDiscardedBaselineProject(
        !previous && cached && typeof cached.projectPath === 'string' ? cached.projectPath : null,
      );

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
        projectPath: projectId,
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
          projectId,
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

  // ── Run evaluation (a server job: start, poll, reattach) ────────────────────

  // The scan runs server-side (`/api/evaluator/deep-eval`); this hook starts it,
  // polls its snapshot, and applies the result exactly once when it settles. Only
  // the Run buttons start a job — mounting (e.g. after a reload) only reattaches.
  // The job this tab follows, keyed by project so a project switch drops it.
  const [attached, setAttached] = useState<{ projectPath: string; scanId: string } | null>(null);
  const attachedScanId = attached?.projectPath === projectPath ? attached.scanId : null;
  const appliedScanRef = useRef<string | null>(null);
  const expandOnApplyRef = useRef<SubModuleId | undefined>(undefined);
  const jobUrl = `/api/evaluator/deep-eval?project=${encodeURIComponent(projectPath)}`;

  /** Mirror a job snapshot; when it has settled with a result, apply that once. */
  const consumeJob = useCallback(
    (job: DeepEvalJobSnapshot) => {
      setProgress(job.progress);
      if (job.status === 'running') {
        setAttached({ projectPath, scanId: job.scanId });
        return;
      }
      setAttached(null);
      if (job.result && appliedScanRef.current !== job.scanId) {
        appliedScanRef.current = job.scanId;
        void applyScanResult(job.result, { expandModule: expandOnApplyRef.current });
      }
    },
    [applyScanResult, projectPath],
  );

  // Reattach: a job already running for this project (a reload, a second tab) is
  // adopted, never restarted. A job that settled while nothing was attached is not
  // re-applied here (its baseline merge needs the context of the tab that ran it).
  useEffect(() => {
    if (!projectPath) return;
    let cancelled = false;
    void (async () => {
      const res = await tryApiFetch<{ job: DeepEvalJobSnapshot | null }>(jobUrl);
      if (cancelled || !res.ok || !res.data.job || res.data.job.status !== 'running') return;
      consumeJob(res.data.job);
    })();
    return () => { cancelled = true; };
  }, [projectPath, jobUrl, consumeJob]);

  useEffect(() => {
    if (!attachedScanId) return;
    const timer = setInterval(() => {
      void (async () => {
        const res = await tryApiFetch<{ job: DeepEvalJobSnapshot | null }>(jobUrl);
        if (!res.ok || !res.data.job || res.data.job.scanId !== attachedScanId) return;
        consumeJob(res.data.job);
      })();
    }, UI_TIMEOUTS.pollInterval);
    return () => clearInterval(timer);
  }, [attachedScanId, jobUrl, consumeJob]);

  const startJob = useCallback(
    async (moduleIds: string[], expandModule?: SubModuleId) => {
      if (isRunning || moduleIds.length === 0) return;
      setResult(null);
      expandOnApplyRef.current = expandModule;
      const res = await tryApiFetch<{ scanId: string; job: DeepEvalJobSnapshot | null }>('/api/evaluator/deep-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, projectName, ueVersion, moduleIds }),
      });
      if (res.ok && res.data.job) {
        consumeJob(res.data.job);
        return;
      }
      // Refused (e.g. 409: one is already running for this project) — adopt that
      // one if it exists, otherwise say why nothing started.
      const current = await tryApiFetch<{ job: DeepEvalJobSnapshot | null }>(jobUrl);
      if (current.ok && current.data.job?.status === 'running') {
        consumeJob(current.data.job);
        return;
      }
      const reason = res.ok ? 'The server did not return a job' : res.error;
      logger.error('Deep eval did not start:', reason);
      setProgress({ ...idleProgress(), status: 'error', error: reason });
    },
    [isRunning, projectPath, projectName, ueVersion, jobUrl, consumeJob],
  );

  const handleRunEval = useCallback(
    () => startJob(Array.from(selectedModuleIds)),
    [startJob, selectedModuleIds],
  );

  const handleRunSingle = useCallback(
    (moduleId: SubModuleId) => startJob([moduleId], moduleId),
    [startJob],
  );

  const handleCancel = useCallback(async () => {
    const res = await tryApiFetch<{ job: DeepEvalJobSnapshot | null }>(jobUrl, { method: 'DELETE' });
    if (res.ok && res.data.job) consumeJob(res.data.job);
  }, [jobUrl, consumeJob]);

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
    fixTargetId: activeFixTargetId,
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
    discardedBaselineProject,
  };
}
