import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { attributeFilesSince } from '@/lib/evaluator/git-attribution';

/**
 * Attribute NEW regression findings to the commit(s) that touched their files
 * since the previous scan. Body: `{ projectPath, files, since }`.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const { projectPath, files, since } = (await req.json()) as {
    projectPath?: string;
    files?: unknown;
    since?: string | null;
  };

  if (!projectPath || typeof projectPath !== 'string') {
    return apiError('projectPath is required', 400);
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
