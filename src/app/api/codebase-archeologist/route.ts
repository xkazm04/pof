import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { runArcheologistAnalysis } from '@/lib/codebase-archeologist';
import { getDb } from '@/lib/db';
import { normalizeProjectId } from '@/lib/project-id';

/**
 * Only a path the operator has actually opened through Project Setup (and
 * which `recent_projects` therefore already knows about) may be analyzed —
 * this route previously accepted and read any client-supplied filesystem
 * path with no check against a known project root.
 */
function isKnownProjectPath(projectPath: string): boolean {
  const target = normalizeProjectId(projectPath);
  if (!target) return false;
  const rows = getDb()
    .prepare('SELECT project_path FROM recent_projects')
    .all() as { project_path: string }[];
  return rows.some((r) => normalizeProjectId(r.project_path) === target);
}

export async function POST(req: NextRequest) {
  try {
    const { projectPath } = (await req.json()) as { projectPath?: string };

    if (!projectPath || typeof projectPath !== 'string') {
      return apiError('projectPath is required', 400);
    }

    if (!isKnownProjectPath(projectPath)) {
      return apiError('projectPath is not a known project — open it via Project Setup first', 403);
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
