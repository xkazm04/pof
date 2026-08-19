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
  SessionSource,
} from '@/types/game-director';
import { simulatePlaytest } from '@/lib/game-director-sim';
import { logger } from '@/lib/logger';

/**
 * Coerce a client-supplied `source` to a known value. Anything unrecognised
 * falls back to the caller's default rather than reaching the DB CHECK
 * constraint — and an unrecognised value can never resolve to 'external',
 * because provenance is only ever claimed explicitly.
 */
function normalizeSource(value: unknown, fallback: SessionSource): SessionSource {
  return value === 'external' || value === 'simulated' ? value : fallback;
}

// ─── GET: list sessions, get single session, get findings, get events, get stats
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'list';
    const sessionId = searchParams.get('sessionId');

    switch (action) {
      case 'list':
        // Bound the UI list — the sessions table grows unbounded over the project's
        // life; the switcher only ever shows the most recent handful.
        return apiSuccess(listSessions(200));

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
    logger.error('[game-director] GET error:', err);
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
        const { name, buildPath, config, source } = body as CreateSessionPayload & { action: string };
        const id = `gd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        // Unstated provenance is 'simulated': a caller must SAY it is feeding real
        // playtest data, and the default can only ever understate the truth.
        const session = createSession(id, name, buildPath, config, normalizeSource(source, 'simulated'));
        return apiSuccess(session);
      }

      case 'update-status': {
        const { sessionId, status } = body as { action: string; sessionId: string; status: PlaytestStatus };
        updateSessionStatus(sessionId, status);
        return apiSuccess({ ok: true });
      }

      case 'complete': {
        const { sessionId, summary, durationMs, systemsTestedCount, findingsCount, source } = body as {
          action: string;
          sessionId: string;
          summary: PlaytestSummary;
          durationMs: number;
          systemsTestedCount: number;
          findingsCount: number;
          source?: SessionSource;
        };
        // This is the EXTERNAL writer seam: a real harness (Gauntlet, the pof-mcp
        // headless runner, a human) POSTs its own measured summary here, so the
        // default provenance is 'external'. The in-repo simulator never reaches
        // this branch — it calls updateSessionSummary directly with 'simulated'.
        updateSessionSummary(
          sessionId, summary, durationMs, systemsTestedCount, findingsCount,
          normalizeSource(source, 'external'),
        );
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
        // Runs the in-repo dev fixture: replays authored findings and stamps the
        // session `source: 'simulated'`. Nothing is launched or measured.
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
    logger.error('[game-director] POST error:', err);
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
    logger.error('[game-director] DELETE error:', err);
    return apiError(String(err));
  }
}
