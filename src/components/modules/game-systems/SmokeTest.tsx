'use client';

import { useEffect, useRef, useState } from 'react';
import { Rocket, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO } from '@/lib/chart-colors';
import type { SmokeTestResult } from '@/lib/packaging/smoke-test';

export interface SmokeTestRequest {
  exePath: string;
  projectName: string;
  platform: string;
  config: string;
}

interface SmokeTestResponse {
  result: SmokeTestResult;
  recordedToBuildId: number | null;
}

interface SmokeTestProps {
  request: SmokeTestRequest | null;
  onComplete?: (result: SmokeTestResult) => void;
}

const OBSERVE_LABEL_MS = 25;

// Parent gives this component a `key` tied to the request, so each new cook
// remounts it fresh — letting `running` initialize from the request without a
// synchronous state reset inside the effect.
export function SmokeTest({ request, onComplete }: SmokeTestProps) {
  const [running, setRunning] = useState<boolean>(!!request);
  const [result, setResult] = useState<SmokeTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;

    (async () => {
      const res = await tryApiFetch<SmokeTestResponse>('/api/packaging/smoke-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (cancelled) return;
      setRunning(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data.result);
      onCompleteRef.current?.(res.data.result);
    })();

    return () => { cancelled = true; };
  }, [request]);

  if (!request && !result && !error && !running) return null;

  return (
    <div
      data-testid="pof-smoke-test"
      data-status={result?.status ?? (running ? 'running' : 'idle')}
      role="status"
      aria-live="polite"
      className="rounded border border-border bg-surface p-3 text-xs space-y-1.5"
    >
      <div className="flex items-center gap-2">
        <Rocket className="w-4 h-4" style={{ color: STATUS_INFO }} aria-hidden="true" />
        <span className="font-semibold text-text">Runnable .exe smoke-test</span>
      </div>

      {running && (
        <div className="flex items-center gap-2 text-text-muted font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Launching staged build, observing ~{OBSERVE_LABEL_MS}s…
        </div>
      )}

      {error && (
        <div data-testid="pof-smoke-test-error" className="font-mono" style={{ color: STATUS_ERROR }}>
          {error}
        </div>
      )}

      {result && (
        <div
          data-testid="pof-smoke-test-result"
          data-status={result.status}
          className="flex items-start gap-2 font-mono"
          style={{ color: result.status === 'pass' ? STATUS_SUCCESS : STATUS_ERROR }}
        >
          {result.status === 'pass'
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />}
          <span>
            {result.status === 'pass'
              ? `${result.gameImage} survived ${Math.round(result.observedMs / 1000)}s — the cooked build runs.`
              : result.spawnError
                ? `launch failed: ${result.spawnError}`
                : `${result.gameImage} did not survive the ${Math.round(result.observedMs / 1000)}s observe window.`}
          </span>
        </div>
      )}
    </div>
  );
}
