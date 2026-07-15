import { apiSuccess, apiError } from '@/lib/api-utils';
import { getLeaseState } from '@/lib/test-gate-runner/drain-lease';

/**
 * GET /api/pipeline-artifacts/drain/status — the current drain lease state.
 * Returns `{ held, scope, since, scopes }` (envelope via apiSuccess) so the lab's runner
 * chip can show when the non-reentrant UE editor is busy — including a lease held by ANOTHER
 * session — instead of that only surfacing as a 409 when a drain is attempted.
 */
export function GET() {
  try {
    return apiSuccess(getLeaseState());
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'lease status failed', 500);
  }
}
