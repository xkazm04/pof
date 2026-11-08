/**
 * scan-sweep night 2026-11-08 (module-evaluator): deep_eval_passes was UNIQUE
 * (scan_id, module_id, pass), so a second project running with the same scanId
 * overwrote the first project's recorded passes and the first could no longer resume.
 * The write key now includes project_id; an existing DB with the old key is rebuilt.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  // A DB an older build left behind: the legacy key, one recorded row.
  db.exec(`
    CREATE TABLE deep_eval_passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL,
      project_id TEXT NOT NULL DEFAULT '',
      module_id TEXT NOT NULL,
      pass TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      findings_json TEXT NOT NULL DEFAULT '[]',
      finished_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (scan_id, module_id, pass)
    )
  `);
  db.prepare("INSERT INTO deep_eval_passes (scan_id, project_id, module_id, pass, status) VALUES ('LEGACY', 'C:/old', 'audio', 'structure', 'done')").run();
  return { getDb: () => db };
});

import { readPassLedger, recordPassOutcome } from '@/lib/evaluator/deep-eval-pass-ledger';

const cell = { moduleId: 'audio', pass: 'structure' as const, findings: [], error: null };

describe('deep_eval_passes write key', () => {
  beforeAll(() => {
    // First touch runs the lazy migration.
    readPassLedger('LEGACY', 'C:/old');
  });

  it('keeps a legacy row through the rebuild', () => {
    const rows = readPassLedger('LEGACY', 'C:/old');
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('done');
  });

  it('a second project reusing a scanId does not overwrite the first project\'s pass', () => {
    recordPassOutcome('X', 'C:/A', { ...cell, status: 'done' });
    recordPassOutcome('X', 'C:/B', { ...cell, status: 'error', error: 'boom' });
    const a = readPassLedger('X', 'C:/A');
    expect(a).toHaveLength(1);
    expect(a[0].status).toBe('done');
    expect(readPassLedger('X', 'C:/B')[0].status).toBe('error');
  });

  it('a re-run of the same project cell still replaces its own row', () => {
    recordPassOutcome('Y', 'C:/A', { ...cell, status: 'error', error: 'first' });
    recordPassOutcome('Y', 'C:/A', { ...cell, status: 'done' });
    const rows = readPassLedger('Y', 'C:/A');
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('done');
  });
});
