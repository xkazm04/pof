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
    const body = (await req.json().catch(() => undefined)) as (ComplianceRequest & {
      checklistProgress?: Record<string, Record<string, boolean>>;
    }) | null | undefined;
    // A body that is not a JSON object is the caller's error (400), not a server fault.
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return apiError('Request body must be a JSON object', 400);
    }
    // Resolutions are scoped by this string: a number/object would silently write under a
    // key no reader asks for, so a non-string is the caller's error.
    if (body.projectPath !== undefined && body.projectPath !== null && typeof body.projectPath !== 'string') {
      return apiError('projectPath must be a string', 400);
    }
    const projectPath = body.projectPath ?? '';
    const optionalString = (v: unknown) => v === undefined || v === null || typeof v === 'string';

    switch (body.action) {
      case 'audit': {
        const checklistProgress = body.checklistProgress ?? {};
        return apiSuccess(runComplianceAudit(checklistProgress, projectPath));
      }

      case 'resolve-gap': {
        if (!body.gapId || typeof body.gapId !== 'string') return apiError('resolve-gap requires a gapId (string)', 400);
        if (!optionalString(body.moduleId) || !optionalString(body.note)) {
          return apiError('moduleId and note must be strings', 400);
        }
        return apiSuccess(
          resolveGap(projectPath, body.gapId, { moduleId: body.moduleId, note: body.note }),
        );
      }

      case 'unresolve-gap': {
        if (!body.gapId || typeof body.gapId !== 'string') return apiError('unresolve-gap requires a gapId (string)', 400);
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
