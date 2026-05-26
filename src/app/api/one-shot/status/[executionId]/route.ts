import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getExecutionStatus } from '@/lib/claude-terminal/cli-service';

/**
 * GET /api/one-shot/status/:executionId
 * Returns the current state of a CLI execution.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> },
) {
  try {
    const { executionId } = await params;
    if (!executionId) return apiError('executionId is required', 400);

    const status = getExecutionStatus(executionId);
    if (!status) return apiError('execution not found', 404);

    return apiSuccess(status);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'status check failed', 500);
  }
}
