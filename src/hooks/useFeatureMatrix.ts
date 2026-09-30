'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FeatureRow, FeatureSummary } from '@/types/feature-matrix';
import type { VerificationPlan, VerificationResult } from '@/types/pof-bridge';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import {
  applyVerification, planVerification, readVerificationRows, resultsAfterApply,
} from '@/lib/pof-bridge/verification-engine';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { useProjectStore } from '@/stores/projectStore';
import { tryApiFetch } from '@/lib/api-utils';
import type { ProjectScopeReport } from '@/lib/feature-matrix-db';
// Every write below changes the feature_matrix rows, and the per-module roll-up
// is a projection of those same rows — so both derived caches move together.
// Dropping only the statuses cache left the Evaluator's aggregates contradicting
// its own status cells for a whole TTL window.
import { invalidateFeatureData } from '@/hooks/useModuleAggregates';
import type { SubModuleId } from '@/types/modules';

interface UseFeatureMatrixResult {
  features: FeatureRow[];
  summary: FeatureSummary;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  refetch: () => void;
  seed: () => Promise<void>;
  /**
   * Auto-Verify step 1 — PREVIEW. Reads the module's current rows (scoped) and
   * plans every flip the live manifest suggests, with its evidence. Writes nothing.
   * Null when there is no live manifest (no connected editor, or no successful
   * manifest read): an unreachable editor is not evidence for any flip.
   */
  previewAutoVerify: () => Promise<VerificationPlan | null>;
  /** Auto-Verify step 2 — write ONLY the picked features of the held plan (one POST),
   *  then invalidate the derived caches and refetch. */
  applyAutoVerify: (featureNames: string[]) => Promise<VerificationResult[]>;
  /** Close the preview without writing. */
  discardAutoVerify: () => void;
  /** The plan awaiting the user's picks, or null when no preview is open. */
  verifyPlan: VerificationPlan | null;
  /** Why the last preview could not be built (rows unreadable), else null. */
  verifyError: string | null;
  isVerifying: boolean;
  /** Per-rule results of the last APPLY (`written` marks what was saved). */
  verificationResults: VerificationResult[];
  /**
   * What the project scope let this read see — including how many of the module's
   * rows are unattributed legacy rows and how many belong to another project. Null
   * until the first successful fetch. An empty `features` list with
   * `scope.foreignRows > 0` is NOT an unreviewed module: it is a module another
   * project has reviewed and this one has not. Since the project entered the UNIQUE
   * key those rows are no longer contested — this project can hold its own row for
   * every one of them without disturbing the owner's.
   */
  scope: ProjectScopeReport | null;
}

const EMPTY_SUMMARY: FeatureSummary = { total: 0, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0 };

// Module-scoped (not hook-instance-scoped) seed guard. LRU-cached module views
// can mount two independent hook instances for the same moduleId at once (e.g. a
// background prefetch + a foreground tab); a per-instance ref lets both fire the
// insert-if-missing POST and race a duplicate seed. Keying the guard on moduleId
// across all instances means at most one seed is ever dispatched per module.
//
// The key includes the PROJECT: a module seeded under project A is not seeded
// under project B, and a project-keyed guard is what lets B seed its own rows
// after a switch instead of sitting on A's guard entry forever.
const seededModules = new Set<string>();

/** Append the active project to a feature-matrix URL. Omitted when there is no
 *  active project, so an unscoped call is visibly unscoped rather than sending
 *  an empty parameter that reads like a scope. */
