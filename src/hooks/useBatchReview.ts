'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS, getAppOrigin } from '@/lib/constants';
import type { SubModuleId } from '@/types/modules';
import type {
  BatchReviewAbortRequest, BatchReviewStartRequest, BatchReviewState,
} from '@/types/batch-review';

const ENDPOINT = '/api/feature-matrix/batch-review';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export interface UseBatchReviewResult {
  /** The ONE server-side batch (running or last finished), or null. */
  batch: BatchReviewState | null;
  isRunning: boolean;
  isStarting: boolean;
  /** Why the last start failed (e.g. the 409 "already running"), else null. */
  error: string | null;
  /** Start a batch: `moduleIds` scopes it; omitted = every module with definitions. */
  start: (moduleIds?: SubModuleId[]) => Promise<void>;
  abort: () => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * Client side of `/api/feature-matrix/batch-review`: the suspend-aware GET poll
 * (armed off the OBSERVED running state, token-guarded against out-of-order
 * responses), start / abort / clear, and `onSettled` fired once per observed
 * running -> finished transition. The Scanner tab's BatchReviewPanel and the Quality
 * tab both read through it, so both observe the same in-memory batch.
 */
export function useBatchReview(options: { onSettled?: () => void } = {}): UseBatchReviewResult {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);
  const ueVersion = useProjectStore((s) => s.ueVersion);
  const [batch, setBatch] = useState<BatchReviewState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic poll token: under a slow server an earlier poll can resolve after
  // a later one — only the newest issued poll may commit its snapshot.
  const pollTokenRef = useRef(0);
  const onSettledRef = useRef(options.onSettled);
  onSettledRef.current = options.onSettled;

  const pollStatus = useCallback(async () => {
    const token = ++pollTokenRef.current;
    try {
      const data = await apiFetch<{ batch: BatchReviewState | null }>(ENDPOINT);
      if (token !== pollTokenRef.current) return; // a newer poll already resolved
      setBatch(data.batch);
    } catch { /* silent — the next poll retries */ }
  }, []);

  const status = batch?.status ?? null;
  const isRunning = status === 'running';

  // Initial fetch (+ refetch on resume). Suspend-aware.
  useSuspendableEffect(() => { pollStatus(); }, [pollStatus]);

  // The interval follows the OBSERVED running state, not the start action, so a
  // remount / reload / other tab during a running batch resumes polling.
  useSuspendableEffect(() => {
    if (!isRunning) return;
    const id = setInterval(pollStatus, UI_TIMEOUTS.pollInterval);
    return () => clearInterval(id);
  }, [isRunning, pollStatus]);

  // running -> completed/error/aborted, observed once per transition.
  const prevStatusRef = useRef<BatchReviewState['status'] | null>(null);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === 'running' && status !== null && status !== 'running') onSettledRef.current?.();
  }, [status]);

  const start = useCallback(async (moduleIds?: SubModuleId[]) => {
    setIsStarting(true);
    setError(null);
    const body: BatchReviewStartRequest = {
      appOrigin: getAppOrigin(), projectPath, projectName, ueVersion,
      ...(moduleIds ? { moduleIds } : {}),
    };
    try {
      await apiFetch(ENDPOINT, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      // Success: pick up the now-running batch. Failure (e.g. 409 already running):
      // attach to whatever batch the server IS running instead of failing silently.
      await pollStatus();
      setIsStarting(false);
    }
  }, [pollStatus, projectPath, projectName, ueVersion]);

  const abort = useCallback(async () => {
    const body: BatchReviewAbortRequest = { action: 'abort' };
    try {
      await apiFetch(ENDPOINT, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
    } catch {
      // The batch may have finished server-side between render and click (the
      // abort then 400s) — the poll below still refreshes the UI.
    } finally {
      await pollStatus();
    }
  }, [pollStatus]);

  const clear = useCallback(async () => {
    try {
      await apiFetch(ENDPOINT, { method: 'DELETE' });
      setBatch(null);
    } catch { /* silent */ }
  }, []);

  return { batch, isRunning, isStarting, error, start, abort, clear };
}
