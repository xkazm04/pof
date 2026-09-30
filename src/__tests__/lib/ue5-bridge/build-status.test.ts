import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { resolveBuildStatus, type BuildStatusRow } from '@/lib/ue5-bridge/build-status';
import { ensureHeadlessBuildsTable, getBuildHistory } from '@/lib/ue5-bridge/build-pipeline';
import { getHealthBuilds, getBuildHealthReport, summarizeBuilds } from '@/lib/ue5-bridge/build-health';
import { getDb } from '@/lib/db';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { BuildQueueItem } from '@/types/ue5-bridge';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

function row(over: Partial<BuildStatusRow>): BuildStatusRow {
  return {
    build_id: 'b1', status: 'running', started_at: iso(NOW), completed_at: null,
    duration_ms: null, exit_code: null, error_count: 0, warning_count: 0, ...over,
  };
}

describe('resolveBuildStatus orphan rule (case 5)', () => {
  it('an unowned running row older than the build watchdog is failed + interrupted', () => {
    const v = resolveBuildStatus({
      live: null,
      row: row({ started_at: iso(NOW - (UI_TIMEOUTS.buildProcessTimeout + 1000)) }),
      now: NOW,
    });
    expect(v).toMatchObject({ buildId: 'b1', status: 'failed', interrupted: true });
    expect(v?.reason).toMatch(/no longer running|interrupted/);
  });

  it('an unowned running row started 5 s ago is still running, not owned', () => {
    const v = resolveBuildStatus({ live: null, row: row({ started_at: iso(NOW - 5000) }), now: NOW });
    expect(v).toMatchObject({ buildId: 'b1', status: 'running', owned: false });
    expect(v?.interrupted).toBeUndefined();
  });

  it('an unowned queued row (any age) is failed + interrupted — the in-memory queue that held it is gone', () => {
    for (const age of [0, 5000, UI_TIMEOUTS.buildProcessTimeout * 3]) {
      const v = resolveBuildStatus({ live: null, row: row({ status: 'queued', started_at: iso(NOW - age) }), now: NOW });
      expect(v).toMatchObject({ buildId: 'b1', status: 'failed', interrupted: true });
      expect(v?.reason).toMatch(/no longer queued|interrupted/);
    }
  });

  it('a live queue item for the id wins over any row', () => {
    const live: BuildQueueItem = {
      buildId: 'b1', status: 'running', queuedAt: iso(NOW - 9000), startedAt: iso(NOW - 8000),
      request: { projectPath: 'C:\\P', targetName: 'Did', ueVersion: '5.8.0', platform: 'Win64', configuration: 'Development', targetType: 'Editor' },
      progress: { message: '[3/42] Compile A.cpp', percent: 7 },
    };
    const stale = row({ status: 'queued', started_at: iso(NOW - UI_TIMEOUTS.buildProcessTimeout * 2) });
    const v = resolveBuildStatus({ live, row: stale, now: NOW });
    expect(v).toMatchObject({ buildId: 'b1', status: 'running', owned: true, progress: { percent: 7 } });
    expect(v?.interrupted).toBeUndefined();
  });

  it('no live item and no row is unknown (null)', () => {
    expect(resolveBuildStatus({ live: null, row: null, now: NOW })).toBeNull();
  });
});

describe('[guard] health and history stay terminal (case 6)', () => {
  const P = 'C:\\ProjP';
  const insert = (id: string, status: string, durationMs: number | null, createdAt: string) =>
    getDb().prepare(
      `INSERT INTO headless_builds (build_id, project_path, target_name, ue_version, platform, configuration,
         target_type, status, started_at, duration_ms, error_count, warning_count, created_at)
       VALUES (?, ?, 'Did', '5.8.0', 'Win64', 'Development', 'Editor', ?, ?, ?, 0, 0, ?)`,
    ).run(id, P, status, createdAt, durationMs, createdAt);

  beforeEach(() => {
    ensureHeadlessBuildsTable();
    getDb().exec('DELETE FROM headless_builds');
    insert('t1', 'success', 1000, '2026-09-30T10:00:00Z');
    insert('t2', 'success', 1100, '2026-09-30T10:01:00Z');
    insert('t3', 'failed', 900, '2026-09-30T10:02:00Z');
    insert('r1', 'running', null, '2026-09-30T10:03:00Z');
    insert('q1', 'queued', null, '2026-09-30T10:04:00Z');
  });

  it('getHealthBuilds, getBuildHistory and the report success rate see only the 3 terminal rows', () => {
    const ids = (xs: Array<{ buildId: string }>) => xs.map((x) => x.buildId).sort();
    const health = getHealthBuilds(P);
    expect(ids(health)).toEqual(['t1', 't2', 't3']);
    expect(ids(getBuildHistory(P))).toEqual(['t1', 't2', 't3']);
    expect(getBuildHealthReport(P).summary.successRate).toBe(summarizeBuilds(health).successRate);
    expect(getBuildHealthReport(P).summary.successRate).toBe(67);
  });
});
