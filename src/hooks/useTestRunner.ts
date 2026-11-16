'use client';

/**
 * React hook for the PoF Bridge test runner.
 *
 * Submits test specs to the UE5 plugin via the API proxy and polls for results
 * while a test is running. Accumulates results across multiple test runs within
 * the same component lifecycle.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { PofTestSpec, PofTestResult } from '@/types/pof-bridge';

interface UseTestRunnerResult {
  runTest: (spec: PofTestSpec) => Promise<PofTestResult | null>;
  /** Ends the in-flight poll at its next wake (within one UI_TIMEOUTS.testPollInterval); the run resolves null. */
  abort: () => void;
  results: PofTestResult[];
  isRunning: boolean;
  error: string | null;
  clearResults: () => void;
}

export function useTestRunner(): UseTestRunnerResult {
  const [results, setResults] = useState<PofTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useIsMounted();
  // Use a ref to allow aborting ongoing polls on unmount
  const abortRef = useRef(false);
  const lastPollErrorRef = useRef<string | null>(null);

  useEffect(() => {
    abortRef.current = false;
    return () => { abortRef.current = true; };
  }, []);

  // ── Poll for test result ───────────────────────────────────────────────────

  const pollForResult = useCallback(async (testId: string): Promise<PofTestResult | null> => {
    const startTime = Date.now();

    while (!abortRef.current) {
      if (Date.now() - startTime > UI_TIMEOUTS.testPollTimeout) {
        return null; // Timed out waiting
      }

      await new Promise((resolve) => setTimeout(resolve, UI_TIMEOUTS.testPollInterval));

      if (abortRef.current) return null;

      const result = await tryApiFetch<PofTestResult>(
        `/api/pof-bridge/test?testId=${encodeURIComponent(testId)}`,
      );

      if (!result.ok) {
        lastPollErrorRef.current = result.error; // Retry on transient errors; kept so a timeout can name it
        continue;
      }
      lastPollErrorRef.current = null;

      if (result.data.status !== 'running') {
        return result.data;
      }
    }

    return null;
  }, []);

  // ── Run test ───────────────────────────────────────────────────────────────

  const runTest = useCallback(async (spec: PofTestSpec): Promise<PofTestResult | null> => {
    // A suite loop can outlive its panel; an unmounted runner sends nothing more to UE.
    if (!isMounted()) return null;
    setIsRunning(true);
    setError(null);
    abortRef.current = false;
    lastPollErrorRef.current = null;

    // Submit the test spec — the proxy reads `{ action, spec }` and forwards `body.spec`.
    const submitResult = await tryApiFetch<PofTestResult>('/api/pof-bridge/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run', spec }),
    });

    if (!submitResult.ok) {
      if (isMounted()) {
        setError(submitResult.error);
        setIsRunning(false);
      }
      return null;
    }

    // If the result came back immediately (not running), we're done
    if (submitResult.data.status !== 'running') {
      if (isMounted()) {
        setResults((prev) => [...prev, submitResult.data]);
        setIsRunning(false);
      }
      return submitResult.data;
    }

    // Poll until completion
    const finalResult = await pollForResult(spec.testId);

    if (!isMounted()) return finalResult;

    if (finalResult) {
      setResults((prev) => [...prev, finalResult]);
    } else {
      const reason = lastPollErrorRef.current;
      setError(`Test "${spec.testId}" timed out or was aborted${reason ? ` (last poll failed: ${reason})` : ''}`);
    }

    setIsRunning(false);
    return finalResult;
  }, [pollForResult, isMounted]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  // ── Clear results ──────────────────────────────────────────────────────────

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    runTest,
    abort,
    results,
    isRunning,
    error,
    clearResults,
  };
}
