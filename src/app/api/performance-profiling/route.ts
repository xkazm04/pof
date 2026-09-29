import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildSessionFromCSV } from '@/lib/profiling/csv-parser';
import { generateSampleSession } from '@/lib/profiling/sample-generator';
import { runTriage } from '@/lib/profiling/triage-engine';
import { compareSessions, type ComparedSessionHead, type SessionComparisonResponse } from '@/lib/profiling/session-compare';
import type { ProfilingSession, TriageResult } from '@/types/performance-profiling';

// In-memory store for sessions (persists per server process)
const sessions = new Map<string, ProfilingSession>();
const triageResults = new Map<string, TriageResult>();

/** The stored triage for a session, running (and storing) it first when missing. */
function ensureTriage(session: ProfilingSession): TriageResult {
  const existing = triageResults.get(session.id);
  if (existing) return existing;
  const result = runTriage(session);
  triageResults.set(session.id, result);
  return result;
}

function sessionHead(session: ProfilingSession, triage: TriageResult): ComparedSessionHead {
  return {
    id: session.id,
    name: session.name,
    importedAt: session.importedAt,
    frameBudgetMs: session.summary.frameBudgetMs,
    overallScore: triage.overallScore,
    bottleneck: triage.bottleneck,
  };
}

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
      // Newest first; reverse insertion order breaks same-millisecond importedAt ties.
      const newestFirst = [...sessions.values()].reverse()
        .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
      const list = newestFirst.map((s) => {
        const triage = triageResults.get(s.id) ?? null;
        return {
          id: s.id,
          name: s.name,
          source: s.source,
          importedAt: s.importedAt,
          frameCount: s.frameCount,
          avgFPS: s.summary.avgFPS,
          hasTriage: triage !== null,
          overallScore: triage?.overallScore ?? null,
          bottleneck: triage?.bottleneck ?? null,
        };
      });
      return apiSuccess({ sessions: list });
    }

    if (action === 'compare') {
      const { baseId, headId } = body;
      if (typeof baseId !== 'string' || typeof headId !== 'string' || !baseId || !headId) {
        return apiError('baseId and headId are required', 400);
      }
      if (baseId === headId) return apiError('baseId and headId must differ', 400);
      const base = sessions.get(baseId);
      if (!base) return apiError(`Session not found: ${baseId}`, 404);
      const head = sessions.get(headId);
      if (!head) return apiError(`Session not found: ${headId}`, 404);
      const baseTriage = ensureTriage(base);
      const headTriage = ensureTriage(head);
      const comparison: SessionComparisonResponse = {
        base: sessionHead(base, baseTriage),
        head: sessionHead(head, headTriage),
        ...compareSessions(base.summary, head.summary, baseTriage.findings, headTriage.findings),
      };
      return apiSuccess(comparison);
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
