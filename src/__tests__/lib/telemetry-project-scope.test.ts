/**
 * `telemetry_snapshots` is project-scoped on every read.
 *
 * The column `project_path` was written by every scan and read by NOTHING:
 * `getLatestSnapshot()` returned the newest scan of ANY project, and
 * `POST /api/telemetry {action:'resolve-skills'}` fed exactly that row's
 * `detectedPatterns` into `resolveSkillsFromPatterns` — which decides which domain
 * skill packs get injected into CLI PROMPTS. With two projects on this machine
 * (`PoF` and `jinx` in `recent_projects`), scanning one silently changed which
 * knowledge the other's prompts carried.
 *
 * Every assertion below was RED before this change:
 *   • `getLatestSnapshot(A)` returned B's newer row;
 *   • `getSnapshotHistory` / `getTelemetryStats` counted B's scans as A's;
 *   • `resolve-skills` accepted no project at all and served the global newest row;
 *   • nothing counted the excluded rows, so an empty scope was indistinguishable
 *     from "never scanned".
 *
 * Runs the real store + route handlers against the real SQLite schema (throwaway DB).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-telemetry-project-scope-${process.pid}.db`;
});

import { getDb } from '@/lib/db';
import {
  getLatestSnapshot,
  getSnapshotHistory,
  getTelemetryStats,
  getTelemetryScopeReport,
  GENRE_SUGGESTION_SCOPE,
} from '@/lib/telemetry-db';
import { POST, GET } from '@/app/api/telemetry/route';

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

function seedSnapshot(id: string, scannedAt: string, projectPath: string, pattern: string) {
  getDb()
    .prepare(
      `INSERT INTO telemetry_snapshots (id, scanned_at, project_path, signals, detected_patterns)
       VALUES (?, ?, ?, '{}', ?)`,
    )
    .run(id, scannedAt, projectPath, JSON.stringify([{ pattern, confidence: 90, evidence: [] }]));
}

function post(body: unknown): Request {
  return new Request('http://localhost:3001/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function envelope(res: Response) {
  return (await res.json()) as { success: boolean; data?: Record<string, unknown>; error?: string };
}

beforeEach(() => {
  getDb().prepare('DELETE FROM telemetry_snapshots').run();
});

describe('telemetry snapshots are scoped to the project that produced them', () => {
  it('getLatestSnapshot(A) returns A\'s scan even when B scanned more recently', () => {
    seedSnapshot('snap-a', '2026-02-18T18:45:03.793Z', PROJECT_A, 'loot-driven');
    seedSnapshot('snap-b', '2026-08-19T09:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');

    expect(getLatestSnapshot(PROJECT_A)?.id).toBe('snap-a');
    expect(getLatestSnapshot(PROJECT_B)?.id).toBe('snap-b');
  });

  it('normalizes identity the same way the rest of the app does (case / separators)', () => {
    seedSnapshot('snap-a', '2026-02-18T18:45:03.793Z', PROJECT_A, 'loot-driven');
    expect(getLatestSnapshot('c:/users/kazda/documents/unreal projects/pof/')?.id).toBe('snap-a');
  });

  it('history and totals count only the scans this project can see', () => {
    seedSnapshot('snap-a1', '2026-02-18T18:45:03.793Z', PROJECT_A, 'loot-driven');
    seedSnapshot('snap-a2', '2026-02-19T09:42:39.441Z', PROJECT_A, 'loot-driven');
    seedSnapshot('snap-b', '2026-08-19T09:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');

    expect(getSnapshotHistory(10, PROJECT_A).map((s) => s.id)).toEqual(['snap-a2', 'snap-a1']);
    expect(getTelemetryStats(PROJECT_A).totalScans).toBe(2);
    expect(getTelemetryStats(PROJECT_B).totalScans).toBe(1);
  });

  it('an unattributed (blank-path) scan stays visible to every project — never hidden, never adopted', () => {
    seedSnapshot('snap-legacy', '2026-01-01T00:00:00.000Z', '', 'loot-driven');
    seedSnapshot('snap-b', '2026-08-19T09:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');

    // Visible to A (which owns nothing of its own) …
    expect(getLatestSnapshot(PROJECT_A)?.id).toBe('snap-legacy');
    // … and to B, whose own newer row still wins.
    expect(getLatestSnapshot(PROJECT_B)?.id).toBe('snap-b');
    // … and its ownership is never guessed.
    const report = getTelemetryScopeReport(PROJECT_A);
    expect(report.legacyRows).toBe(1);
    expect(report.ownedRows).toBe(0);
    expect(report.foreignRows).toBe(1);
  });

  it('counts the excluded rows so an empty scope cannot read as "never scanned"', () => {
    seedSnapshot('snap-b1', '2026-08-19T09:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');
    seedSnapshot('snap-b2', '2026-08-19T10:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');

    const stats = getTelemetryStats(PROJECT_A);
    expect(stats.totalScans).toBe(0);
    expect(stats.scope?.foreignRows).toBe(2);
    expect(stats.scope?.distinctProjects).toBe(1);
  });

  it('an unscoped read sees only unattributed scans — never "whichever project scanned last"', () => {
    seedSnapshot('snap-b', '2026-08-19T09:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');
    expect(getLatestSnapshot()).toBeNull();
    expect(getSnapshotHistory(10)).toEqual([]);
  });
});

describe('POST /api/telemetry resolve-skills', () => {
  it('refuses without a project rather than injecting another project\'s patterns', async () => {
    seedSnapshot('snap-b', '2026-08-19T09:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');
    const res = await POST(post({ action: 'resolve-skills' }));
    expect(res.status).toBe(400);
    const body = await envelope(res);
    expect(body.success).toBe(false);
    expect(body.error).toContain('projectPath required');
  });

  it('resolves packs from THIS project\'s scan and names the snapshot it used', async () => {
    seedSnapshot('snap-a', '2026-02-18T18:45:03.793Z', PROJECT_A, 'loot-driven');
    seedSnapshot('snap-b', '2026-08-19T09:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');

    const body = await envelope(await POST(post({ action: 'resolve-skills', projectPath: PROJECT_A })));
    expect(body.success).toBe(true);
    expect(body.data?.snapshotId).toBe('snap-a');
    expect(body.data?.projectPath).toBe(PROJECT_A);
    // `loot-driven` triggers diablo-like → loot-itemization; project B's
    // `dodge-roll-heavy` (souls-like → souls-combat) must not leak in.
    expect(body.data?.skills).toContain('loot-itemization');
    expect(body.data?.skills).not.toContain('souls-combat');
  });

  it('a never-scanned project gets an empty resolution that says so — not another project\'s', async () => {
    seedSnapshot('snap-b', '2026-08-19T09:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');
    const body = await envelope(await POST(post({ action: 'resolve-skills', projectPath: PROJECT_A })));
    expect(body.data?.snapshotId).toBeNull();
    expect(body.data?.patternCount).toBe(0);
  });

  it('states plainly that accepted sub-genres are NOT project-scoped', async () => {
    const body = await envelope(await POST(post({ action: 'resolve-skills', projectPath: PROJECT_A })));
    expect((body.data?.subGenreScope as { scoped: boolean }).scoped).toBe(false);
    expect(GENRE_SUGGESTION_SCOPE.note).toContain('every project');
  });
});

describe('GET /api/telemetry forwards the caller\'s project', () => {
  it('stats are scoped by ?projectPath', async () => {
    seedSnapshot('snap-b', '2026-08-19T09:00:00.000Z', PROJECT_B, 'dodge-roll-heavy');
    const url = `http://localhost:3001/api/telemetry?action=stats&projectPath=${encodeURIComponent(PROJECT_A)}`;
    const body = await envelope(await GET(new Request(url)));
    expect(body.data?.totalScans).toBe(0);
    expect((body.data?.scope as { foreignRows: number }).foreignRows).toBe(1);
  });
});
