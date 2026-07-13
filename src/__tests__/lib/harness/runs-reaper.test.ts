import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  startRun,
  finalizeRun,
  getRun,
  reapStrandedRuns,
} from '@/lib/harness-runs-db';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS harness_runs');
  testDb.exec('DROP TABLE IF EXISTS harness_runs_old');
});

/** Insert a raw 'running' row WITHOUT registering it as live — simulates a row
 *  left behind by a crashed / previous-process orchestrator. */
function insertStaleRunning(runId: string): void {
  // ensureTable() runs on the first real call; trigger it via a live run we then remove.
  startRun({ runId: '__seed__', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
  testDb.prepare(`
    INSERT INTO harness_runs (run_id, project_name, project_path, status, started_at)
    VALUES (?, 'p', 'C:/p', 'running', '2026-01-01T00:00:00.000Z')
  `).run(runId);
}

describe('stranded-run reaper (Direction 1e)', () => {
  it('marks a stranded running row as interrupted with a reason', () => {
    insertStaleRunning('stale');
    const n = reapStrandedRuns();
    expect(n).toBeGreaterThanOrEqual(1);
    const row = getRun('stale');
    expect(row?.status).toBe('interrupted');
    expect(row?.errorMessage).toMatch(/interrupted/i);
    expect(row?.endedAt).not.toBeNull();
  });

  it('never reaps a run still live in this process', () => {
    startRun({ runId: 'live', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    reapStrandedRuns();
    expect(getRun('live')?.status).toBe('running');
  });

  it('a finalized run is settled, not reaped', () => {
    startRun({ runId: 'done', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    finalizeRun({ runId: 'done', status: 'completed', endedAt: '2026-01-01T00:05:00.000Z', plan: null, progress: [], guide: null, cost: null });
    reapStrandedRuns();
    expect(getRun('done')?.status).toBe('completed');
  });

  it('does not clobber an existing error_message / ended_at on reap', () => {
    insertStaleRunning('withmsg');
    testDb.prepare(`UPDATE harness_runs SET error_message = 'prior', ended_at = '2026-02-02T00:00:00.000Z' WHERE run_id = 'withmsg'`).run();
    reapStrandedRuns();
    const row = getRun('withmsg');
    expect(row?.status).toBe('interrupted');
    expect(row?.errorMessage).toBe('prior');
    expect(row?.endedAt).toBe('2026-02-02T00:00:00.000Z');
  });
});

describe('interrupted-status migration', () => {
  it('rebuilds a pre-existing table whose CHECK lacks interrupted, preserving rows', () => {
    // Simulate the OLD schema (no 'interrupted' in the CHECK constraint).
    testDb.exec(`
      CREATE TABLE harness_runs (
        run_id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        project_path TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('running','completed','paused','error')),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_ms INTEGER,
        iteration INTEGER NOT NULL DEFAULT 0,
        total_features INTEGER NOT NULL DEFAULT 0,
        passing_features INTEGER NOT NULL DEFAULT 0,
        pass_rate REAL NOT NULL DEFAULT 0,
        total_areas INTEGER NOT NULL DEFAULT 0,
        completed_areas INTEGER NOT NULL DEFAULT 0,
        failed_areas INTEGER NOT NULL DEFAULT 0,
        spent_usd REAL NOT NULL DEFAULT 0,
        budget_usd REAL,
        sessions INTEGER NOT NULL DEFAULT 0,
        theme_directive TEXT,
        error_message TEXT,
        plan_json TEXT NOT NULL DEFAULT '{}',
        progress_json TEXT NOT NULL DEFAULT '[]',
        guide_json TEXT,
        cost_json TEXT NOT NULL DEFAULT '{}'
      )
    `);
    testDb.prepare(`
      INSERT INTO harness_runs (run_id, project_name, project_path, status, started_at)
      VALUES ('old', 'p', 'C:/p', 'running', '2026-01-01T00:00:00.000Z')
    `).run();

    // Any ensureTable()-fronted call migrates; the row survives and can now be interrupted.
    const n = reapStrandedRuns();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(getRun('old')?.status).toBe('interrupted');
  });
});
