import { apiSuccess, apiError } from '@/lib/api-utils';
import { runComplianceAudit, resolveGap } from '@/lib/gdd-compliance';
import type { ComplianceRequest } from '@/types/gdd-compliance';

// In-memory cache of last report for resolve operations
let cachedReport: ReturnType<typeof runComplianceAudit> | null = null;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ComplianceRequest & {
      checklistProgress?: Record<string, Record<string, boolean>>;
    };

    switch (body.action) {
      case 'audit': {
        const checklistProgress = body.checklistProgress ?? {};
        const report = runComplianceAudit(checklistProgress);
        cachedReport = report;
        return apiSuccess(report);
      }

      case 'get-report': {
        if (!cachedReport) {
          const report = runComplianceAudit({});
          cachedReport = report;
          return apiSuccess(report);
        }
        return apiSuccess(cachedReport);
      }

      case 'resolve-gap': {
        if (!cachedReport) {
          return apiError('No audit report available. Run audit first.', 400);
        }
        if (!body.gapId) {
          return apiError('gapId is required', 400);
        }
        cachedReport = resolveGap(cachedReport, body.gapId);
        return apiSuccess(cachedReport);
      }

      default:
        return apiError(`Unknown action: ${body.action}`, 400);
    }
  } catch (err) {
    return apiError((err as Error).message);
  }
}
