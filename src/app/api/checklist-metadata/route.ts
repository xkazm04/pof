import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

export type Priority = 'none' | 'critical' | 'important' | 'nice-to-have';

export interface ChecklistMetadataRow {
  moduleId: string;
  itemId: string;
  priority: Priority;
  notes: string;
  updatedAt: string;
}

/**
 * GET /api/checklist-metadata?moduleId=X
 *   Returns all metadata for a module's checklist items
 *
 * PUT /api/checklist-metadata
 *   body: { moduleId, itemId, priority?, notes? }
 *   Upserts metadata for a single checklist item
 */
export async function GET(req: NextRequest) {
  try {
    const moduleId = req.nextUrl.searchParams.get('moduleId');
    if (!moduleId) return apiError('moduleId is required', 400);

    const db = getDb();
    const rows = db.prepare(
      'SELECT module_id, item_id, priority, notes, updated_at FROM checklist_metadata WHERE module_id = ?'
    ).all(moduleId) as { module_id: string; item_id: string; priority: string; notes: string; updated_at: string }[];

    const result: Record<string, ChecklistMetadataRow> = {};
    for (const row of rows) {
      result[row.item_id] = {
        moduleId: row.module_id,
        itemId: row.item_id,
        priority: row.priority as Priority,
        notes: row.notes,
        updatedAt: row.updated_at,
      };
    }

    return apiSuccess(result);
  } catch (err) {
    return apiError(String(err), 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { moduleId, itemId, priority, notes } = body as {
      moduleId: string;
      itemId: string;
      priority?: Priority;
      notes?: string;
    };

    if (!moduleId || !itemId) return apiError('moduleId and itemId are required', 400);

    const db = getDb();

    // Get existing row
    const existing = db.prepare(
      'SELECT priority, notes FROM checklist_metadata WHERE module_id = ? AND item_id = ?'
    ).get(moduleId, itemId) as { priority: string; notes: string } | undefined;

    const finalPriority = priority ?? existing?.priority ?? 'none';
    const finalNotes = notes ?? existing?.notes ?? '';

    db.prepare(`
      INSERT INTO checklist_metadata (module_id, item_id, priority, notes, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(module_id, item_id)
      DO UPDATE SET
        priority = excluded.priority,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).run(moduleId, itemId, finalPriority, finalNotes);

    return apiSuccess({
      moduleId,
      itemId,
      priority: finalPriority,
      notes: finalNotes,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return apiError(String(err), 500);
  }
}
