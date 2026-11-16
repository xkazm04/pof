import { isAbsolute } from 'path';
import { NextRequest } from 'next/server';
import { planWrite, applyWrite, isCppIdentifier, type ApprovedFile, type WriteInput } from '@/lib/blueprint-transpiler-write';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';

const isApprovedPlan = (v: unknown): v is ApprovedFile[] =>
  Array.isArray(v) && v.every((a) => typeof a?.relPath === 'string' && typeof a?.before === 'string');

export async function POST(req: NextRequest) {
  const denied = requireOperator(req);
  if (denied) return denied;
  try {
    const body = await readJsonObject(req);
    if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
    const { projectPath, moduleName, className, header, source, confirm, approved } = body;
    if (!projectPath || !moduleName || !className) {
      return apiError('projectPath, moduleName and className are required', 400);
    }
    if (typeof projectPath !== 'string' || !isAbsolute(projectPath) || projectPath.split(/[\\/]/).includes('..')) {
      return apiError('projectPath must be an absolute path with no traversal (..)', 400);
    }
    if (!isCppIdentifier(moduleName) || !isCppIdentifier(className)) {
      return apiError('moduleName and className must be C++ identifiers', 400);
    }
    if ((header !== undefined && typeof header !== 'string') || (source !== undefined && typeof source !== 'string')) {
      return apiError('header and source must be strings', 400);
    }
    const input: WriteInput = { projectPath, moduleName, className, header: (header as string | undefined) ?? '', source: (source as string | undefined) ?? '' };
    if (confirm === true) {
      // `approved` carries the dry-run plan the user actually reviewed —
      // applyWrite rejects when the resolved paths or on-disk content drifted.
      // Without it that check is skipped, so a confirm must always carry one.
      if (!isApprovedPlan(approved)) return apiError('confirm requires the approved dry-run plan', 400);
      return apiSuccess(await applyWrite(input, approved));
    }
    return apiSuccess(await planWrite(input)); // dry-run
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to write transpiled C++');
  }
}
