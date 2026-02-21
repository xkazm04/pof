'use client';

import { useState, useCallback } from 'react';
import type {
  TestSuite,
  TestSuiteSummary,
  CreateSuitePayload,
  UpdateSuitePayload,
  CreateScenarioPayload,
  UpdateScenarioPayload,
} from '@/types/ai-testing';
import { useCRUD } from './useCRUD';

interface AITestingData {
  suites: TestSuite[];
  summary: TestSuiteSummary;
}

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

const EMPTY: AITestingData = {
  suites: [],
  summary: { totalSuites: 0, totalScenarios: 0, passedCount: 0, failedCount: 0, draftCount: 0 },
};

const transform = (raw: unknown): AITestingData => {
  const d = raw as Partial<AITestingData>;
  return { suites: d.suites ?? [], summary: d.summary ?? EMPTY.summary };
};

export function useAITesting(): UseAITestingResult {
  const { data, isLoading, error, refetch, mutate } = useCRUD<AITestingData>(
    '/api/ai-testing',
    EMPTY,
    { transform, errorMessage: 'Failed to load AI testing data' },
  );

  const [activeSuiteId, setActiveSuiteId] = useState<number | null>(null);
  const activeSuite = data.suites.find((s) => s.id === activeSuiteId) ?? null;

  const createSuiteOp = useCallback(async (payload: CreateSuitePayload) => {
    const result = await mutate<{ suite: TestSuite }>('/api/ai-testing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-suite', ...payload }),
    });
    if (result?.suite) setActiveSuiteId(result.suite.id);
    return result?.suite ?? null;
  }, [mutate]);

  const updateSuiteOp = useCallback(async (payload: UpdateSuitePayload) => {
    const result = await mutate<{ suite: TestSuite }>('/api/ai-testing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-suite', ...payload }),
    });
    return result?.suite ?? null;
  }, [mutate]);

  const deleteSuiteOp = useCallback(async (id: number) => {
    const result = await mutate<unknown>(`/api/ai-testing?type=suite&id=${id}`, { method: 'DELETE' });
    if (result !== null && activeSuiteId === id) setActiveSuiteId(null);
    return result !== null;
  }, [activeSuiteId, mutate]);

  const createScenarioOp = useCallback(async (payload: CreateScenarioPayload) => {
    const result = await mutate<unknown>('/api/ai-testing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-scenario', ...payload }),
    });
    return result !== null;
  }, [mutate]);

  const updateScenarioOp = useCallback(async (payload: UpdateScenarioPayload) => {
    const result = await mutate<unknown>('/api/ai-testing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-scenario', ...payload }),
    });
    return result !== null;
  }, [mutate]);

  const deleteScenarioOp = useCallback(async (id: number) => {
    const result = await mutate<unknown>(`/api/ai-testing?type=scenario&id=${id}`, { method: 'DELETE' });
    return result !== null;
  }, [mutate]);

  return {
    suites: data.suites,
    summary: data.summary,
    activeSuite,
    isLoading,
    error,
    retry: refetch,
    setActiveSuiteId,
    createSuite: createSuiteOp,
    updateSuite: updateSuiteOp,
    deleteSuite: deleteSuiteOp,
    createScenario: createScenarioOp,
    updateScenario: updateScenarioOp,
    deleteScenario: deleteScenarioOp,
    refetch,
  };
}
