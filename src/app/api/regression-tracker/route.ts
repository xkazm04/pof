import { NextRequest, NextResponse } from 'next/server';
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

function ok(data: unknown) {
  return NextResponse.json({ ok: true, data });
}
function err(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

// GET ?action=fingerprints | alerts | active-alerts | occurrences&fpId=X | stats
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    if (action === 'fingerprints') {
      return ok(getAllFingerprints());
    }
    if (action === 'alerts') {
      return ok(getAllAlerts());
    }
    if (action === 'active-alerts') {
      return ok(getActiveAlerts());
    }
    if (action === 'occurrences') {
      const fpId = req.nextUrl.searchParams.get('fpId');
      if (!fpId) return err('fpId required');
      return ok(getOccurrences(fpId));
    }
    if (action === 'stats') {
      return ok(getRegressionStats());
    }
    if (action === 'sessions') {
      // Return completed sessions for the dropdown
      const sessions = listSessions().filter(s => s.status === 'complete');
      return ok(sessions);
    }
    return err('Unknown action');
  } catch (e) {
    return err(String(e), 500);
  }
}

// POST body: { action: 'process-session', sessionId } | { action: 'dismiss', alertId } | { action: 'resolve', fingerprintId }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'process-session') {
      const { sessionId } = body;
      if (!sessionId) return err('sessionId required');
      const session = getSession(sessionId);
      if (!session) return err('Session not found', 404);
      if (session.status !== 'complete') return err('Session must be complete to process');
      const report = processSession(session);
      return ok(report);
    }

    if (action === 'dismiss') {
      const { alertId } = body;
      if (!alertId) return err('alertId required');
      dismissAlert(alertId);
      return ok({ dismissed: true });
    }

    if (action === 'resolve') {
      const { fingerprintId } = body;
      if (!fingerprintId) return err('fingerprintId required');
      markResolved(fingerprintId);
      return ok({ resolved: true });
    }

    return err('Unknown action');
  } catch (e) {
    return err(String(e), 500);
  }
}