function withProject(url: string, projectId: string): string {
  if (!projectId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}projectId=${encodeURIComponent(projectId)}`;
}

export function useFeatureMatrix(moduleId: SubModuleId): UseFeatureMatrixResult {
  // The active project, read from the store the user actually switches. Every
  // fetch below depends on it, so switching projects re-reads the matrix rather
  // than leaving the previous project's rows on screen.
  const projectPath = useProjectStore((s) => s.projectPath);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [scope, setScope] = useState<ProjectScopeReport | null>(null);
  const [summary, setSummary] = useState<FeatureSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [verifyPlan, setVerifyPlan] = useState<VerificationPlan | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // The plan an apply acts on — a ref so an apply always writes the plan the user
  // was shown, not whatever a re-render captured.
  const verifyPlanRef = useRef<VerificationPlan | null>(null);
  // Monotonic request id: switching modules fast can let an older, slower
  // /api/feature-matrix response resolve after a newer one. We capture the id
  // at dispatch and ignore any response that is no longer the latest, so a
  // stale request can never overwrite the current module's state.
  const requestIdRef = useRef(0);
  // Last observed status per feature, so a refetch can tell whether the table moved
  // under us. The CLI fix flow PATCHes rows by curl — nothing in the app issues that
  // write, so polling is the only place the app can learn the shared all-statuses
  // cache is stale. Without this the Constellation / NBA / dependency views kept
  // serving a pre-fix status for the whole TTL.
  const statusSigRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!moduleId) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    const result = await tryApiFetch<{
      features: FeatureRow[];
      summary: FeatureSummary;
      scope?: ProjectScopeReport;
    }>(withProject(`/api/feature-matrix?moduleId=${encodeURIComponent(moduleId)}`, projectPath));
    // A newer request has since been issued — discard this stale response.
    if (requestId !== requestIdRef.current) return;
    if (result.ok) {
      const rows = result.data.features ?? [];
      const signature = rows.map((f) => `${f.featureName}:${f.status}`).join('|');
      if (statusSigRef.current !== null && statusSigRef.current !== signature) {
        invalidateFeatureData();
      }
      statusSigRef.current = signature;
      setFeatures(rows);
      setScope(result.data.scope ?? null);
      setSummary(result.data.summary ?? EMPTY_SUMMARY);
    } else {
      console.error('useFeatureMatrix fetch error:', result.error);
      setError(result.error);
    }
    setIsLoading(false);
  }, [moduleId, projectPath]);

  const seed = useCallback(async () => {
    const defs = MODULE_FEATURE_DEFINITIONS[moduleId];
    if (!defs || defs.length === 0) return;

    const seedFeatures = defs.map((d) => ({
      featureName: d.featureName,
      category: d.category,
      status: 'unknown' as const,
      description: d.description,
      filePaths: [],
      reviewNotes: '',
    }));

    const result = await tryApiFetch<unknown>('/api/feature-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // seedOnly: insert-if-missing — a seed must never clobber review data
      // that exists in the DB (e.g. when this ran because a fetch failed).
      // source 'seed': these rows carry no verdict, and must not read as reviewed.
      // projectId: the seeded rows belong to the project that is open, so the next
      // project to open this module does not inherit them as its own.
      body: JSON.stringify({
        moduleId, features: seedFeatures, seedOnly: true, source: 'seed', projectId: projectPath,
      }),
    });
    if (result.ok) {
      // New rows change the cross-module status table every other view reads —
      // and the counts every module roll-up is built from.
      invalidateFeatureData();
      await fetchData();
    } else {
      console.error('useFeatureMatrix seed error:', result.error);
    }
  }, [moduleId, projectPath, fetchData]);

  const holdPlan = useCallback((plan: VerificationPlan | null) => {
    verifyPlanRef.current = plan;
    setVerifyPlan(plan);
  }, []);

  // A preview belongs to the module + project it was read under: switching either
  // drops it, so an apply can never write one project's picks into another.
  useEffect(() => {
    holdPlan(null);
    setVerifyError(null);
  }, [moduleId, projectPath, holdPlan]);

  const previewAutoVerify = useCallback(async (): Promise<VerificationPlan | null> => {
    const bridge = usePofBridgeStore.getState();
    // Only a manifest from a CONNECTED editor is evidence. The store holds a manifest
    // only after a successful read; a cached one from an editor that has since gone
    // unreachable proves nothing about the project now.
    if (!bridge.manifest || bridge.connectionStatus !== 'connected') {
      setVerifyError('No asset manifest from a connected editor — nothing to verify against.');
      holdPlan(null);
      return null;
    }
    const manifest = bridge.manifest;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      // Read through the SAME scope the apply writes under. A failed read builds no
      // plan: without the stored rows a review verdict would read as "no row".
      const current = await readVerificationRows(moduleId, projectPath);
      if (!current.ok) {
        setVerifyError(current.error);
        holdPlan(null);
        return null;
      }
      const plan = planVerification(manifest, moduleId, current.rows);
      holdPlan(plan);
      return plan;
    } finally {
      setIsVerifying(false);
    }
  }, [moduleId, projectPath, holdPlan]);

  const applyAutoVerify = useCallback(async (featureNames: string[]): Promise<VerificationResult[]> => {
    const plan = verifyPlanRef.current;
    if (!plan) return [];
    setIsVerifying(true);
    try {
      // The active project travels with the write: auto-verify was once the ONE
      // feature-matrix write path that stamped nothing.
      const outcome = await applyVerification(plan, featureNames, projectPath);
      const results = resultsAfterApply(plan, outcome);
      setVerificationResults(results);
      holdPlan(null);
      if (outcome.written.length > 0 && !outcome.writeError) {
        // Statuses moved — every consumer of the shared derived caches must see
        // them, not just this view.
        invalidateFeatureData();
        await fetchData();
      }
      return results;
    } finally {
      setIsVerifying(false);
    }
  }, [projectPath, fetchData, holdPlan]);

  const discardAutoVerify = useCallback(() => holdPlan(null), [holdPlan]);

  // Auto-seed on first load if no data exists
  useEffect(() => {
    let cancelled = false;

    async function init() {
      await fetchData();
    }

    init().then(() => {
      if (cancelled) return;
    });

    return () => { cancelled = true; };
  }, [fetchData]);

  // After loading, if features is empty and we haven't seeded this module yet, auto-seed.
  // Only after a SUCCESSFUL empty fetch — a failed GET also leaves features at []
  // and seeding then would write over review data the DB still holds.
  useEffect(() => {
    const seedKey = `${projectPath}::${moduleId}`;
    if (!isLoading && !error && features.length === 0 && !seededModules.has(seedKey)) {
      seededModules.add(seedKey);
      seed();
    }
  }, [isLoading, error, features.length, moduleId, projectPath, seed]);

  return {
    features, summary, isLoading, error, retry: fetchData, refetch: fetchData, seed,
    previewAutoVerify, applyAutoVerify, discardAutoVerify, verifyPlan, verifyError,
    isVerifying, verificationResults, scope,
  };
}
