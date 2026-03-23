'use client';

/**
 * React hook for PoF Bridge live coding (hot-reload compile).
 *
 * Triggers a compile via the API proxy and polls for completion. Returns the
 * final compile result including diagnostics and summary.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type {
  PofCompileRequest,
  PofCompileResult,
  PofCompileStatus,
  PofHotPatchRequest,
  PofHotPatchResult,
  PofPatchPhase,
} from '@/types/pof-bridge';

/** Polling interval while compile is in progress (ms). */
const COMPILE_POLL_INTERVAL = 2_000;

/** Maximum time to wait for a compile before giving up (ms). */
const COMPILE_POLL_TIMEOUT = 180_000;

interface UseLiveCodingResult {
  compile: (req?: PofCompileRequest) => Promise<PofCompileResult | null>;
  hotPatch: (req: PofHotPatchRequest) => Promise<PofHotPatchResult | null>;
  result: PofCompileResult | null;
  hotPatchResult: PofHotPatchResult | null;
  patchPhase: PofPatchPhase;
  isCompiling: boolean;
  isPatching: boolean;
  error: string | null;
  isAvailable: boolean;
  isProbing: boolean;
}

export function useLiveCoding(): UseLiveCodingResult {
  const [result, setResult] = useState<PofCompileResult | null>(null);
  const [hotPatchResult, setHotPatchResult] = useState<PofHotPatchResult | null>(null);
  const [patchPhase, setPatchPhase] = useState<PofPatchPhase>('idle');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isProbing, setIsProbing] = useState(true);

  const mountedRef = useRef(true);
  const abortRef = useRef(false);

  useEffect(() => {
    // Probe for live coding availability
    let cancelled = false;
    (async () => {
      const probeResult = await tryApiFetch<{ liveCodingEnabled: boolean }>('/api/pof-bridge/status');
      if (!cancelled && mountedRef.current) {
        setIsAvailable(probeResult.ok ? probeResult.data.liveCodingEnabled : false);
        setIsProbing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current = true;
    };
  }, []);

  // ── Poll compile status ────────────────────────────────────────────────────

  const pollCompileStatus = useCallback(async (): Promise<PofCompileResult | null> => {
    const startTime = Date.now();

    while (!abortRef.current) {
      if (Date.now() - startTime > COMPILE_POLL_TIMEOUT) {
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, COMPILE_POLL_INTERVAL));

      if (abortRef.current) return null;

      const statusResult = await tryApiFetch<PofCompileResult>('/api/pof-bridge/compile');

      if (!statusResult.ok) continue; // Retry on transient errors

      const status: PofCompileStatus = statusResult.data.status;
      if (status !== 'compiling') {
        return statusResult.data;
      }
    }

    return null;
  }, []);

  // ── Trigger compile ────────────────────────────────────────────────────────

  const compile = useCallback(async (
    req?: PofCompileRequest,
  ): Promise<PofCompileResult | null> => {
    setIsCompiling(true);
    setError(null);
    abortRef.current = false;

    // Trigger the compile
    const triggerResult = await tryApiFetch<PofCompileResult>('/api/pof-bridge/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req ?? {}),
    });

    if (!triggerResult.ok) {
      if (mountedRef.current) {
        setError(triggerResult.error);
        setIsCompiling(false);
      }
      return null;
    }

    // If the result came back immediately (already finished), we're done
    if (triggerResult.data.status !== 'compiling') {
      if (mountedRef.current) {
        setResult(triggerResult.data);
        setIsCompiling(false);
      }
      return triggerResult.data;
    }

    // Poll until completion
    const finalResult = await pollCompileStatus();

    if (!mountedRef.current) return finalResult;

    if (finalResult) {
      setResult(finalResult);
    } else {
      setError('Compile timed out or was aborted');
    }

    setIsCompiling(false);
    return finalResult;
  }, [pollCompileStatus]);

  // ── Hot-patch ──────────────────────────────────────────────────────────────

  const hotPatch = useCallback(async (
    req: PofHotPatchRequest,
  ): Promise<PofHotPatchResult | null> => {
    setIsPatching(true);
    setPatchPhase('writing_file');
    setError(null);

    const patchResult = await tryApiFetch<PofHotPatchResult>(
      '/api/pof-bridge/compile/hot-patch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      },
    );

    if (!mountedRef.current) return patchResult.ok ? patchResult.data : null;

    if (!patchResult.ok) {
      setError(patchResult.error);
      setPatchPhase('failed');
      setIsPatching(false);
      return null;
    }

    setHotPatchResult(patchResult.data);
    setPatchPhase(patchResult.data.patchPhase);
    setIsPatching(false);
    return patchResult.data;
  }, []);

  return {
    compile,
    hotPatch,
    result,
    hotPatchResult,
    patchPhase,
    isCompiling,
    isPatching,
    error,
    isAvailable,
    isProbing,
  };
}
