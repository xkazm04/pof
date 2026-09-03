/**
 * The rebuild of `game_director_findings` against a database that already holds
 * real rows.
 *
 * SQLite cannot widen a CHECK constraint or drop NOT NULL in place, so admitting
 * the `unreproducible` triage state and a nullable `confidence` needs a table
 * rebuild. This test stands up the OLD schema, fills it, then lets the module
 * bootstrap run — the migration must preserve every row, keep every legacy value,
 * accept the new writes afterwards, and be a no-op the second time.
 *
 * Throwaway DB (POF_DB_PATH is set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-migration-${process.pid}.db`;
});

import { getDb } from '@/lib/db';

// The OLD schema, verbatim, created before anything calls ensureTables().
const db = getDb();
db.exec(`
  CREATE TABLE IF NOT EXISTS game_director_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'configuring',
    build_path TEXT NOT NULL DEFAULT '',
    config TEXT NOT NULL DEFAULT '{}',
    summary TEXT,
    systems_tested_count INTEGER NOT NULL DEFAULT 0,
    findings_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS game_director_findings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium'
      CHECK(severity IN ('critical','high','medium','low','positive')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    related_module TEXT,
    screenshot_ref TEXT,
    game_timestamp REAL,
    suggested_fix TEXT NOT NULL DEFAULT '',
    confidence INTEGER NOT NULL DEFAULT 80,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    triage_status TEXT NOT NULL DEFAULT 'active'
      CHECK(triage_status IN ('active','confirmed','false-positive','ignore','snooze')),
    triage_note TEXT NOT NULL DEFAULT '',
    snoozed_until TEXT,
    fix_dispatched_at TEXT,
    FOREIGN KEY (session_id) REFERENCES game_director_sessions(id) ON DELETE CASCADE
  );
`);
db.prepare(`INSERT INTO game_director_sessions (id, name) VALUES ('legacy-s', 'Legacy session')`).run();
const insertLegacy = db.prepare(`
  INSERT INTO game_director_findings (id, session_id, category, severity, title, description, suggested_fix, confidence, triage_status)
  VALUES (?, 'legacy-s', 'ai-behavior', ?, ?, ?, ?, ?, ?)
`);
insertLegacy.run('legacy-1', 'high', 'Enemies stall on stairs', 'd1', 'fix1', 80, 'active');
insertLegacy.run('legacy-2', 'medium', 'Loot beam clips floor', 'd2', 'fix2', 42, 'confirmed');
insertLegacy.run('legacy-3', 'low', 'Menu hover audio doubles', 'd3', '', 80, 'false-positive');

// Only NOW does the module bootstrap (and its migration) run.
import { getFindings, updateFindingTriage, addFinding } from '@/lib/game-director-db';
import { resolveConfidence } from '@/lib/game-director-styles';

function tableSql(): string {
  return (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='game_director_findings'"
  ).get() as { sql: string }).sql;
}

describe('rebuilding game_director_findings on a populated database', () => {
  it('carries every legacy row across, values intact', () => {
    const rows = getFindings('legacy-s');
    expect(rows).toHaveLength(3);

    const byId = new Map(rows.map(r => [r.id, r]));
    expect(byId.get('legacy-1')!.title).toBe('Enemies stall on stairs');
    expect(byId.get('legacy-2')!.suggestedFix).toBe('fix2');
    expect(byId.get('legacy-3')!.triageStatus).toBe('false-positive');

    // Numbers are PRESERVED, not discarded — but they are no longer readable as
    // measurements, because the old column stored the default and the score alike.
    expect(byId.get('legacy-1')!.confidence).toBe(80);
    expect(byId.get('legacy-2')!.confidence).toBe(42);
    expect(resolveConfidence(byId.get('legacy-1')!).kind).toBe('unattributed');
    expect(resolveConfidence(byId.get('legacy-2')!).kind).toBe('unattributed');
  });

  it('leaves the scratch table behind on no path', () => {
    const scratch = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='game_director_findings__rebuild'"
    ).get();
    expect(scratch).toBeUndefined();
  });

  it('now accepts the widened triage vocabulary the old CHECK rejected', () => {
    const updated = updateFindingTriage('legacy-1', 'unreproducible', 'tried on nightly', null, {
      attempts: 6,
      buildId: 'legacy-build',
    });
    expect(updated?.triageStatus).toBe('unreproducible');
    expect(updated?.reproAttempts).toBe(6);
  });

  it('now accepts a null confidence the old NOT NULL rejected', () => {
    addFinding({
      id: 'post-migration-1',
      sessionId: 'legacy-s',
      category: 'ux-problem',
      severity: 'low',
      title: 'Nobody scored this one',
      description: '',
      relatedModule: null,
      screenshotRef: null,
      gameTimestamp: null,
      suggestedFix: '',
      confidence: null,
      confidenceBasis: null,
      createdAt: new Date().toISOString(),
      triageStatus: 'active',
      triageNote: '',
      snoozedUntil: null,
      fixDispatchedAt: null,
    });
    const row = getFindings('legacy-s').find(f => f.id === 'post-migration-1')!;
    expect(row.confidence).toBeNull();
  });

  it('is idempotent — the DDL no longer matches either probe', () => {
    const sql = tableSql();
    expect(sql).toContain("'unreproducible'");
    expect(/[(,]\s*confidence\s+INTEGER\s+NOT\s+NULL/i.test(sql)).toBe(false);
    expect(sql).toContain('repro_attempts');
    expect(sql).toContain('confidence_basis');
  });

  it('kept the foreign key and re-enabled enforcement afterwards', () => {
    expect(tableSql()).toContain('REFERENCES game_director_sessions');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
