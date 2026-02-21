import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';

/**
 * GET /api/feature-matrix/progress?moduleId=X&projectPath=Y
 *
 * Returns how many features have been written to the partial JSON file
 * on disk during an in-progress CLI review scan.
 */
export async function GET(request: NextRequest) {
  try {
    const moduleId = request.nextUrl.searchParams.get('moduleId');
    const projectPath = request.nextUrl.searchParams.get('projectPath');

    if (!moduleId || !projectPath) {
      return apiError('moduleId and projectPath required', 400);
    }

    const defs = MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId] ?? [];
    const total = defs.length;

    if (total === 0) {
      return apiSuccess({ scanned: 0, total: 0 });
    }

    const filePath = path.join(projectPath, '.pof', 'matrix', `${moduleId}.json`);

    if (!fs.existsSync(filePath)) {
      return apiSuccess({ scanned: 0, total });
    }

    // Read the file — it may be partially written by the CLI
    let scanned = 0;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.features && Array.isArray(parsed.features)) {
        scanned = parsed.features.length;
      }
    } catch {
      // File may be partially written / invalid JSON — try to count feature entries
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        // Count occurrences of "featureName" keys as a rough progress indicator
        const matches = raw.match(/"featureName"\s*:/g);
        scanned = matches ? matches.length : 0;
      } catch {
        scanned = 0;
      }
    }

    return apiSuccess({ scanned, total });
  } catch (error) {
    console.error('Feature matrix progress error:', error);
    return apiSuccess({ scanned: 0, total: 0 });
  }
}
