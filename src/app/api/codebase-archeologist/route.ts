import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { runArcheologistAnalysis } from '@/lib/codebase-archeologist';

export async function POST(req: NextRequest) {
  try {
    const { projectPath } = (await req.json()) as { projectPath?: string };

    if (!projectPath || typeof projectPath !== 'string') {
      return apiError('projectPath is required', 400);
    }

    // Verify Source/ directory exists
    const sourceDir = path.join(projectPath, 'Source');
    try {
      const stat = await fs.stat(sourceDir);
      if (!stat.isDirectory()) {
        return apiError('Source/ directory not found in project path', 400);
      }
    } catch {
      return apiError('Source/ directory not found in project path', 400);
    }

    const analysis = await runArcheologistAnalysis(projectPath);
    return apiSuccess({ analysis });
  } catch (e) {
    console.error('Codebase archeologist error:', e);
    return apiError('Analysis failed', 500, String(e));
  }
}
