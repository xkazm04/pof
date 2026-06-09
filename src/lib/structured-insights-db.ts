import { getDb } from './db';
import type { SubModuleId } from '@/types/modules';
import type { StructuredInsight } from '@/types/structured-insights';

/**
 * Persistence for structured insights — rich entities (classes, steps,
 * warnings, file paths) extracted from CLI response text by
 * `extractStructuredEntities` in `structured-insights.ts`.
 *
 * Owns the `structured_insights` table DDL plus its save/get CRUD, matching
 * the project convention that DB logic lives in `*-db.ts` files.
 */

// ── Schema bootstrap ─────────────────────────────────────────────────────────

export function ensureStructuredInsightsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS structured_insights (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
      entities_json TEXT NOT NULL DEFAULT '[]',
      class_hierarchy_json TEXT NOT NULL DEFAULT '[]',
      steps_json TEXT NOT NULL DEFAULT '[]',
      warnings_json TEXT NOT NULL DEFAULT '[]',
      file_paths_json TEXT NOT NULL DEFAULT '[]'
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_structured_insights_session
    ON structured_insights(session_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_structured_insights_module
    ON structured_insights(module_id)
  `);
}

// ── Persist to DB ────────────────────────────────────────────────────────────

export function saveStructuredInsight(insight: StructuredInsight): void {
  ensureStructuredInsightsTable();
  const db = getDb();

  db.prepare(`
    INSERT OR REPLACE INTO structured_insights
      (id, session_id, module_id, extracted_at, entities_json, class_hierarchy_json, steps_json, warnings_json, file_paths_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    insight.id,
    insight.sessionId,
    insight.moduleId,
    insight.extractedAt,
    JSON.stringify(insight.entities),
    JSON.stringify(insight.classHierarchy),
    JSON.stringify(insight.steps),
    JSON.stringify(insight.warnings),
    JSON.stringify(insight.filePaths),
  );
}

// ── Query ────────────────────────────────────────────────────────────────────

function rowToInsight(row: Record<string, unknown>): StructuredInsight {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    moduleId: row.module_id as string,
    extractedAt: row.extracted_at as string,
    entities: JSON.parse(row.entities_json as string),
    classHierarchy: JSON.parse(row.class_hierarchy_json as string),
    steps: JSON.parse(row.steps_json as string),
    warnings: JSON.parse(row.warnings_json as string),
    filePaths: JSON.parse(row.file_paths_json as string),
  };
}

export function getInsightsForSession(sessionId: string): StructuredInsight | null {
  ensureStructuredInsightsTable();
  const db = getDb();

  const row = db.prepare(
    'SELECT * FROM structured_insights WHERE session_id = ? ORDER BY extracted_at DESC LIMIT 1'
  ).get(sessionId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return rowToInsight(row);
}

export function getInsightsForModule(moduleId: SubModuleId): StructuredInsight[] {
  ensureStructuredInsightsTable();
  const db = getDb();

  const rows = db.prepare(
    'SELECT * FROM structured_insights WHERE module_id = ? ORDER BY extracted_at DESC LIMIT 20'
  ).all(moduleId) as Record<string, unknown>[];

  return rows.map(rowToInsight);
}
