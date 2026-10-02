import type { CallbackStatus } from '@/lib/cli-task';
import type { HiddenRunStatus } from './types';

/**
 * What the tab learned when it asked the server about its run
 * (GET /api/claude-terminal/query?executionId=…):
 * - `status`      — the server's execution record,
 * - `not-found`   — the server no longer holds the execution (ended > 1 h ago, or a restart),
 * - `unreachable` — no answer at all (network down, server restarting, bad reply).
 */
export type RunObservation =
  | { kind: 'status'; status: HiddenRunStatus }
  | { kind: 'not-found' }
  | { kind: 'unreachable' };

/**
 * The arbitrated verdict:
 * - `reconnect` — the run is live: keep it, re-open the stream at the seq cursor if it is closed,
 * - `wait`      — no conclusion yet: keep the run and ask again later,
 * - `end`       — the run is over; `outcomeUnknown` when its end was never observed.
 */
export type RunVerdict =
  | { kind: 'reconnect' }
  | { kind: 'wait' }
  | { kind: 'end'; success: boolean; callbackStatus?: CallbackStatus; outcomeUnknown?: true };

/**
 * The ONE rule for "is this run over", used by every NON-positive observer of a run —
 * stream `onerror`, the visible silence watchdog, the stuck poller and the hidden poll.
 * None of them may conclude a run from the absence of evidence: they only ask the server
 * and apply this verdict. Positive terminators (the `result`/`error` frames, start
 * failure, user Abort) end the run directly and never come through here.
 *
 * `declared` — the run declared @@CALLBACKs, so a clean end waits for the server's verdict.
 */
export function arbitrateRunEnd(obs: RunObservation, { declared }: { declared: boolean }): RunVerdict {
  if (obs.kind === 'unreachable') return { kind: 'wait' }; // unknown is not a value: never "failed"
  if (obs.kind === 'not-found') return { kind: 'end', success: false, outcomeUnknown: true };
  const ex = obs.status;
  if (ex.status === 'running') return { kind: 'reconnect' };
  const clean = ex.status === 'completed';
  if (clean && declared && !ex.callbackStatus) return { kind: 'wait' }; // the server is still settling
  const success = clean && !ex.isError;
  const callbackStatus = clean && declared ? ex.callbackStatus ?? undefined : undefined;
  return callbackStatus ? { kind: 'end', success, callbackStatus } : { kind: 'end', success };
}
