import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  runComplianceAudit, resolveGap, unresolveGap, listResolutions,
} from '@/lib/gdd-compliance';
import type { ComplianceRequest } from '@/types/gdd-compliance';

/**
 * `audit` computes a fresh report; the three resolution actions read and write the
 * durable triage in SQLite. `resolve-gap` used to be declared in the request type
 * and answered with a 400 while the store resolved gaps in memory only, so triage
 * died on reload — the action is now the real persistence path.
 *
 * Resolutions are scoped by project because gap ids are only unique within one.
 * A caller with no project scope (the `pof_gdd_compliance` MCP tool) falls back to
 * the empty scope, seeing only unscoped resolutions rather than another project's.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ComplianceRequest & {
      checklistProgress?: Record<string, Record<string, boolean>>;
    };
    const projectPath = body.projectPath ?? '';

    switch (body.action) {
      case 'audit': {
        const checklistProgress = body.checklistProgress ?? {};
        return apiSuccess(runComplianceAudit(checklistProgress, projectPath));
      }

      case 'resolve-gap': {
        if (!body.gapId) return apiError('resolve-gap requires a gapId', 400);
        return apiSuccess(
          resolveGap(projectPath, body.gapId, { moduleId: body.moduleId, note: body.note }),
        );
      }

      case 'unresolve-gap': {
        if (!body.gapId) return apiError('unresolve-gap requires a gapId', 400);
        // `removed: false` means there was nothing to re-open — reported, not
        // swallowed, so a no-op can never read as a successful un-resolve.
        return apiSuccess({ gapId: body.gapId, removed: unresolveGap(projectPath, body.gapId) });
      }

      case 'resolutions':
        return apiSuccess(listResolutions(projectPath));

      default:
        return apiError(`Unknown action: ${body.action}`, 400);
    }
  } catch (err) {
    return apiError((err as Error).message);
  }
}
