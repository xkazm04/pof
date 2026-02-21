'use client';

/**
 * React hook for the headless UE5 build pipeline.
 *
 * Provides queue state, recent build history, and actions to start/abort
 * builds. Polls the API while a build is active.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { BuildQueueItem, BuildResult, BuildRequest } from '@/types/ue5-bridge';

// ── Response types ───────────────────────────────────────────────────────────

interface QueueResponse {
  queue: BuildQueueItem[];
  history?: BuildResult[];
}

interface StartBuildRequest {
  action: 'start';
  projectPath: string;
  targetName: string;
  ueVersion: string;
  platform?: string;
  configuration?: string;
  targetType?: string;
  additionalArgs?: string[];
  moduleId?: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseBuildPipelineResult {
  /** All items currently in the build queue (running + pending) */
  queue: BuildQueueItem[];
  /** True if any build is currently running or queued */
  isBuilding: boolean;
  /** The currently running build item, if any */
  currentBuild: BuildQueueItem | null;
  /** Recent completed builds (requires projectPath to be set) */
  recentBuilds: BuildResult[];
  /** Start a new build. Returns the buildId. */
  startBuild: (request: Omit<BuildRequest, 'platform' | 'configuration' | 'targetType'> & {
    platform?: string;
    configuration?: string;
    targetType?: string;
    moduleId?: string;
  }) => Promise<string | null>;
  /** Abort a running or queued build */
  abortBuild: (buildId: string) => Promise<boolean>;
  /** Manually refresh queue state */
  refresh: () => Promise<void>;
}

export function useBuildPipeline(projectPath?: string): UseBuildPipelineResult {
  const [queue, setQueue] = useState<BuildQueueItem[]>([]);
  const [recentBuilds, setRecentBuilds] = useState<BuildResult[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);

  // Track mounted state to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ── Refresh ──────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (projectPath) {
        params.set('projectPath', projectPath);
      }
      const url = `/api/ue5-bridge/build${params.toString() ? `?${params}` : ''}`;
      const data = await apiFetch<QueueResponse>(url);

      if (!mountedRef.current) return;

      setQueue(data.queue);
      if (data.history) {
        setRecentBuilds(data.history);
      }

      // Determine if any builds are active
      const hasActive = data.queue.some(
        (item) => item.status === 'queued' || item.status === 'running',
      );
      setIsBuilding(hasActive);
    } catch {
      // Silently fail — API might not be available yet
    }
  }, [projectPath]);

  // ── Poll while building ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isBuilding) return;

    const interval = setInterval(() => {
      refresh();
    }, UI_TIMEOUTS.buildPollInterval);

    return () => clearInterval(interval);
  }, [isBuilding, refresh]);

  // ── Initial fetch ────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    apiFetch<QueueResponse>(
      `/api/ue5-bridge/build${projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : ''}`,
    )
      .then((data) => {
        if (cancelled) return;
        setQueue(data.queue);
        if (data.history) setRecentBuilds(data.history);
        setIsBuilding(data.queue.some((i) => i.status === 'queued' || i.status === 'running'));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectPath]);

  // ── Start Build ──────────────────────────────────────────────────────────

  const startBuild = useCallback(async (
    request: Omit<BuildRequest, 'platform' | 'configuration' | 'targetType'> & {
      platform?: string;
      configuration?: string;
      targetType?: string;
      moduleId?: string;
    },
  ): Promise<string | null> => {
    try {
      const body: StartBuildRequest = {
        action: 'start',
        projectPath: request.projectPath,
        targetName: request.targetName,
        ueVersion: request.ueVersion,
        platform: request.platform,
        configuration: request.configuration,
        targetType: request.targetType,
        additionalArgs: request.additionalArgs,
        moduleId: request.moduleId,
      };

      const data = await apiFetch<{ buildId: string }>('/api/ue5-bridge/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Set building state immediately for responsive UI
      if (mountedRef.current) {
        setIsBuilding(true);
      }

      // Refresh to get the updated queue
      await refresh();

      return data.buildId;
    } catch {
      return null;
    }
  }, [refresh]);

  // ── Abort Build ──────────────────────────────────────────────────────────

  const abortBuild = useCallback(async (buildId: string): Promise<boolean> => {
    try {
      await apiFetch<{ aborted: boolean; buildId: string }>('/api/ue5-bridge/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abort', buildId }),
      });

      await refresh();
      return true;
    } catch {
      return false;
    }
  }, [refresh]);

  // ── Derived state ────────────────────────────────────────────────────────

  const currentBuild = queue.find((item) => item.status === 'running') ?? null;

  return {
    queue,
    isBuilding,
    currentBuild,
    recentBuilds,
    startBuild,
    abortBuild,
    refresh,
  };
}
