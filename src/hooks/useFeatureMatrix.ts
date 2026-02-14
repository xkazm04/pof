'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FeatureRow, FeatureSummary } from '@/types/feature-matrix';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { apiFetch } from '@/lib/api-utils';

interface UseFeatureMatrixResult {
  features: FeatureRow[];
  summary: FeatureSummary;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  refetch: () => void;
  seed: () => Promise<void>;
}

const EMPTY_SUMMARY: FeatureSummary = { total: 0, implemented: 0, partial: 0, missing: 0, unknown: 0 };

export function useFeatureMatrix(moduleId: string): UseFeatureMatrixResult {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [summary, setSummary] = useState<FeatureSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!moduleId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ features: FeatureRow[]; summary: FeatureSummary }>(`/api/feature-matrix?moduleId=${encodeURIComponent(moduleId)}`);
      setFeatures(data.features ?? []);
      setSummary(data.summary ?? EMPTY_SUMMARY);
    } catch (err) {
      console.error('useFeatureMatrix fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feature matrix');
    } finally {
      setIsLoading(false);
    }
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

    try {
      await apiFetch<unknown>('/api/feature-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, features: seedFeatures }),
      });
      await fetchData();
    } catch (err) {
      console.error('useFeatureMatrix seed error:', err);
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

  return { features, summary, isLoading, error, retry: fetchData, refetch: fetchData, seed };
}
