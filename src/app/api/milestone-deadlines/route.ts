import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

interface DeadlineRow {
  milestone_id: string;
  target_date: string;
  label: string;
  updated_at: string;
}

/** GET — fetch all milestone deadlines */
export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM milestone_deadlines').all() as DeadlineRow[];
    const map: Record<string, { targetDate: string; label: string }> = {};
    for (const r of rows) {
      map[r.milestone_id] = { targetDate: r.target_date, label: r.label };
    }
    return apiSuccess(map);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err));
  }
}

/** PUT — upsert a single milestone deadline */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => undefined);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return apiError('Request body must be a JSON object', 400);
    }
    const { milestoneId, targetDate, label } = body as {
      milestoneId?: string;
      targetDate?: string | null;
      label?: string;
    };

    if (typeof milestoneId !== 'string' || !milestoneId) return apiError('milestoneId is required', 400);
    if (label !== undefined && typeof label !== 'string') return apiError('label must be a string', 400);
    // Only an explicit null or '' clears a deadline: an omitted field is not a delete.
    if (targetDate === undefined) return apiError('targetDate is required (null clears the deadline)', 400);
    if (targetDate !== null && targetDate !== '' && (typeof targetDate !== 'string' || !Number.isFinite(Date.parse(targetDate)))) {
      return apiError('targetDate must be a parseable date, or null to clear it', 400);
    }

    const db = getDb();

    if (!targetDate) {
      // Remove deadline
      db.prepare('DELETE FROM milestone_deadlines WHERE milestone_id = ?').run(milestoneId);
    } else {
      db.prepare(
        `INSERT INTO milestone_deadlines (milestone_id, target_date, label, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(milestone_id) DO UPDATE SET
           target_date = excluded.target_date,
           label = COALESCE(excluded.label, milestone_deadlines.label),
           updated_at = datetime('now')`
      ).run(milestoneId, targetDate, label ?? '');
    }

    return apiSuccess({ ok: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err));
  }
}
