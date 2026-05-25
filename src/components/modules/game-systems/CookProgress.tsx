'use client';

import { useEffect, useRef, useState } from 'react';
import type { CookEvent, CookPhase } from '@/lib/packaging/cook-executor';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';

interface CookProgressProps {
  request: { profileId: string; projectPath: string; projectName: string; ueVersion: string } | null;
  onComplete?: (result: { status: 'success' | 'failed'; exePath?: string; error?: string }) => void;
}

const PHASE_LABELS: Record<CookPhase, string> = {
  cook: 'Cooking',
  stage: 'Staging',
  package: 'Packaging',
  done: 'Finished',
};

const MAX_LOG_LINES = 50;

export function CookProgress({ request, onComplete }: CookProgressProps) {
  const [phase, setPhase] = useState<CookPhase | null>(null);
  const [percent, setPercent] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<{ status: 'success' | 'failed'; exePath?: string; error?: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!request) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase(null);
    setPercent(0);
    setLogs([]);
    setResult(null);

    (async () => {
      try {
        const res = await fetch('/api/packaging/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const final = { status: 'failed' as const, error: `HTTP ${res.status}` };
          setResult(final);
          onComplete?.(final);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const data = part.replace(/^data:\s?/, '').trim();
            if (!data) continue;
            let ev: CookEvent;
            try { ev = JSON.parse(data) as CookEvent; } catch { continue; }
            if (ev.type === 'phase') setPhase(ev.phase);
            else if (ev.type === 'progress') setPercent(ev.percent);
            else if (ev.type === 'log') {
              setLogs((prev) => {
                const next = [...prev, ev.line];
                return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
              });
            } else if (ev.type === 'done') {
              const final = { status: 'success' as const, exePath: ev.exePath };
              setResult(final);
              onComplete?.(final);
            } else if (ev.type === 'error') {
              const final = { status: 'failed' as const, error: ev.message };
              setResult(final);
              onComplete?.(final);
            }
          }
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const final = { status: 'failed' as const, error: err instanceof Error ? err.message : String(err) };
        setResult(final);
        onComplete?.(final);
      }
    })();

    return () => { ctrl.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  if (!request && !result) return null;

  return (
    <div data-testid="pof-cook-progress" className="rounded border border-border p-3 bg-surface text-xs font-mono space-y-2">
      <div className="flex items-center gap-3">
        <span data-testid="pof-cook-progress-phase" className="font-semibold">
          {phase ? PHASE_LABELS[phase] : 'Starting…'}
        </span>
        <div className="flex-1 h-1 bg-border rounded overflow-hidden">
          <div
            data-testid="pof-cook-progress-percent"
            data-percent={percent}
            className="h-full bg-accent-strong transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-text-muted tabular-nums">{percent}%</span>
      </div>

      <pre
        data-testid="pof-cook-progress-log"
        className="max-h-40 overflow-y-auto whitespace-pre-wrap text-text-muted text-2xs leading-relaxed"
      >
        {logs.join('\n')}
      </pre>

      {result && (
        <div
          data-testid="pof-cook-progress-result"
          data-status={result.status}
          style={{ color: result.status === 'success' ? STATUS_SUCCESS : STATUS_ERROR }}
        >
          {result.status === 'success'
            ? <>Cook succeeded: <span data-testid="pof-cook-progress-exe-path">{result.exePath}</span></>
            : <>Cook failed: {result.error}</>}
        </div>
      )}
    </div>
  );
}
