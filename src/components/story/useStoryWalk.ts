'use client';

/**
 * Start a walker job for one stored story graph and follow it to the end.
 *
 * `start()` POSTs `/api/story/walk` and the hook then polls `GET /api/story/walk/:jobId` every
 * `UI_TIMEOUTS.storyWalkPoll` until the job is `done` or `failed`. The poll is a
 * `useSuspendableEffect`, so it pauses while the surface is hidden, and every async continuation
 * checks a liveness flag first: after unmount there is no further fetch and no setState, and the
 * pending timer is cleared in the effect's cleanup.
 *
 * Failures are reported with the server's own reason (`tryApiFetch` unwraps the envelope's
 * `error`), so a 401/403/404 says why instead of "failed".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { logger } from '@/lib/logger';
import type { WalkerReport } from '@/lib/story/types';

export interface WalkTarget {
  graphId: string;
  project: string;
}

export interface WalkProgress {
  done: number;
  total: number;
}

/** A finished walk, as the surface keeps it. */
export interface WalkResult {
  jobId: string;
  report: WalkerReport;
  durationMs?: number;
}

export type WalkPhase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; jobId: string; state: 'queued' | 'running'; progress: WalkProgress }
  | { kind: 'done'; result: WalkResult }
  | { kind: 'failed'; message: string };

/** `GET /api/story/walk/:jobId` payload (only what this hook reads). */
interface WalkJobView {
  jobId: string;
  state: 'queued' | 'running' | 'done' | 'failed';
  progress: WalkProgress;
  report?: WalkerReport;
  error?: string;
  durationMs?: number;
}

interface WalkStart {
  jobId: string;
  state: 'queued' | 'running';
  progress: WalkProgress;
}

export interface UseStoryWalkOptions {
  seed?: number;
  samples?: number;
  onDone?: (result: WalkResult) => void;
}

export function useStoryWalk(target: WalkTarget | null, opts: UseStoryWalkOptions = {}) {
  const [phase, setPhase] = useState<WalkPhase>({ kind: 'idle' });
  const alive = useRef(true);
  const onDone = useRef(opts.onDone);

  useEffect(() => {
    onDone.current = opts.onDone;
  }, [opts.onDone]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const { seed, samples } = opts;
  const start = useCallback(async () => {
    if (!target) return;
    setPhase({ kind: 'starting' });
    const body: Record<string, unknown> = { graphId: target.graphId, project: target.project };
    if (seed !== undefined) body.seed = seed;
    if (samples !== undefined) body.samples = samples;
    const res = await tryApiFetch<WalkStart>('/api/story/walk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!alive.current) return;
    if (!res.ok) {
      logger.warn(`[story/walk] start failed for ${target.project}/${target.graphId}: ${res.error}`);
      setPhase({ kind: 'failed', message: res.error });
      return;
    }
    setPhase({ kind: 'running', jobId: res.data.jobId, state: res.data.state, progress: res.data.progress });
  }, [target, seed, samples]);

  const reset = useCallback(() => setPhase({ kind: 'idle' }), []);

  // One poll per phase object: every tick sets a NEW running phase, which re-arms the effect.
  useSuspendableEffect(() => {
    if (phase.kind !== 'running') return;
    let live = true;
    const ac = new AbortController();
    const jobId = phase.jobId;
    const timer = setTimeout(() => {
      void tryApiFetch<WalkJobView>(`/api/story/walk/${encodeURIComponent(jobId)}`, { signal: ac.signal }).then((res) => {
        if (!live || !alive.current) return;
        if (!res.ok) {
          setPhase({ kind: 'failed', message: res.error });
          return;
        }
        const job = res.data;
        if (job.state === 'done' && job.report) {
          const result: WalkResult = { jobId, report: job.report, durationMs: job.durationMs };
          setPhase({ kind: 'done', result });
          onDone.current?.(result);
        } else if (job.state === 'failed' || job.state === 'done') {
          setPhase({ kind: 'failed', message: job.error ?? 'the walk finished without a report' });
        } else {
          setPhase({ kind: 'running', jobId, state: job.state, progress: job.progress });
        }
      });
    }, UI_TIMEOUTS.storyWalkPoll);
    return () => {
      live = false;
      clearTimeout(timer);
      ac.abort();
    };
  }, [phase]);

  return { phase, start, reset };
}
