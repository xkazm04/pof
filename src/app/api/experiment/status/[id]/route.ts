import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getExperimentJob } from '@/lib/ue-experiment/job-store';

/**
 * GET /api/experiment/status/:id
 * Polls an experiment job: { status: 'running'|'done'|'error', result?, error? }.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = getExperimentJob(id);
    if (!job) return apiError('experiment job not found', 404);
    return apiSuccess({ status: job.status, result: job.result, error: job.error });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'status check failed', 500);
  }
}
