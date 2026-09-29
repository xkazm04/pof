/**
 * POST /api/save-schema/audit  { projectPath }
 *
 * Reads every header under `<projectPath>/Source/` and returns the USaveGame-derived
 * classes (inheritance resolved, effective UPROPERTYs). READ-ONLY: nothing under the
 * project is written; the Save tab audits the result client-side and the only UE write is
 * the CLI task its Fix button dispatches on an explicit click.
 *
 * -> { headersScanned, saveClasses: SaveClass[] }  (no save class = saveClasses [], not an error)
 */
import type { NextRequest } from 'next/server';
import fsPromises from 'fs/promises';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseHeader } from '@/lib/cpp-semantic-parser';
import { collectHeaders } from '@/lib/ue-source/collect-headers';
import { findSaveGameClasses } from '@/lib/save-schema/header-audit';

export async function POST(request: NextRequest) {
  let projectPath: unknown;
  try {
    ({ projectPath } = (await request.json()) as { projectPath?: unknown });
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  if (typeof projectPath !== 'string' || !projectPath.trim()) return apiError('projectPath required', 400);

  try {
    const headerFiles = await collectHeaders(path.join(projectPath, 'Source'));
    const parsed = await Promise.all(
      headerFiles.map(async (fp) => {
        const rel = path.relative(projectPath as string, fp).split(path.sep).join('/');
        return parseHeader(await fsPromises.readFile(fp, 'utf-8'), rel);
      }),
    );
    return apiSuccess({ headersScanned: headerFiles.length, saveClasses: findSaveGameClasses(parsed) });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Save schema audit failed', 500);
  }
}
