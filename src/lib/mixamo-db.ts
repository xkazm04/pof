import { getDb } from '@/lib/db';

/** A recorded Mixamo import/retarget run (one mixamo_pipeline.py invocation). */
export interface MixamoRun {
  id: number;
  importedCount: number;
  importDir: string;
  createdAt: string;
}

function ensureMixamoTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS mixamo_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imported_count INTEGER NOT NULL,
      import_dir TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function rowToRun(row: Record<string, unknown>): MixamoRun {
  return {
    id: row.id as number,
    importedCount: row.imported_count as number,
    importDir: row.import_dir as string,
    createdAt: row.created_at as string,
  };
}

export function recordMixamoRun(input: { importedCount: number; importDir: string }): MixamoRun {
  ensureMixamoTable();
  const db = getDb();
  const info = db
    .prepare('INSERT INTO mixamo_runs (imported_count, import_dir) VALUES (?, ?)')
    .run(input.importedCount, input.importDir);
  const row = db
    .prepare('SELECT * FROM mixamo_runs WHERE id = ?')
    .get(info.lastInsertRowid) as Record<string, unknown>;
  return rowToRun(row);
}

export function getLatestMixamoRun(): MixamoRun | null {
  ensureMixamoTable();
  const row = getDb()
    .prepare('SELECT * FROM mixamo_runs ORDER BY id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}
