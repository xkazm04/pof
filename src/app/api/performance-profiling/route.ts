import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildSessionFromCSV } from '@/lib/profiling/csv-parser';
import { generateSampleSession } from '@/lib/profiling/sample-generator';
import { runTriage } from '@/lib/profiling/triage-engine';

// In-memory store for sessions (persists per server process)
const sessions = new Map<string, import('@/types/performance-profiling').ProfilingSession>();
const triageResults = new Map<string, import('@/types/performance-profiling').TriageResult>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'import-csv') {
      const { csvContent, sessionName, projectPath } = body;
      if (!csvContent || !sessionName) {
        return apiError('csvContent and sessionName are required', 400);
      }
      const session = buildSessionFromCSV(csvContent, sessionName, projectPath ?? '');
      sessions.set(session.id, session);
      return apiSuccess({ session });
    }

    if (action === 'generate-sample') {
      const { scenarioType, enemyCount, targetFPS, projectPath } = body;
      const session = generateSampleSession({
        scenarioType: scenarioType ?? 'combat-heavy',
        enemyCount: Math.min(enemyCount ?? 50, 200),
        targetFPS: targetFPS ?? 60,
        projectPath: projectPath ?? '',
      });
      sessions.set(session.id, session);
      return apiSuccess({ session });
    }

    if (action === 'triage') {
      const { sessionId } = body;
      const session = sessions.get(sessionId);
      if (!session) {
        return apiError('Session not found', 404);
      }
      const result = runTriage(session);
      triageResults.set(sessionId, result);
      return apiSuccess({ triage: result });
    }

    if (action === 'get-session') {
      const { sessionId } = body;
      const session = sessions.get(sessionId);
      if (!session) return apiError('Session not found', 404);
      const triage = triageResults.get(sessionId) ?? null;
      return apiSuccess({ session, triage });
    }

    if (action === 'list-sessions') {
      const list = [...sessions.values()].map((s) => ({
        id: s.id,
        name: s.name,
        source: s.source,
        importedAt: s.importedAt,
        frameCount: s.frameCount,
        avgFPS: s.summary.avgFPS,
        hasTriage: triageResults.has(s.id),
      }));
      return apiSuccess({ sessions: list });
    }

    if (action === 'delete-session') {
      const { sessionId } = body;
      sessions.delete(sessionId);
      triageResults.delete(sessionId);
      return apiSuccess({ deleted: true });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(`Profiling error: ${err instanceof Error ? err.message : err}`, 500);
  }
}
