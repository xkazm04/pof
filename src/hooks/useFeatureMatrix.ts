'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FeatureRow, FeatureSummary } from '@/types/feature-matrix';
import type { VerificationResult } from '@/types/pof-bridge';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { autoUpdateFeatureMatrix } from '@/lib/pof-bridge/verification-engine';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { tryApiFetch } from '@/lib/api-utils';
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
  runAutoVerify: () => Promise<VerificationResult[]>;
  isVerifying: boolean;
  verificationResults: VerificationResult[];
}

const EMPTY_SUMMARY: FeatureSummary = { total: 0, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0 };

// Module-scoped (not hook-instance-scoped) seed guard. LRU-cached module views
// can mount two independent hook instances for the same moduleId at once (e.g. a
// background prefetch + a foreground tab); a per-instance ref lets both fire the
// insert-if-missing POST and race a duplicate seed. Keying the guard on moduleId
// across all instances means at most one seed is ever dispatched per module.
const seededModules = new Set<string>();

export function useFeatureMatrix(moduleId: SubModuleId): UseFeatureMatrixResult {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [summary, setSummary] = useState<FeatureSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
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
    const result = await tryApiFetch<{ features: FeatureRow[]; summary: FeatureSummary }>(`/api/feature-matrix?moduleId=${encodeURIComponent(moduleId)}`);
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
      setSummary(result.data.summary ?? EMPTY_SUMMARY);
    } else {
      console.error('useFeatureMatrix fetch error:', result.error);
      setError(result.error);
    }
    setIsLoading(false);
  }, [moduleId]);

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
      body: JSON.stringify({ moduleId, features: seedFeatures, seedOnly: true, source: 'seed' }),
    });
    if (result.ok) {
      // New rows change the cross-module status table every other view reads —
      // and the counts every module roll-up is built from.
      invalidateFeatureData();
      await fetchData();
    } else {
      console.error('useFeatureMatrix seed error:', result.error);
    }
  }, [moduleId, fetchData]);

  const runAutoVerify = useCallback(async (): Promise<VerificationResult[]> => {
    const manifest = usePofBridgeStore.getState().manifest;
    if (!manifest) return [];
    setIsVerifying(true);
    try {
      const results = await autoUpdateFeatureMatrix(manifest, moduleId);
      setVerificationResults(results);
      // Auto-verify writes statuses — every consumer of the shared derived
      // caches must see them, not just this view.
      invalidateFeatureData();
      // Refetch to show updated statuses
      await fetchData();
      return results;
    } finally {
      setIsVerifying(false);
    }
  }, [moduleId, fetchData]);

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
    if (!isLoading && !error && features.length === 0 && !seededModules.has(moduleId)) {
      seededModules.add(moduleId);
      seed();
    }
  }, [isLoading, error, features.length, moduleId, seed]);

  return { features, summary, isLoading, error, retry: fetchData, refetch: fetchData, seed, runAutoVerify, isVerifying, verificationResults };
}
