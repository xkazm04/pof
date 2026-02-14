'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  TestSuite,
  TestSuiteSummary,
  CreateSuitePayload,
  UpdateSuitePayload,
  CreateScenarioPayload,
  UpdateScenarioPayload,
} from '@/types/ai-testing';
import { apiFetch } from '@/lib/api-utils';

interface UseAITestingResult {
  suites: TestSuite[];
  summary: TestSuiteSummary;
  activeSuite: TestSuite | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  setActiveSuiteId: (id: number | null) => void;
  createSuite: (payload: CreateSuitePayload) => Promise<TestSuite | null>;
  updateSuite: (payload: UpdateSuitePayload) => Promise<TestSuite | null>;
  deleteSuite: (id: number) => Promise<boolean>;
  createScenario: (payload: CreateScenarioPayload) => Promise<boolean>;
  updateScenario: (payload: UpdateScenarioPayload) => Promise<boolean>;
  deleteScenario: (id: number) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const EMPTY_SUMMARY: TestSuiteSummary = {
  totalSuites: 0,
  totalScenarios: 0,
  passedCount: 0,
  failedCount: 0,
  draftCount: 0,
};

export function useAITesting(): UseAITestingResult {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [summary, setSummary] = useState<TestSuiteSummary>(EMPTY_SUMMARY);
  const [activeSuiteId, setActiveSuiteId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ suites: TestSuite[]; summary: TestSuiteSummary }>('/api/ai-testing');
      if (!mountedRef.current) return;
      setSuites(data.suites ?? []);
      setSummary(data.summary ?? EMPTY_SUMMARY);
    } catch (err) {
      console.error('useAITesting fetch error:', err);
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load AI testing data');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeSuite = suites.find((s) => s.id === activeSuiteId) ?? null;

  const createSuiteOp = useCallback(async (payload: CreateSuitePayload) => {
    try {
      const data = await apiFetch<{ suite: TestSuite }>('/api/ai-testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-suite', ...payload }),
      });
      await fetchAll();
      if (data.suite) setActiveSuiteId(data.suite.id);
      return data.suite;
    } catch (err) {
      console.error('useAITesting createSuite error:', err);
      return null;
    }
  }, [fetchAll]);

  const updateSuiteOp = useCallback(async (payload: UpdateSuitePayload) => {
    try {
      const data = await apiFetch<{ suite: TestSuite }>('/api/ai-testing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-suite', ...payload }),
      });
      await fetchAll();
      return data.suite;
    } catch (err) {
      console.error('useAITesting updateSuite error:', err);
      return null;
    }
  }, [fetchAll]);

  const deleteSuiteOp = useCallback(async (id: number) => {
    try {
      await apiFetch<unknown>(`/api/ai-testing?type=suite&id=${id}`, { method: 'DELETE' });
      if (activeSuiteId === id) setActiveSuiteId(null);
      await fetchAll();
      return true;
    } catch (err) {
      console.error('useAITesting deleteSuite error:', err);
      return false;
    }
  }, [activeSuiteId, fetchAll]);

  const createScenarioOp = useCallback(async (payload: CreateScenarioPayload) => {
    try {
      await apiFetch<unknown>('/api/ai-testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-scenario', ...payload }),
      });
      await fetchAll();
      return true;
    } catch (err) {
      console.error('useAITesting createScenario error:', err);
      return false;
    }
  }, [fetchAll]);

  const updateScenarioOp = useCallback(async (payload: UpdateScenarioPayload) => {
    try {
      await apiFetch<unknown>('/api/ai-testing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-scenario', ...payload }),
      });
      await fetchAll();
      return true;
    } catch (err) {
      console.error('useAITesting updateScenario error:', err);
      return false;
    }
  }, [fetchAll]);

  const deleteScenarioOp = useCallback(async (id: number) => {
    try {
      await apiFetch<unknown>(`/api/ai-testing?type=scenario&id=${id}`, { method: 'DELETE' });
      await fetchAll();
      return true;
    } catch (err) {
      console.error('useAITesting deleteScenario error:', err);
      return false;
    }
  }, [fetchAll]);

  return {
    suites,
    summary,
    activeSuite,
    isLoading,
    error,
    retry: fetchAll,
    setActiveSuiteId,
    createSuite: createSuiteOp,
    updateSuite: updateSuiteOp,
    deleteSuite: deleteSuiteOp,
    createScenario: createScenarioOp,
    updateScenario: updateScenarioOp,
    deleteScenario: deleteScenarioOp,
    refetch: fetchAll,
  };
}
