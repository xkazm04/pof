/**
 * Build run — the pure half of "build from the Build Health tab".
 *
 * `defaultBuildRequest` turns the active project into the POST /api/ue5-bridge/build
 * `start` body (the project's Editor target, Development, Win64), refusing — before
 * any request — a value the route would reject. `buildRunReducer` follows ONE run
 * from dispatch to its persisted result by reading `GET ?buildId` (the server answers
 * every stage from the live queue item or the build's `headless_builds` row, see
 * build-status.ts). A run whose status is unreadable for MAX_MISSED_POLLS polls
 * goes `lost` with a reason — never a silent spinner.
 *
 * Client-safe (no Node imports); the route shares `validateBuildTarget` with it.
 */

import { ok, err, type Result } from '@/types/result';
import { isTerminalBuildStatus, type BuildStatusView } from '@/lib/ue5-bridge/build-status';
import type { BuildStatus, BuildRequest } from '@/types/ue5-bridge';

/** UE target names are interpolated into the target and the `.uproject` path. */
export const BUILD_TARGET_NAME_RE = /^[A-Za-z0-9_]+$/;

/** Polls a run's status may be unreadable (e.g. 404: no record) before it is `lost`. */
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

export type BuildRunState =
  | { phase: 'idle' }
  | { phase: 'dispatching' }
  | { phase: 'queued'; buildId: string; missedPolls: number }
  | { phase: 'running'; buildId: string; missedPolls: number; percent?: number; message?: string }
  | { phase: 'settled'; buildId: string; status: BuildStatus; errorCount: number; refetchReport: boolean; reason?: string }
  | { phase: 'lost'; buildId: string; reason: string }
  | { phase: 'rejected'; reason: string };

export type BuildRunEvent =
  | { type: 'dispatch' }
  | { type: 'started'; buildId: string }
  | { type: 'rejected'; reason: string }
  | { type: 'status'; status: Pick<BuildStatusView, 'buildId' | 'status'> & Partial<BuildStatusView> }
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
    reason: `${s.buildId} ${why} for ${MAX_MISSED_POLLS} polls — the server has no readable record of this build.`,
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
    case 'status': {
      if (s.phase !== 'queued' && s.phase !== 'running') return s;
      const v = e.status;
      if (v.buildId !== s.buildId) return missed(s, `status answered for another build (${v.buildId})`);
      if (isTerminalBuildStatus(v.status)) {
        return {
          phase: 'settled', buildId: s.buildId, status: v.status, errorCount: v.errorCount ?? 0, refetchReport: true,
          ...(v.reason ? { reason: v.reason } : {}),
        };
      }
      if (v.status === 'running') {
        return {
          phase: 'running', buildId: s.buildId, missedPolls: 0,
          percent: v.progress?.percent, message: v.progress?.message,
        };
      }
      return { phase: 'queued', buildId: s.buildId, missedPolls: 0 };
    }
  }
}
