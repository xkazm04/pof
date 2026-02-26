'use client';

/**
 * React hook for the PoF Bridge test runner.
 *
 * Submits test specs to the UE5 plugin via the API proxy and polls for results
 * while a test is running. Accumulates results across multiple test runs within
 * the same component lifecycle.
 */

import { useState, useCallback, useRef } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { PofTestSpec, PofTestResult } from '@/types/pof-bridge';

/** Polling interval while waiting for test results (ms). */
const TEST_POLL_INTERVAL = 2_000;

/** Maximum time to wait for a single test before giving up (ms). */
const TEST_POLL_TIMEOUT = 120_000;

interface UseTestRunnerResult {
  runTest: (spec: PofTestSpec) => Promise<PofTestResult | null>;
  results: PofTestResult[];
  isRunning: boolean;
  error: string | null;
  clearResults: () => void;
}

export function useTestRunner(): UseTestRunnerResult {
  const [results, setResults] = useState<PofTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  // Use a ref to allow aborting ongoing polls on unmount
  const abortRef = useRef(false);

  // Clean up on unmount
  useState(() => {
    // This runs once on mount (initializer)
    return () => {
      mountedRef.current = false;
      abortRef.current = true;
    };
  });

  // ── Poll for test result ───────────────────────────────────────────────────

  const pollForResult = useCallback(async (testId: string): Promise<PofTestResult | null> => {
    const startTime = Date.now();

    while (!abortRef.current) {
      if (Date.now() - startTime > TEST_POLL_TIMEOUT) {
        return null; // Timed out waiting
      }

      await new Promise((resolve) => setTimeout(resolve, TEST_POLL_INTERVAL));

      if (abortRef.current) return null;

      const result = await tryApiFetch<PofTestResult>(
        `/api/pof-bridge/test?testId=${encodeURIComponent(testId)}`,
      );

      if (!result.ok) continue; // Retry on transient errors

      if (result.data.status !== 'running') {
        return result.data;
      }
    }

    return null;
  }, []);

  // ── Run test ───────────────────────────────────────────────────────────────

  const runTest = useCallback(async (spec: PofTestSpec): Promise<PofTestResult | null> => {
    setIsRunning(true);
    setError(null);
    abortRef.current = false;

    // Submit the test spec
    const submitResult = await tryApiFetch<PofTestResult>('/api/pof-bridge/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });

    if (!submitResult.ok) {
      if (mountedRef.current) {
        setError(submitResult.error);
        setIsRunning(false);
      }
      return null;
    }

    // If the result came back immediately (not running), we're done
    if (submitResult.data.status !== 'running') {
      if (mountedRef.current) {
        setResults((prev) => [...prev, submitResult.data]);
        setIsRunning(false);
      }
      return submitResult.data;
    }

    // Poll until completion
    const finalResult = await pollForResult(spec.testId);

    if (!mountedRef.current) return finalResult;

    if (finalResult) {
      setResults((prev) => [...prev, finalResult]);
    } else {
      setError(`Test "${spec.testId}" timed out or was aborted`);
    }

    setIsRunning(false);
    return finalResult;
  }, [pollForResult]);

  // ── Clear results ──────────────────────────────────────────────────────────

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    runTest,
    results,
    isRunning,
    error,
    clearResults,
  };
}
