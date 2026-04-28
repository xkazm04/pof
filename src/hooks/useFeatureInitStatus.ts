'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * Feature initialization lifecycle:
 * - hardcoded:    Using mock/placeholder data only (default)
 * - initializing: CLI LLM session creating boilerplate in UE5 project
 * - initialized:  Connected to real project — boilerplate created, PoF can read live data
 */
export type FeatureInitState = 'hardcoded' | 'initializing' | 'initialized';

const STORAGE_PREFIX = 'pof-feature-init-';

function readStore(moduleId: string): Record<string, FeatureInitState> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${moduleId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(moduleId: string, state: Record<string, FeatureInitState>) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${moduleId}`, JSON.stringify(state));
  } catch { /* quota exceeded — silent */ }
}

/**
 * Track initialization status per feature section per module.
 * Persisted to localStorage. Default state for any section is 'hardcoded'.
 */
export function useFeatureInitStatus(moduleId: string) {
  const [state, setState] = useState<Record<string, FeatureInitState>>(() => readStore(moduleId));

  // Sync to localStorage on every change
  const update = useCallback((next: Record<string, FeatureInitState>) => {
    setState(next);
    writeStore(moduleId, next);
  }, [moduleId]);

  const getStatus = useCallback(
    (sectionId: string): FeatureInitState => state[sectionId] ?? 'hardcoded',
    [state],
  );

  const setStatus = useCallback(
    (sectionId: string, status: FeatureInitState) => {
      update({ ...state, [sectionId]: status });
    },
    [state, update],
  );

  const setInitializing = useCallback(
    (sectionId: string) => setStatus(sectionId, 'initializing'),
    [setStatus],
  );

  const setInitialized = useCallback(
    (sectionId: string) => setStatus(sectionId, 'initialized'),
    [setStatus],
  );

  const stats = useMemo(() => {
    const values = Object.values(state);
    return {
      hardcoded: values.filter(v => v === 'hardcoded').length,
      initializing: values.filter(v => v === 'initializing').length,
      initialized: values.filter(v => v === 'initialized').length,
    };
  }, [state]);

  return { getStatus, setStatus, setInitializing, setInitialized, stats, _raw: state };
}
