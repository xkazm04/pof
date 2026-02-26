'use client';

/**
 * React hook for PoF Bridge snapshot capture and diffing.
 *
 * Provides actions to capture snapshots (comparing against baseline),
 * save new baselines, and fetch the latest diff report.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { PofSnapshotCaptureRequest, PofSnapshotDiffReport } from '@/types/pof-bridge';

interface UseSnapshotsResult {
  capture: (req: PofSnapshotCaptureRequest) => Promise<PofSnapshotDiffReport | null>;
  saveBaseline: (presetIds: string[]) => Promise<boolean>;
  diffReport: PofSnapshotDiffReport | null;
  isCapturing: boolean;
  error: string | null;
  refreshDiff: () => Promise<void>;
}

export function useSnapshots(): UseSnapshotsResult {
  const [diffReport, setDiffReport] = useState<PofSnapshotDiffReport | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ── Capture snapshots ──────────────────────────────────────────────────────

  const capture = useCallback(async (
    req: PofSnapshotCaptureRequest,
  ): Promise<PofSnapshotDiffReport | null> => {
    setIsCapturing(true);
    setError(null);

    const result = await tryApiFetch<PofSnapshotDiffReport>('/api/pof-bridge/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!mountedRef.current) return result.ok ? result.data : null;

    if (result.ok) {
      setDiffReport(result.data);
      setIsCapturing(false);
      return result.data;
    }

    setError(result.error);
    setIsCapturing(false);
    return null;
  }, []);

  // ── Save baseline ──────────────────────────────────────────────────────────

  const saveBaseline = useCallback(async (presetIds: string[]): Promise<boolean> => {
    setError(null);

    const result = await tryApiFetch<{ saved: number }>('/api/pof-bridge/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'baseline', presetIds }),
    });

    if (!mountedRef.current) return result.ok;

    if (!result.ok) {
      setError(result.error);
      return false;
    }

    return true;
  }, []);

  // ── Refresh diff report ────────────────────────────────────────────────────

  const refreshDiff = useCallback(async () => {
    const result = await tryApiFetch<PofSnapshotDiffReport>('/api/pof-bridge/snapshot');

    if (!mountedRef.current) return;

    if (result.ok) {
      setDiffReport(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
  }, []);

  return {
    capture,
    saveBaseline,
    diffReport,
    isCapturing,
    error,
    refreshDiff,
  };
}
