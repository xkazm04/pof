import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  updateSessionStatus,
  updateSessionSummary,
  addFinding,
  getFindings,
  getAllFindings,
  addEvent,
  getEvents,
  getDirectorStats,
  getHealthTrend,
  updateFindingTriage,
  markFindingFixDispatched,
} from '@/lib/game-director-db';
import type {
  CreateSessionPayload,
  PlaytestFinding,
  PlaytestSummary,
  DirectorEvent,
  PlaytestStatus,
  UpdateTriagePayload,
} from '@/types/game-director';
import { simulatePlaytest } from '@/lib/game-director-sim';

// ─── GET: list sessions, get single session, get findings, get events, get stats
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'list';
    const sessionId = searchParams.get('sessionId');

    switch (action) {
      case 'list':
        return apiSuccess(listSessions());

      case 'get':
        if (!sessionId) return apiError('sessionId required', 400);
        const session = getSession(sessionId);
        if (!session) return apiError('Session not found', 404);
        return apiSuccess(session);

      case 'findings':
        if (!sessionId) return apiError('sessionId required', 400);
        return apiSuccess(getFindings(sessionId));

      case 'all-findings':
        // Batch path for FindingsExplorer: one request returning every finding,
        // grouped/filtered client-side. Replaces the per-session fan-out.
        return apiSuccess(getAllFindings());

      case 'events':
        if (!sessionId) return apiError('sessionId required', 400);
        return apiSuccess(getEvents(sessionId));

      case 'stats':
        return apiSuccess(getDirectorStats());

      case 'trend': {
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 30;
        return apiSuccess(getHealthTrend(limit));
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error('[game-director] GET error:', err);
    return apiError(String(err));
  }
}

// ─── POST: create session, start session, add finding, add event, run analysis
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'create': {
        const { name, buildPath, config } = body as CreateSessionPayload & { action: string };
        const id = `gd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const session = createSession(id, name, buildPath, config);
        return apiSuccess(session);
      }

      case 'update-status': {
        const { sessionId, status } = body as { action: string; sessionId: string; status: PlaytestStatus };
        updateSessionStatus(sessionId, status);
        return apiSuccess({ ok: true });
      }

      case 'complete': {
        const { sessionId, summary, durationMs, systemsTestedCount, findingsCount } = body as {
          action: string;
          sessionId: string;
          summary: PlaytestSummary;
          durationMs: number;
          systemsTestedCount: number;
          findingsCount: number;
        };
        updateSessionSummary(sessionId, summary, durationMs, systemsTestedCount, findingsCount);
        return apiSuccess({ ok: true });
      }

      case 'add-finding': {
        const { finding } = body as { action: string; finding: PlaytestFinding };
        addFinding(finding);
        return apiSuccess({ ok: true });
      }

      case 'update-triage': {
        const { findingId, triageStatus, triageNote, snoozedUntil } = body as UpdateTriagePayload & { action: string };
        if (!findingId || !triageStatus) return apiError('findingId and triageStatus required', 400);
        const updated = updateFindingTriage(
          findingId,
          triageStatus,
          triageNote ?? '',
          snoozedUntil ?? null,
        );
        if (!updated) return apiError('Finding not found', 404);
        return apiSuccess(updated);
      }

      case 'mark-fix-dispatched': {
        const { findingId } = body as { action: string; findingId: string };
        if (!findingId) return apiError('findingId required', 400);
        const updated = markFindingFixDispatched(findingId);
        if (!updated) return apiError('Finding not found', 404);
        return apiSuccess(updated);
      }

      case 'add-event': {
        const { event } = body as { action: string; event: DirectorEvent };
        addEvent(event);
        return apiSuccess({ ok: true });
      }

      case 'simulate': {
        // Simulate a playtest session for demo/dev purposes
        const { sessionId } = body as { action: string; sessionId: string };
        const session = getSession(sessionId);
        if (!session) return apiError('Session not found', 404);

        await simulatePlaytest(sessionId, session.config);
        const updatedSession = getSession(sessionId);
        return apiSuccess(updatedSession);
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error('[game-director] POST error:', err);
    return apiError(String(err));
  }
}

// ─── DELETE: remove session
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return apiError('sessionId required', 400);
    deleteSession(sessionId);
    return apiSuccess({ ok: true });
  } catch (err) {
    console.error('[game-director] DELETE error:', err);
    return apiError(String(err));
  }
}
