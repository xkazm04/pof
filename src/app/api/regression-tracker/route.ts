import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  processSession,
  getAllFingerprints,
  getOccurrences,
  getActiveAlerts,
  getAllAlerts,
  dismissAlert,
  markResolved,
  getRegressionStats,
} from '@/lib/regression-tracker';
import { getSession, listSessions } from '@/lib/game-director-db';

// GET ?action=fingerprints | alerts | active-alerts | occurrences&fpId=X | stats
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    if (action === 'fingerprints') {
      return apiSuccess(getAllFingerprints());
    }
    if (action === 'alerts') {
      return apiSuccess(getAllAlerts());
    }
    if (action === 'active-alerts') {
      return apiSuccess(getActiveAlerts());
    }
    if (action === 'occurrences') {
      const fpId = req.nextUrl.searchParams.get('fpId');
      if (!fpId) return apiError('fpId required', 400);
      return apiSuccess(getOccurrences(fpId));
    }
    if (action === 'stats') {
      return apiSuccess(getRegressionStats());
    }
    if (action === 'sessions') {
      // Return completed sessions for the dropdown
      const sessions = listSessions().filter(s => s.status === 'complete');
      return apiSuccess(sessions);
    }
    return apiError('Unknown action', 400);
  } catch (e) {
    return apiError(String(e));
  }
}

// POST body: { action: 'process-session', sessionId } | { action: 'dismiss', alertId } | { action: 'resolve', fingerprintId }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'process-session') {
      const { sessionId } = body;
      if (!sessionId) return apiError('sessionId required', 400);
      const session = getSession(sessionId);
      if (!session) return apiError('Session not found', 404);
      if (session.status !== 'complete') return apiError('Session must be complete to process', 400);
      const report = processSession(session);
      return apiSuccess(report);
    }

    if (action === 'dismiss') {
      const { alertId } = body;
      if (!alertId) return apiError('alertId required', 400);
      dismissAlert(alertId);
      return apiSuccess({ dismissed: true });
    }

    if (action === 'resolve') {
      const { fingerprintId } = body;
      if (!fingerprintId) return apiError('fingerprintId required', 400);
      markResolved(fingerprintId);
      return apiSuccess({ resolved: true });
    }

    return apiError('Unknown action', 400);
  } catch (e) {
    return apiError(String(e));
  }
}
