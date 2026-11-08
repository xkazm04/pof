/** A rebuild re-runs the recorded request: additionalArgs round-trip through the real headless_builds row. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

vi.mock('@/lib/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { ensureHeadlessBuildsTable, recordQueuedBuild, getBuildRequestById } from '@/lib/ue5-bridge/build-pipeline';
import { getDb } from '@/lib/db';
import type { BuildRequest } from '@/types/ue5-bridge';

const base: BuildRequest = {
  projectPath: 'C:\proj', targetName: 'PoFEditor', targetType: 'Editor',
  configuration: 'Development', platform: 'Win64', ueVersion: '5.8',
};

afterEach(() => { cleanup(); });
beforeEach(() => { ensureHeadlessBuildsTable(); getDb().exec('DELETE FROM headless_builds'); });

describe('rebuild request round-trip', () => {
  it('keeps additionalArgs', () => {
    recordQueuedBuild('b-args', { ...base, additionalArgs: ['-NoHotReload', '-Foo=1'] }, '2026-11-08T00:00:00Z');
    expect(getBuildRequestById('b-args')?.additionalArgs).toEqual(['-NoHotReload', '-Foo=1']);
  });

  it('a build without args rebuilds without args', () => {
    recordQueuedBuild('b-none', base, '2026-11-08T00:00:00Z');
    expect(getBuildRequestById('b-none')?.additionalArgs).toBeUndefined();
  });

  it('adds the column to a table created before it existed', () => {
    getDb().exec('DROP TABLE headless_builds');
    getDb().exec(`CREATE TABLE headless_builds (build_id TEXT PRIMARY KEY, project_path TEXT NOT NULL, target_name TEXT NOT NULL,
      ue_version TEXT NOT NULL, platform TEXT NOT NULL, configuration TEXT NOT NULL, target_type TEXT NOT NULL, status TEXT NOT NULL,
      started_at TEXT NOT NULL, completed_at TEXT, duration_ms INTEGER, exit_code INTEGER, error_count INTEGER NOT NULL DEFAULT 0,
      warning_count INTEGER NOT NULL DEFAULT 0, output TEXT NOT NULL DEFAULT '', diagnostics_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    ensureHeadlessBuildsTable();
    recordQueuedBuild('b-old', { ...base, additionalArgs: ['-X'] }, '2026-11-08T00:00:00Z');
    expect(getBuildRequestById('b-old')?.additionalArgs).toEqual(['-X']);
  });
});
