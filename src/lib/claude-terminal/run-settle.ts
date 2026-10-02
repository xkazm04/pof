/**
 * One settlement for a server-side Claude CLI run.
 *
 * Every server path that spawns a run and waits for it (`awaitCallback` for the one-shot
 * routes, batch review, the deep-eval job) settles through `settleExecution`. It
 * settles the moment the run ends, never later, and a failure carries a reason from a
 * closed vocabulary instead of a distinguishing string inside an Error:
 *
 *  - `no-callback`  the run ended cleanly without a `@@CALLBACK` (expect: 'callback')
 *  - `timeout`      the caller's window (or the runaway guard) elapsed; a still-running
 *                   run is aborted first
 *  - `cancelled`    the caller's signal fired, or someone else aborted the run
 *  - `exit-nonzero` the process exited with a non-zero code
 *  - `error-result` the CLI reported `result{isError:true}`
 *  - `spawn-error`  the process never started (sync or async spawn failure)
 *  - `not-found`    no execution has that id
 *
 * State is read at subscribe time (the event backlog, then the status), so a run that
 * already ended — including a spawn that failed synchronously inside `startExecution`
 * — settles at once instead of waiting on events that will never come. A clean exit
 * with no result event emits nothing, so the seam also listens for the process
 * `close` (registered after cli-service's own handler, so the status is final by then).
 *
 * Only a run that is still `running` is ever aborted: a timeout never taskkills an
 * exited (and reusable) PID, and a `completed` run stays `completed`.
 *
 * Server-only. Not to be confused with the client store door `cliPanelStore.settleRun`.
 */

import { getExecution, abortExecution } from '@/lib/claude-terminal/cli-service';
import type { CLIExecutionEvent } from '@/lib/claude-terminal/cli-service';
import { parseCallbackMarker } from '@/lib/cli-task';
import type { ParsedCallbackMarker } from '@/lib/cli-task';
import { ok, err } from '@/types/result';
import type { Result } from '@/types/result';

export type RunSettleReason =
  | 'no-callback'
  | 'timeout'
  | 'cancelled'
  | 'exit-nonzero'
  | 'error-result'
  | 'spawn-error'
  | 'not-found';

export interface RunSettleError {
  reason: RunSettleReason;
  /** Human-readable, names the execution; `awaitCallback` throws exactly this. */
  message: string;
}

export interface SettledRun {
  /** Every `text` event's content, concatenated in order. */
  text: string;
  /** The first parsed `@@CALLBACK` marker (always set when expect is 'callback'). */
  callback: ParsedCallbackMarker | null;
}

export interface SettleOptions {
  /** 'callback': ok on the first valid marker. 'end': ok on a clean end, with the text. */
  expect: 'callback' | 'end';
  /** Omitted = no caller window (the 100-min runaway guard in cli-service still applies). */
  timeoutMs?: number;
  /** Aborting it cancels the wait AND kills the run if it is still running. */
  signal?: AbortSignal;
}

export type RunSettlement = Result<SettledRun, RunSettleError>;

/** Settle one CLI run. Never rejects: every outcome is a typed Result. */
export function settleExecution(executionId: string, opts: SettleOptions): Promise<RunSettlement> {
  return new Promise<RunSettlement>((resolve) => {
    const execution = getExecution(executionId);
    if (!execution) {
      resolve(err({ reason: 'not-found', message: `execution ${executionId} not found` }));
      return;
    }

    const texts: string[] = [];
    let callback: ParsedCallbackMarker | null = null;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const proc = execution.process;

    const settle = (outcome: RunSettlement) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      execution.listeners.delete(onEvent);
      proc?.off('close', onClose);
      opts.signal?.removeEventListener('abort', onAbort);
      resolve(outcome);
    };
    const fail = (reason: RunSettleReason, message: string) => settle(err({ reason, message }));
    const succeed = () => settle(ok({ text: texts.join(''), callback }));

    /** Abort only a run that is still running — never an exited PID. */
    const stopIfRunning = (): boolean => execution.status === 'running' && abortExecution(executionId);

    const onEvent = (ev: CLIExecutionEvent) => {
      if (settled) return;
      if (ev.type === 'text' && typeof ev.data.content === 'string') {
        texts.push(ev.data.content);
        const marker = callback ? null : parseCallbackMarker(ev.data.content);
        if (marker && marker.data !== null) {
          callback = marker;
          if (opts.expect === 'callback') succeed();
        }
      } else if (ev.type === 'result' && ev.data.isError) {
        fail('error-result', `execution ${executionId} reported an error result`);
      } else if (ev.type === 'error') {
        const detail = String(ev.data.message ?? 'execution error');
        if (execution.aborted) fail('cancelled', `execution ${executionId} was aborted (${detail})`);
        else if (ev.data.timedOut === true) fail('timeout', `execution ${executionId}: ${detail}`);
        else if (typeof ev.data.exitCode === 'number') {
          fail('exit-nonzero', `execution ${executionId} failed with exit code ${ev.data.exitCode}`);
        } else fail('spawn-error', `execution ${executionId} failed to start: ${detail}`);
      }
    };

    /** The run is over and no terminal event settled it: decide from the final status. */
    const settleFromStatus = () => {
      switch (execution.status) {
        case 'completed':
          if (opts.expect === 'end' || callback) succeed();
          else fail('no-callback', `execution ${executionId} ended without a callback`);
          return;
        case 'aborted':
          fail('cancelled', `execution ${executionId} was aborted`);
          return;
        case 'error':
          fail('exit-nonzero', `execution ${executionId} ended in error`);
          return;
        case 'running':
          return;
      }
    };

    function onClose() { settleFromStatus(); }

    function onAbort() {
      const aborted = stopIfRunning();
      fail('cancelled', `execution ${executionId} cancelled${aborted ? ' (execution aborted)' : ''}`);
    }

    // 1. What already happened: replay the backlog, then the status.
    for (const ev of execution.events) {
      onEvent(ev);
      if (settled) return;
    }
    if (execution.status !== 'running') { settleFromStatus(); return; }
    if (opts.signal?.aborted) { onAbort(); return; }

    // 2. What happens next.
    execution.listeners.add(onEvent);
    proc?.on('close', onClose);
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    if (opts.timeoutMs !== undefined) {
      const ms = opts.timeoutMs;
      timer = setTimeout(() => {
        const aborted = stopIfRunning();
        const suffix = aborted ? ' (execution aborted)' : ' (no process to abort)';
        fail('timeout', opts.expect === 'callback'
          ? `callback timeout after ${ms}ms for execution ${executionId}${suffix}`
          : `execution ${executionId} timed out after ${ms}ms${suffix}`);
      }, ms);
    }
  });
}
