import { apiSuccess, apiError } from '@/lib/api-utils';
import { runComplianceAudit } from '@/lib/gdd-compliance';
import type { ComplianceRequest } from '@/types/gdd-compliance';

// `audit` is the only server action: it computes a fresh report from the request.
// Gap resolution is a pure client-side transform on the report the store already
// holds (see gddComplianceStore.resolveGap) — keeping it off the server avoids a
// shared module-level cache that one client/project could overwrite for another.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ComplianceRequest & {
      checklistProgress?: Record<string, Record<string, boolean>>;
    };

    switch (body.action) {
      case 'audit': {
        const checklistProgress = body.checklistProgress ?? {};
        const report = runComplianceAudit(checklistProgress);
        return apiSuccess(report);
      }

      default:
        return apiError(`Unknown action: ${body.action}`, 400);
    }
  } catch (err) {
    return apiError((err as Error).message);
  }
}
