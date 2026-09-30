import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { startDeepEvalJob, getDeepEvalJob, cancelDeepEvalJob } from '@/lib/evaluator/deep-eval-job';

/**
 * The Deep Eval tab's server job (see `src/lib/evaluator/deep-eval-job.ts`).
 *
 * POST `{ projectPath, projectName?, ueVersion?, moduleIds?, scanId?, model?, effort? }`
 *   starts a job and answers `{ scanId, job }`; 409 while one is running for the project.
 *   Only the tab's Run buttons call it: a reload reattaches through GET and never starts one.
 * GET `?project=<path>` answers `{ job }` (the progress snapshot + result), or `{ job: null }`.
 * DELETE `?project=<path>` cancels, kills every in-flight CLI pass, and answers `{ job }`.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const body = (await req.json()) as {
    projectPath?: unknown;
    projectName?: unknown;
    ueVersion?: unknown;
    moduleIds?: unknown;
    scanId?: unknown;
    model?: unknown;
    effort?: unknown;
  };
  const projectPath = typeof body.projectPath === 'string' ? body.projectPath.trim() : '';
  if (!projectPath) return apiError('Project path is required', 400);

  const moduleIds = Array.isArray(body.moduleIds)
    ? body.moduleIds.filter((m): m is string => typeof m === 'string' && m.length > 0)
    : undefined;
  if (moduleIds && moduleIds.length === 0) return apiError('moduleIds must name at least one module', 400);

  const started = startDeepEvalJob({
    projectPath,
    projectContext: {
      projectName: typeof body.projectName === 'string' ? body.projectName : '',
      projectPath,
      ueVersion: typeof body.ueVersion === 'string' ? body.ueVersion : '',
    },
    moduleIds,
    scanId: typeof body.scanId === 'string' && body.scanId ? body.scanId : undefined,
    model: typeof body.model === 'string' ? body.model : undefined,
    effort: typeof body.effort === 'string' ? body.effort : undefined,
  });
  if (!started.ok) return apiError('A deep evaluation is already running for this project', 409);

  // Settles in the background; the job records its own outcome.
  void started.data.done;
  return apiSuccess({ scanId: started.data.scanId, job: getDeepEvalJob(projectPath) });
}, 'Failed to start deep evaluation');

export const GET = withRoute(async (req: NextRequest) => {
  const project = new URL(req.url).searchParams.get('project')?.trim();
  if (!project) return apiError('project is required', 400);
  return apiSuccess({ job: getDeepEvalJob(project) });
}, 'Failed to read deep evaluation');

export const DELETE = withRoute(async (req: NextRequest) => {
  const project = new URL(req.url).searchParams.get('project')?.trim();
  if (!project) return apiError('project is required', 400);
  return apiSuccess({ job: await cancelDeepEvalJob(project) });
}, 'Failed to cancel deep evaluation');
