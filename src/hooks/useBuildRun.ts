'use client';

/**
 * useBuildRun — start (or re-run) ONE headless UE build and follow it to its
 * persisted result. Dispatch happens only through `buildNow` / `rebuild` /
 * `abort` (a click); mounting, polling and the settle refetch never POST.
 *
 * Polls GET /api/ue5-bridge/build?projectPath every UI_TIMEOUTS.pollInterval while
 * the run is queued/running (paused while the module is suspended) and calls
 * `onSettled` once when the build lands in history, so the report can refetch.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import {
  buildRunReducer, defaultBuildRequest, BUILD_RUN_IDLE,
  type BuildProject, type BuildPollResponse, type BuildRunState,
} from '@/lib/ue5-bridge/build-run';

const BUILD_URL = '/api/ue5-bridge/build';

async function postBuild(body: object) {
  return tryApiFetch<{ buildId: string }>(BUILD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface UseBuildRun {
  state: BuildRunState;
  buildNow: () => void;
  rebuild: (buildId: string) => void;
  abort: () => void;
}

export function useBuildRun({ project, onSettled }: { project: BuildProject; onSettled: () => void }): UseBuildRun {
  const [state, dispatch] = useReducer(buildRunReducer, BUILD_RUN_IDLE);
  const { projectPath, projectName, ueVersion } = project;

  const dispatchBuild = useCallback(async (body: object) => {
    dispatch({ type: 'dispatch' });
    const r = await postBuild(body);
    dispatch(r.ok ? { type: 'started', buildId: r.data.buildId } : { type: 'rejected', reason: r.error });
  }, []);

  const buildNow = useCallback(() => {
    const req = defaultBuildRequest({ projectPath, projectName, ueVersion });
    if (!req.ok) {
      dispatch({ type: 'rejected', reason: req.error });
      return;
    }
    void dispatchBuild(req.data);
  }, [projectPath, projectName, ueVersion, dispatchBuild]);

  const rebuild = useCallback((buildId: string) => {
    void dispatchBuild({ action: 'rebuild', buildId });
  }, [dispatchBuild]);

  const activeId = state.phase === 'queued' || state.phase === 'running' ? state.buildId : null;

  const abort = useCallback(() => {
    // The next poll settles the run as 'aborted' from history.
    if (activeId) void postBuild({ action: 'abort', buildId: activeId });
  }, [activeId]);

  // Poll only while a run is in flight; the chain restarts only when the id changes.
  useSuspendableEffect(() => {
    if (!activeId || !projectPath) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await tryApiFetch<BuildPollResponse>(`${BUILD_URL}?projectPath=${encodeURIComponent(projectPath)}`);
      if (cancelled) return;
      dispatch(r.ok ? { type: 'poll', response: r.data } : { type: 'pollFailed', reason: r.error });
      timer = setTimeout(tick, UI_TIMEOUTS.pollInterval);
    };
    timer = setTimeout(tick, UI_TIMEOUTS.pollInterval);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeId, projectPath]);

  const onSettledRef = useRef(onSettled);
  useEffect(() => { onSettledRef.current = onSettled; }, [onSettled]);
  const refetchDue = state.phase === 'settled' && state.refetchReport;
  useEffect(() => {
    if (!refetchDue) return;
    dispatch({ type: 'refetched' });
    onSettledRef.current();
  }, [refetchDue]);

  return { state, buildNow, rebuild, abort };
}
