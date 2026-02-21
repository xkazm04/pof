import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  recordSession,
  getDashboard,
  getModuleSessions,
  getPromptSuggestions,
  getSessionCount,
} from '@/lib/session-analytics-db';
import type { SubModuleId } from '@/types/modules';

// GET /api/session-analytics
// ?action=dashboard          → full dashboard
// ?action=module&moduleId=X  → module session history
// ?action=suggestions&moduleId=X&prompt=Y → prompt suggestions
// ?action=count&moduleId=X   → session count for module
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'dashboard';

    if (action === 'dashboard') {
      return apiSuccess(getDashboard());
    }

    if (action === 'module') {
      const moduleId = searchParams.get('moduleId');
      if (!moduleId) return apiError('moduleId required', 400);
      const sessions = getModuleSessions(moduleId as SubModuleId);
      return apiSuccess({ sessions });
    }

    if (action === 'suggestions') {
      const moduleId = searchParams.get('moduleId');
      const prompt = searchParams.get('prompt');
      if (!moduleId || !prompt) {
        return apiError('moduleId and prompt required', 400);
      }
      const suggestions = getPromptSuggestions(moduleId as SubModuleId, prompt);
      return apiSuccess({ suggestions });
    }

    if (action === 'count') {
      const moduleId = searchParams.get('moduleId');
      if (!moduleId) return apiError('moduleId required', 400);
      return apiSuccess({ count: getSessionCount(moduleId as SubModuleId) });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    console.error('GET /api/session-analytics error:', err);
    return apiError('Internal error', 500);
  }
}

// POST /api/session-analytics
// Body: { moduleId, sessionKey, prompt, hadProjectContext, success, durationMs, startedAt, completedAt }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.moduleId || !body.sessionKey || body.prompt === undefined) {
      return apiError('moduleId, sessionKey, prompt required', 400);
    }

    const record = recordSession({
      moduleId: body.moduleId,
      sessionKey: body.sessionKey,
      prompt: body.prompt,
      hadProjectContext: body.hadProjectContext ?? false,
      success: body.success ?? false,
      durationMs: body.durationMs ?? 0,
      startedAt: body.startedAt ?? new Date().toISOString(),
      completedAt: body.completedAt ?? new Date().toISOString(),
    });

    return apiSuccess({ record }, 201);
  } catch (err) {
    console.error('POST /api/session-analytics error:', err);
    return apiError('Internal error', 500);
  }
}
