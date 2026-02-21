'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FeatureRow, FeatureSummary } from '@/types/feature-matrix';
import type { VerificationResult } from '@/types/pof-bridge';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { autoUpdateFeatureMatrix } from '@/lib/pof-bridge/verification-engine';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { tryApiFetch } from '@/lib/api-utils';
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

export function useFeatureMatrix(moduleId: SubModuleId): UseFeatureMatrixResult {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [summary, setSummary] = useState<FeatureSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const seededRef = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!moduleId) return;
    setIsLoading(true);
    setError(null);
    const result = await tryApiFetch<{ features: FeatureRow[]; summary: FeatureSummary }>(`/api/feature-matrix?moduleId=${encodeURIComponent(moduleId)}`);
    if (result.ok) {
      setFeatures(result.data.features ?? []);
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
      body: JSON.stringify({ moduleId, features: seedFeatures }),
    });
    if (result.ok) {
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

  // After loading, if features is empty and we haven't seeded this module yet, auto-seed
  useEffect(() => {
    if (!isLoading && features.length === 0 && !seededRef.current.has(moduleId)) {
      seededRef.current.add(moduleId);
      seed();
    }
  }, [isLoading, features.length, moduleId, seed]);

  return { features, summary, isLoading, error, retry: fetchData, refetch: fetchData, seed, runAutoVerify, isVerifying, verificationResults };
}
