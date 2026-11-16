import path from 'path';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { parseUE5AbilitySystem } from '@/lib/ue5-source-parser';

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
    const { projectPath } = body;

    if (!projectPath || typeof projectPath !== 'string') {
      return apiError('projectPath is required', 400);
    }

    // Validate: must be absolute and contain no path traversal components
    if (!path.isAbsolute(projectPath) || projectPath.split(/[\\/]/).includes('..')) {
      return apiError('projectPath must be an absolute path with no traversal (..)', 400);
    }
    const normalized = path.resolve(projectPath);

    const data = await parseUE5AbilitySystem(normalized);
    return apiSuccess(data);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to parse UE5 source files'
    );
  }
}
