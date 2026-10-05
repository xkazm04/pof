/* eslint-disable no-console -- CLI harness; stdout is its interface. */
// Goal-3 KPI reading: share of Feature Matrix modules fully re-reviewed within 14 days.
//
//   npm run kpi:matrix                      # one JSON reading on stdout
//   npm run kpi:matrix -- --project <id>    # restrict to one feature_matrix.project_id
//
// READ-ONLY: opens the DB with { readonly: true, fileMustExist: true }, so it can neither
// write nor create one. DB path = POF_DB_PATH or ~/.pof/pof.db — the same resolution as
// resolveDbPath in src/lib/db.ts (not imported: db.ts pulls the `@/` alias, which plain
// node cannot resolve). Node strips the types of the pure function file directly.
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { matrixFreshness, MATRIX_FRESH_WINDOW_DAYS } from '../src/lib/evaluator/matrix-freshness.ts';

const dbPath = process.env.POF_DB_PATH || join(homedir(), '.pof', 'pof.db');
if (!existsSync(dbPath)) {
  console.log(`no DB at ${dbPath}`);
  process.exit(0);
}

const pi = process.argv.indexOf('--project');
const project = pi > -1 ? process.argv[pi + 1] : undefined;

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
  const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'feature_matrix'").get();
  if (!has) {
    console.log(`no feature_matrix table in ${dbPath}`);
    process.exit(0);
  }
  const rows = (project === undefined
    ? db.prepare('SELECT module_id, last_reviewed_at FROM feature_matrix').all()
    : db.prepare('SELECT module_id, last_reviewed_at FROM feature_matrix WHERE project_id = ?').all(project)
  ).map((r) => ({ moduleId: r.module_id, lastReviewedAt: r.last_reviewed_at }));
  const now = Date.now();
  const reading = matrixFreshness(rows, now, MATRIX_FRESH_WINDOW_DAYS);
  console.log(JSON.stringify({
    kpi: 'matrix-freshness',
    readAt: new Date(now).toISOString(),
    dbPath,
    project: project ?? 'all',
    rows: rows.length,
    ...reading,
  }, null, 2));
} finally {
  db.close();
}
