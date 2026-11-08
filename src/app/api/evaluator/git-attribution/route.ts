import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { attributeFilesSince } from '@/lib/evaluator/git-attribution';

/**
 * Attribute NEW regression findings to the commit(s) that touched their files
 * since the previous scan. Body: `{ projectPath, files, since }`.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const raw: unknown = await req.json().catch(() => undefined);
  // A body that is not a JSON object is the caller's error (400), not a server fault.
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return apiError('Request body must be a JSON object', 400);
  }
  const { projectPath, files, since } = raw as {
    projectPath?: string;
    files?: unknown;
    since?: string | null;
  };

  if (!projectPath || typeof projectPath !== 'string') {
    return apiError('projectPath is required', 400);
  }

  if (files != null && !Array.isArray(files)) {
    return apiError('files must be an array of paths', 400);
  }
  // Refused rather than ignored: a dropped since widens the attribution to the whole history.
  if (since != null && typeof since !== 'string') {
    return apiError('since must be a string or null', 400);
  }

  const fileList = Array.isArray(files) ? files.filter((f): f is string => typeof f === 'string') : [];
  if (fileList.length === 0) {
    return apiSuccess({ attribution: {} });
  }

  const attribution = await attributeFilesSince(
    projectPath,
    fileList,
    typeof since === 'string' && since ? since : null,
  );
  return apiSuccess({ attribution });
}, 'Git attribution failed');
