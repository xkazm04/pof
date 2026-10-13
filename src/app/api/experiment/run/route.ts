import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { startExperimentJob } from '@/lib/ue-experiment/job-store';
import type { ExperimentSpec } from '@/lib/ue-experiment/runner';

/**
 * POST /api/experiment/run
 * Body: ExperimentSpec ({ python, capture?, verify?, ... }).
 * Starts a UE 5.8 experiment job (launch is minutes) and returns its id; poll
 * GET /api/experiment/status/:id for the result.
 *
 * The body's Python runs inside a launched editor with full host access, so the
 * route sits behind `requireOperator`, and the project and engine are never taken
 * from the caller: the runner resolves them from POF_UE_UPROJECT and the configured
 * engine, so a request cannot point the editor at a path of its choosing.
 */
export async function POST(req: NextRequest) {
  const denied = requireOperator(req);
  if (denied) return denied;
  try {
    const body = (await req.json()) as Partial<ExperimentSpec>;
    if (!body.scenario && (typeof body.python !== 'string' || body.python.trim() === '')) {
      return apiError('python (a non-empty string) or a scenario is required', 400);
    }
    const jobId = startExperimentJob({
      python: body.python ?? '',
      capture: body.capture,
      verify: body.verify,
      scenario: body.scenario,
      resX: body.resX,
      resY: body.resY,
      settleMs: body.settleMs,
      allowRunningEditor: body.allowRunningEditor,
    });
    return apiSuccess({ jobId }, 202);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to start experiment', 500);
  }
}
