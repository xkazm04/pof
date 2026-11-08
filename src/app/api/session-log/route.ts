import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  logSessionEvent,
  getSessionLog,
  getModuleSessionLog,
  cancelOpenSessions,
} from '@/lib/session-log-db';
import type { SubModuleId } from '@/types/modules';
import type { SessionLogEvent } from '@/types/session-log';

/** A list limit is an integer in 1-1000: NaN must not reach SQLite, and a negative LIMIT means every row. */
function parseLimit(raw: string | null, fallback: number): number | null {
  if (raw === null || raw === '') return fallback;
  const n = /^\d{1,4}$/.test(raw) ? Number(raw) : NaN;
  return n >= 1 && n <= 1000 ? n : null;
}

// GET /api/session-log?projectPath=X&limit=50
// GET /api/session-log?moduleId=X&limit=30
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectPath = searchParams.get('projectPath');
    const moduleId = searchParams.get('moduleId');
    const limit = parseLimit(searchParams.get('limit'), 50);
    if (limit === null) return apiError('limit must be an integer in 1-1000', 400);

    if (moduleId) {
      return apiSuccess(getModuleSessionLog(moduleId as SubModuleId, limit));
    }

    if (projectPath) {
      return apiSuccess(getSessionLog(projectPath, limit));
    }

    return apiError('projectPath or moduleId required', 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Unknown error');
  }
}

// POST /api/session-log
// body: { action: 'log', tabId, sessionKey, moduleId, projectPath, event, success?, promptPreview?, durationMs? }
// body: { action: 'cancel-open', projectPath }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => undefined);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return apiError('Request body must be a JSON object', 400);
    }
    const action = body.action as string;

    if (action === 'cancel-open') {
      const projectPath = body.projectPath as string;
      if (!projectPath) return apiError('projectPath required', 400);
      const count = cancelOpenSessions(projectPath);
      return apiSuccess({ cancelled: count });
    }

    if (action === 'log') {
      const { tabId, sessionKey, moduleId, projectPath, event, success, promptPreview, durationMs } = body;
      if (!tabId || !sessionKey || !moduleId || !event) {
        return apiError('tabId, sessionKey, moduleId, event required', 400);
      }

      const entry = logSessionEvent({
        tabId,
        sessionKey,
        moduleId: moduleId as SubModuleId,
        projectPath: projectPath ?? '',
        event: event as SessionLogEvent,
        success,
        promptPreview,
        durationMs,
      });
      return apiSuccess(entry, 201);
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Unknown error');
  }
}
