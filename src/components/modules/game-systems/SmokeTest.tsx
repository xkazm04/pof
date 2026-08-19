'use client';

import { useEffect, useRef, useState } from 'react';
import { Rocket, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO, STATUS_WARNING } from '@/lib/chart-colors';
import type { SmokeTestResult } from '@/lib/packaging/smoke-test';

export interface SmokeTestRequest {
  exePath: string;
  projectName: string;
  platform: string;
  config: string;
  /**
   * The project that cooked this build. Without it the server picks the build to
   * record against with an UNSCOPED query and the verdict lands on whichever
   * unattributed legacy row is newest.
   */
  projectPath?: string;
}

/** The final smoke verdict, as the server recorded it. */
interface SmokeTestResponse {
  result: SmokeTestResult;
  recordedToBuildId: number | null;
  /** The build's status AFTER the verdict, or null when nothing received it. */
  buildStatus?: 'success' | 'failed' | 'cancelled' | null;
  /** True when the verdict CHANGED the recorded status — the panel must say so. */
  statusChanged?: boolean;
  /** Why nothing was recorded; never a silent null beside a pass. */
  unrecordedReason?: string | null;
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
  const [verdict, setVerdict] = useState<SmokeTestResponse | null>(null);
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
      setVerdict(res.data);
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

      {verdict && <SmokeVerdictLine verdict={verdict} />}
    </div>
  );
}

/**
 * The final smoke verdict, as build history now holds it.
 *
 * The cook's SSE stream already emitted `done: success` and `CookProgress` still shows
 * it. A failing smoke now flips the recorded build to `failed`, so without this line
 * the panel above and the row in the DB would disagree and nothing on screen would
 * say which is true. It also states plainly when NOTHING received the verdict —
 * previously a `recordedToBuildId: null` sitting quietly beside a pass.
 */
function SmokeVerdictLine({ verdict }: { verdict: SmokeTestResponse }) {
  if (verdict.unrecordedReason) {
    return (
      <div
        data-testid="pof-smoke-verdict"
        data-verdict="unrecorded"
        className="flex items-start gap-2 font-mono"
        style={{ color: STATUS_WARNING }}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>Not recorded — {verdict.unrecordedReason}</span>
      </div>
    );
  }
  if (verdict.recordedToBuildId == null) return null;

  const condemned = verdict.statusChanged === true;
  return (
    <div
      data-testid="pof-smoke-verdict"
      data-verdict={condemned ? 'condemned' : 'recorded'}
      className="flex items-start gap-2 font-mono"
      style={{ color: condemned ? STATUS_ERROR : STATUS_INFO }}
    >
      {condemned
        ? <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        : <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />}
      <span>
        {condemned
          ? `Build #${verdict.recordedToBuildId} was re-recorded as failed — the cook succeeded, the packaged exe did not run.`
          : `Recorded against build #${verdict.recordedToBuildId} (status ${verdict.buildStatus ?? 'unchanged'}).`}
      </span>
    </div>
  );
}
