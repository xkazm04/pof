import { getDb } from './db';

// ── Visual verification records (folder-04 §5 / Phase 2a) ──
// Persists the verdict of each agentic screenshot+Gemini HUD check so the
// operator can review past results. Written by /api/verify/visual.

export interface VisualVerificationRow {
  id: number;
  moduleId: string;
  itemId: string;
  projectPath: string | null;
  screenshotPath: string;
  verdict: 'pass' | 'fail';
  anyEmpty: boolean;
  elements: string[];
  notes: string;
  createdAt: string;
}

export interface RecordVisualVerificationInput {
  moduleId: string;
  itemId: string;
  projectPath?: string | null;
  screenshotPath: string;
  verdict: 'pass' | 'fail';
  anyEmpty: boolean;
  elements: string[];
  notes: string;
}

export function ensureVisualVerificationTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS visual_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      project_path TEXT,
      screenshot_path TEXT NOT NULL,
      verdict TEXT NOT NULL CHECK(verdict IN ('pass', 'fail')),
      any_empty INTEGER NOT NULL DEFAULT 0,
      elements TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function rowTo(row: Record<string, unknown>): VisualVerificationRow {
  return {
    id: row.id as number,
    moduleId: row.module_id as string,
    itemId: row.item_id as string,
    projectPath: (row.project_path as string | null) ?? null,
    screenshotPath: row.screenshot_path as string,
    verdict: row.verdict as 'pass' | 'fail',
    anyEmpty: !!row.any_empty,
    elements: JSON.parse((row.elements as string) || '[]'),
    notes: row.notes as string,
    createdAt: row.created_at as string,
  };
}

export function recordVisualVerification(input: RecordVisualVerificationInput): VisualVerificationRow {
  ensureVisualVerificationTable();
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO visual_verifications
        (module_id, item_id, project_path, screenshot_path, verdict, any_empty, elements, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.moduleId,
      input.itemId,
      input.projectPath ?? null,
      input.screenshotPath,
      input.verdict,
      input.anyEmpty ? 1 : 0,
      JSON.stringify(input.elements ?? []),
      input.notes ?? '',
    );
  const row = db
    .prepare('SELECT * FROM visual_verifications WHERE id = ?')
    .get(result.lastInsertRowid as number) as Record<string, unknown>;
  return rowTo(row);
}

export function listVisualVerifications(moduleId?: string): VisualVerificationRow[] {
  ensureVisualVerificationTable();
  const db = getDb();
  const rows = (
    moduleId
      ? db
          .prepare('SELECT * FROM visual_verifications WHERE module_id = ? ORDER BY id DESC')
          .all(moduleId)
      : db.prepare('SELECT * FROM visual_verifications ORDER BY id DESC').all()
  ) as Record<string, unknown>[];
  return rows.map(rowTo);
}
