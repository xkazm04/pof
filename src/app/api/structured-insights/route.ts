import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  extractStructuredEntities,
  saveStructuredInsight,
  getInsightsForSession,
  getInsightsForModule,
} from '@/lib/pattern-extractor';
import type { SubModuleId } from '@/types/modules';

/**
 * GET /api/structured-insights
 *   ?sessionId=X → get insight for session
 *   ?moduleId=X  → get insights for module
 *
 * POST /api/structured-insights
 *   body: { text, moduleId, sessionId } → extract + save
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const sessionId = searchParams.get('sessionId');
    const moduleId = searchParams.get('moduleId');

    if (sessionId) {
      const insight = getInsightsForSession(sessionId);
      return apiSuccess(insight);
    }

    if (moduleId) {
      const insights = getInsightsForModule(moduleId as SubModuleId);
      return apiSuccess(insights);
    }

    return apiError('Provide sessionId or moduleId', 400);
  } catch (err) {
    return apiError(String(err), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, moduleId, sessionId } = body as {
      text: string;
      moduleId: string;
      sessionId: string;
    };

    if (!text || !moduleId || !sessionId) {
      return apiError('text, moduleId, and sessionId are required', 400);
    }

    const insight = extractStructuredEntities(text, moduleId as SubModuleId, sessionId);
    saveStructuredInsight(insight);

    return apiSuccess(insight);
  } catch (err) {
    return apiError(String(err), 500);
  }
}
