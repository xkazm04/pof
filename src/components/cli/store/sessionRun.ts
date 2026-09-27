'use client';

import type { CallbackStatus } from '@/lib/cli-task';
import { useCLIPanelStore } from './cliPanelStore';

/** The three terminal lifecycle signals a host forwards to CompactTerminal. */
export interface SessionRunHandlers {
  /** Run dispatched (fired synchronously by useTaskQueue before any await). */
  onTaskStart: (taskId: string) => void;
  /** Stream phase hint: true is ignored (onTaskStart begins the run), false moves it to 'settling'. */
  onStreamingChange: (streaming: boolean) => void;
  /** The run's single completion (useTaskQueue.finishRun) — ends it with its outcome. */
  onTaskComplete: (taskId: string, success: boolean, meta?: { callbackStatus?: CallbackStatus }) => void;
}

/**
 * Bind a session's run lifecycle to the cliPanelStore run door.
 *
 * Terminal signals are OBSERVATIONS, not commands: each is reported through the
 * store's sequenced door (beginRun → settleRun → endRun), which ignores a signal
 * for a run that is no longer current. Stream end is NOT run end — the session
 * stays isRunning ('settling') until the completion carries this run's outcome,
 * so no consumer reading the isRunning edge can see the previous run's outcome.
 */
export function bindSessionRun(sessionId: string): SessionRunHandlers {
  /** Seq of the run this binding began, or null when none is open. */
  let seq: number | null = null;
  const store = () => useCLIPanelStore.getState();

  return {
    onTaskStart: () => {
      seq = store().beginRun(sessionId);
    },
    onStreamingChange: (streaming) => {
      if (streaming || seq === null) return;
      store().settleRun(sessionId, seq);
    },
    onTaskComplete: (_taskId, success, meta) => {
      // A binding re-created mid-run (host remount) falls back to the store's current run.
      const runSeq = seq ?? store().sessions[sessionId]?.runSeq ?? 0;
      seq = null;
      store().endRun(sessionId, runSeq, { success, callbackStatus: meta?.callbackStatus ?? null });
    },
  };
}
