/**
 * Build run — the pure half of "build from the Build Health tab".
 *
 * `defaultBuildRequest` turns the active project into the POST /api/ue5-bridge/build
 * `start` body (the project's Editor target, Development, Win64), refusing — before
 * any request — a value the route would reject. `buildRunReducer` follows ONE run
 * from dispatch to its persisted result by reading the `?projectPath` poll (queue +
 * history): a finished build leaves the queue (so `?buildId` 404s) and appears in
 * history. A run that is in neither for MAX_MISSED_POLLS polls goes `lost` with a
 * reason — never a silent spinner.
 *
 * Client-safe (no Node imports); the route shares `validateBuildTarget` with it.
 */

import { ok, err, type Result } from '@/types/result';
import type { BuildStatus, BuildRequest } from '@/types/ue5-bridge';

/** UE target names are interpolated into the target and the `.uproject` path. */
export const BUILD_TARGET_NAME_RE = /^[A-Za-z0-9_]+$/;

/** Polls a run may go unseen (in neither queue nor history) before it is `lost`. */
export const MAX_MISSED_POLLS = 20;

/**
 * Trust-boundary check shared by the route (`start`, `rebuild`) and the client.
 * Returns the refusal reason, or null when the pair may reach a spawn.
 */
export function validateBuildTarget(targetName: string, projectPath: string): string | null {
  if (!BUILD_TARGET_NAME_RE.test(targetName)) return 'targetName must be alphanumeric/underscore only';
  if (projectPath.includes('..')) return 'projectPath must not contain ".."';
  return null;
}

export interface BuildProject {
  projectPath: string;
  projectName: string;
  ueVersion: string;
}

export type StartBuildBody = { action: 'start' } & Omit<BuildRequest, 'additionalArgs'>;

export function defaultBuildRequest(project: BuildProject): Result<StartBuildBody, string> {
  const { projectPath, projectName, ueVersion } = project;
  if (!projectPath) return err('projectPath is empty — set up a UE project first');
  if (!projectName) return err('projectName is empty — set up a UE project first');
  if (!ueVersion) return err('ueVersion is empty — set the engine version in project setup');
  if (!BUILD_TARGET_NAME_RE.test(projectName)) {
    return err(`projectName "${projectName}" is not a UE target name (alphanumeric/underscore only)`);
  }
  if (projectPath.includes('..')) return err('projectPath must not contain ".."');
  return ok({
    action: 'start', projectPath, targetName: projectName, targetType: 'Editor',
    configuration: 'Development', platform: 'Win64', ueVersion,
  });
}

/** The UBT target an Editor build of `targetName` runs (executeBuild de-dupes the suffix). */
export function editorTargetLabel(targetName: string): string {
  return targetName.endsWith('Editor') ? targetName : `${targetName}Editor`;
}

// ── Run state machine ────────────────────────────────────────────────────────

export interface BuildPollResponse {
  queue: Array<{ buildId: string; status: BuildStatus; progress?: { message?: string; percent?: number } }>;
  history?: Array<{ buildId: string; status: BuildStatus; errorCount: number }>;
}

export type BuildRunState =
  | { phase: 'idle' }
  | { phase: 'dispatching' }
  | { phase: 'queued'; buildId: string; missedPolls: number }
  | { phase: 'running'; buildId: string; missedPolls: number; percent?: number; message?: string }
  | { phase: 'settled'; buildId: string; status: BuildStatus; errorCount: number; refetchReport: boolean }
  | { phase: 'lost'; buildId: string; reason: string }
  | { phase: 'rejected'; reason: string };

export type BuildRunEvent =
  | { type: 'dispatch' }
  | { type: 'started'; buildId: string }
  | { type: 'rejected'; reason: string }
  | { type: 'poll'; response: BuildPollResponse }
  | { type: 'pollFailed'; reason: string }
  | { type: 'refetched' };

export const BUILD_RUN_IDLE: BuildRunState = { phase: 'idle' };

/** A run is in flight: a new build/rebuild must wait, and the hook polls. */
export function isRunActive(s: BuildRunState): boolean {
  return s.phase === 'dispatching' || s.phase === 'queued' || s.phase === 'running';
}

function missed(
  s: Extract<BuildRunState, { phase: 'queued' | 'running' }>,
  why: string,
): BuildRunState {
  const missedPolls = s.missedPolls + 1;
  if (missedPolls < MAX_MISSED_POLLS) return { ...s, missedPolls };
  return {
    phase: 'lost',
    buildId: s.buildId,
    reason: `${s.buildId} ${why} for ${MAX_MISSED_POLLS} polls — the server may have restarted mid-build; `
      + 'Refresh to see whether it was recorded.',
  };
}

export function buildRunReducer(s: BuildRunState, e: BuildRunEvent): BuildRunState {
  switch (e.type) {
    case 'dispatch':
      return { phase: 'dispatching' };
    case 'started':
      return { phase: 'queued', buildId: e.buildId, missedPolls: 0 };
    case 'rejected':
      return { phase: 'rejected', reason: e.reason };
    case 'refetched':
      return s.phase === 'settled' ? { ...s, refetchReport: false } : s;
    case 'pollFailed':
      return s.phase === 'queued' || s.phase === 'running' ? missed(s, `status unreadable (${e.reason})`) : s;
    case 'poll': {
      if (s.phase !== 'queued' && s.phase !== 'running') return s;
      const item = e.response.queue.find((q) => q.buildId === s.buildId);
      if (item?.status === 'running') {
        return {
          phase: 'running', buildId: s.buildId, missedPolls: 0,
          percent: item.progress?.percent, message: item.progress?.message,
        };
      }
      if (item) return { phase: 'queued', buildId: s.buildId, missedPolls: 0 };
      const done = e.response.history?.find((h) => h.buildId === s.buildId);
      if (done) {
        return { phase: 'settled', buildId: s.buildId, status: done.status, errorCount: done.errorCount, refetchReport: true };
      }
      return missed(s, 'was in neither the queue nor the build history');
    }
  }
}
