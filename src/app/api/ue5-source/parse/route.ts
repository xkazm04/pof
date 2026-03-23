import path from 'path';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseUE5AbilitySystem } from '@/lib/ue5-source-parser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath } = body;

    if (!projectPath || typeof projectPath !== 'string') {
      return apiError('projectPath is required', 400);
    }

    // Validate: must be absolute and contain no path traversal components
    const normalized = path.resolve(projectPath);
    if (normalized !== path.normalize(projectPath) || projectPath.includes('..')) {
      return apiError('projectPath must be an absolute path with no traversal (..)', 400);
    }

    const data = await parseUE5AbilitySystem(normalized);
    return apiSuccess(data);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to parse UE5 source files'
    );
  }
}
