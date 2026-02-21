/**
 * API Route: /api/ue5-bridge/build
 *
 * POST — Start a build (action: 'start') or abort one (action: 'abort').
 * GET  — Query build status by buildId, or list queue + history.
 */

import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildQueue } from '@/lib/ue5-bridge/build-queue';
import { getBuildHistory } from '@/lib/ue5-bridge/build-pipeline';
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

type BuildAction = StartAction | AbortAction | { action: string };

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

        const buildId = buildQueue.enqueue(request, startBody.moduleId);
        return apiSuccess({ buildId });
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

    // Single build status lookup
    if (buildId) {
      const status = buildQueue.getStatus(buildId);
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
