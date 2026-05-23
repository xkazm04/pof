'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { eventBus } from '@/lib/event-bus';
import { UI_TIMEOUTS } from '@/lib/constants';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_INFO, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import { computeDispatchHealth, type DispatchHealth } from './dispatchHealth';

/**
 * Dev panel surfacing CLI dispatch reliability — the permanent monitor the
 * SP-A→SP-B remediation deserved. Reads the event bus's `cli.*` replay buffer +
 * live stream and renders sent / acknowledged / in-flight / stuck / failed.
 * A growing `stuck` count is the early signal of the chained-`isRunning` hang
 * that silently burned four 40-minute live runs.
 */
export function DispatchHealthPanel() {
  const [health, setHealth] = useState<DispatchHealth>(() =>
    computeDispatchHealth(eventBus.getReplayByNamespace('cli')),
  );

  useEffect(() => {
    const recompute = () => setHealth(computeDispatchHealth(eventBus.getReplayByNamespace('cli')));
    // Recompute on every cli.* event…
    const unsub = eventBus.onNamespace('cli', recompute);
    // …and on a timer so `stuck` (a time-based threshold) updates while idle.
    const timer = setInterval(recompute, UI_TIMEOUTS.stuckCheckInterval);
    recompute();
    return () => { unsub(); clearInterval(timer); };
  }, []);

  const stats = useMemo(() => ([
    { key: 'sent', label: 'Sent', value: health.sent, color: STATUS_INFO, Icon: Activity },
    { key: 'acked', label: 'Acked', value: health.acknowledged, color: STATUS_SUCCESS, Icon: CheckCircle },
    { key: 'inflight', label: 'In-flight', value: health.inFlight, color: STATUS_WARNING, Icon: Loader2 },
    { key: 'stuck', label: 'Stuck', value: health.stuck, color: health.stuck > 0 ? STATUS_ERROR : STATUS_NEUTRAL, Icon: AlertTriangle },
    { key: 'failed', label: 'Failed', value: health.failed, color: health.failed > 0 ? STATUS_ERROR : STATUS_NEUTRAL, Icon: XCircle },
  ]), [health]);

  return (
    <div
      data-testid="pof-dispatch-health-panel"
      className="rounded border border-white/10 bg-black/20 p-3 text-xs"
    >
      <div className="mb-2 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5" style={{ color: STATUS_INFO }} />
        <span className="font-semibold text-text-muted">CLI Dispatch Health</span>
        <span className="ml-auto text-text-muted">
          {health.activeSessions} active session{health.activeSessions !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {stats.map(({ key, label, value, color, Icon }) => (
          <div
            key={key}
            data-testid={`pof-dispatch-health-${key}`}
            data-value={value}
            className="flex flex-col items-center gap-0.5 rounded bg-white/[0.03] py-1.5"
          >
            <Icon className="h-3 w-3" style={{ color }} />
            <span className="text-sm font-semibold tabular-nums" style={{ color }}>{value}</span>
            <span className="text-[10px] text-text-muted">{label}</span>
          </div>
        ))}
      </div>

      {health.recent.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">Recent</div>
          <ul className="space-y-0.5">
            {health.recent.slice(0, 6).map((e) => {
              const pending = e.completedAt === undefined;
              const color = pending ? STATUS_WARNING : e.success ? STATUS_SUCCESS : STATUS_ERROR;
              const status = pending ? 'running' : e.success ? 'ok' : 'fail';
              return (
                <li key={`${e.tabId}-${e.startedAt}`} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate text-text-muted">{e.sessionLabel}</span>
                  <span className="ml-auto text-[10px]" style={{ color }}>{status}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
