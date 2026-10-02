/**
 * API Route: /api/ue5-bridge/build
 *
 * POST — Start a build (action: 'start'), re-run a recorded one with its identical
 *        request (action: 'rebuild', buildId), or abort one (action: 'abort').
 * GET  — Query build status by buildId (every stage, queued to settled: the live queue
 *        item or the build's headless_builds row, via resolveBuildStatus; never the log),
 *        or list queue + history.
 */

import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildQueue } from '@/lib/ue5-bridge/build-queue';
import { getBuildHistory, getBuildRequestById, getBuildStatusRow } from '@/lib/ue5-bridge/build-pipeline';
import { resolveBuildStatus } from '@/lib/ue5-bridge/build-status';
import { validateBuildTarget } from '@/lib/ue5-bridge/build-run';
import type { BuildRequest, BuildConfiguration, BuildTargetPlatform, BuildTargetType } from '@/types/ue5-bridge';

// ── POST Handler ─────────────────────────────────────────────────────────────

interface StartAction {
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

interface AbortAction {
  action: 'abort';
  buildId: string;
}

interface RebuildAction {
  action: 'rebuild';
  buildId: string;
}

type BuildAction = StartAction | AbortAction | RebuildAction | { action: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BuildAction;

    switch (body.action) {
      // ── Start a new build ────────────────────────────────────────
      case 'start': {
        const { projectPath, targetName, ueVersion } = body as StartAction;

        if (!projectPath || typeof projectPath !== 'string') {
          return apiError('projectPath is required', 400);
        }
        if (!targetName || typeof targetName !== 'string') {
          return apiError('targetName is required', 400);
        }
        if (!ueVersion || typeof ueVersion !== 'string') {
          return apiError('ueVersion is required', 400);
        }

        // Trust-boundary validation: targetName is interpolated into the build target and
        // the `.uproject` path, and projectPath becomes the spawn cwd. Reject non-identifier
        // target names and path-traversal so a crafted value can't climb out of the project
        // directory or smuggle extra build args (defense-in-depth alongside shell:false).
        const refusal = validateBuildTarget(targetName, projectPath);
        if (refusal) return apiError(refusal, 400);

        const startBody = body as StartAction;
        const request: BuildRequest = {
          projectPath,
          targetName,
          ueVersion,
          platform: (startBody.platform ?? 'Win64') as BuildTargetPlatform,
          configuration: (startBody.configuration ?? 'Development') as BuildConfiguration,
          targetType: (startBody.targetType ?? 'Editor') as BuildTargetType,
          additionalArgs: startBody.additionalArgs,
        };

        // enqueue records the build before it can spawn; an unrecordable build throws (500 below).
        const buildId = buildQueue.enqueue(request, startBody.moduleId);
        return apiSuccess({ buildId });
      }

      // ── Re-run a recorded build with its identical request ───────
      case 'rebuild': {
        const { buildId } = body as RebuildAction;
        if (!buildId || typeof buildId !== 'string') {
          return apiError('buildId is required', 400);
        }

        const request = getBuildRequestById(buildId);
        if (!request) {
          return apiError(`Build ${buildId} not found in build history — nothing to rebuild`, 404);
        }
        // The stored values reach the spawn again: same trust boundary as 'start'.
        const refusal = validateBuildTarget(request.targetName, request.projectPath);
        if (refusal) return apiError(`Build ${buildId} cannot be rebuilt: ${refusal}`, 400);

        return apiSuccess({ buildId: buildQueue.enqueue(request) });
      }

      // ── Abort a running or queued build ──────────────────────────
      case 'abort': {
        const { buildId } = body as AbortAction;

        if (!buildId || typeof buildId !== 'string') {
          return apiError('buildId is required', 400);
        }

        const aborted = buildQueue.abort(buildId);
        if (!aborted) {
          return apiError(`Build ${buildId} not found in queue or not running`, 404);
        }

        return apiSuccess({ aborted: true, buildId });
      }

      default:
        return apiError(`Unknown action: ${(body as { action: string }).action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const buildId = searchParams.get('buildId');

    // Single build status lookup: live item wins, else the recorded row (404 only when never recorded)
    if (buildId) {
      const status = resolveBuildStatus({
        live: buildQueue.getStatus(buildId),
        row: getBuildStatusRow(buildId),
        now: Date.now(),
      });
      if (!status) {
        return apiError(`Build ${buildId} not found`, 404);
      }
      return apiSuccess(status);
    }

    // Queue overview + optional history
    const projectPath = searchParams.get('projectPath');
    const queue = buildQueue.getQueue();

    if (projectPath) {
      const history = getBuildHistory(projectPath, 10);
      return apiSuccess({ queue, history });
    }

    return apiSuccess({ queue });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
