import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getPatternDashboard,
  searchPatterns,
  getPattern,
  suggestPatterns,
  deletePattern,
  getAllAntiPatterns,
  checkPromptForAntiPatterns,
} from '@/lib/pattern-library-db';
import { extractPatterns, extractAntiPatterns } from '@/lib/pattern-extractor';
import type { PatternSearchParams } from '@/types/pattern-library';
import type { SubModuleId } from '@/types/modules';

/**
 * GET /api/pattern-library
 *   ?action=dashboard  → PatternLibraryDashboard
 *   ?action=search&query=X&moduleId=Y&category=Z&minSuccessRate=0.5&sortBy=success-rate
 *   ?action=suggest&moduleId=X&label=Y
 *   ?action=detail&id=X
 *   ?action=anti-patterns            → All anti-patterns
 *   ?action=check-prompt&prompt=X&moduleId=Y → Check prompt for anti-pattern matches
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const action = searchParams.get('action') ?? 'dashboard';

    if (action === 'dashboard') {
      const dashboard = getPatternDashboard();
      return apiSuccess(dashboard);
    }

    if (action === 'search') {
      const params: PatternSearchParams = {};
      const query = searchParams.get('query');
      const moduleId = searchParams.get('moduleId');
      const category = searchParams.get('category');
      const minSuccessRate = searchParams.get('minSuccessRate');
      const sortBy = searchParams.get('sortBy');

      if (query) params.query = query;
      if (moduleId) params.moduleId = moduleId;
      if (category) params.category = category as PatternSearchParams['category'];
      if (minSuccessRate) params.minSuccessRate = parseFloat(minSuccessRate);
      if (sortBy) params.sortBy = sortBy as PatternSearchParams['sortBy'];

      const patterns = searchPatterns(params);
      return apiSuccess({ patterns });
    }

    if (action === 'suggest') {
      const moduleId = searchParams.get('moduleId');
      if (!moduleId) return apiError('moduleId is required', 400);
      const label = searchParams.get('label') ?? undefined;
      const suggestions = suggestPatterns(moduleId as SubModuleId, label);
      return apiSuccess({ suggestions });
    }

    if (action === 'detail') {
      const id = searchParams.get('id');
      if (!id) return apiError('id is required', 400);
      const pattern = getPattern(id);
      if (!pattern) return apiError('Pattern not found', 404);
      return apiSuccess({ pattern });
    }

    if (action === 'anti-patterns') {
      const antiPatterns = getAllAntiPatterns();
      return apiSuccess({ antiPatterns });
    }

    if (action === 'check-prompt') {
      const prompt = searchParams.get('prompt');
      if (!prompt) return apiError('prompt is required', 400);
      const moduleId = searchParams.get('moduleId') ?? undefined;
      const warnings = checkPromptForAntiPatterns(prompt, moduleId as SubModuleId | undefined);
      return apiSuccess({ warnings });
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : 'Pattern library error',
      500,
    );
  }
}

/**
 * POST /api/pattern-library
 *   { action: 'extract' }        → Run pattern extraction from session analytics
 *   { action: 'extract-anti' }   → Run anti-pattern extraction from failed sessions
 *   { action: 'extract-all' }    → Run both extractions
 *   { action: 'delete', id }     → Delete a pattern
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'extract') {
      const result = extractPatterns();
      return apiSuccess(result);
    }

    if (action === 'extract-anti') {
      const result = extractAntiPatterns();
      return apiSuccess(result);
    }

    if (action === 'extract-all') {
      const patterns = extractPatterns();
      const antiPatterns = extractAntiPatterns();
      return apiSuccess({ patterns, antiPatterns });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return apiError('id is required', 400);
      const deleted = deletePattern(id);
      return apiSuccess({ deleted });
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : 'Pattern library error',
      500,
    );
  }
}
