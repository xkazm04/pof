/**
 * GET /api/feature-matrix/history?moduleId=… returns the per-feature DELTA of the
 * newest snapshot pair — which features the last review/fix moved — beside the
 * unchanged count snapshots.
 *
 * The DB is built BEFORE the app opens it, the way a field DB looks today:
 * stamped `user_version = 5`, holding the current `review_snapshots` table WITHOUT
 * the `feature_states` column and one snapshot written before it existed. Opening
 * it must add the column (SCHEMA_VERSION 6, additive only — the old row survives
 * untouched with NULL states), and a pair whose predecessor predates the column is
 * reported `measured: false` with a reason — never as an empty "nothing changed".
 *
 * Throwaway DB in a per-file mkdtemp dir — never ~/.pof/pof.db.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const P_RAW = vi.hoisted(() => 'C:\\P\\PoF');

vi.hoisted(() => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const fs = require('fs') as typeof import('fs');
  const os = require('os') as typeof import('os');
  const path = require('path') as typeof import('path');
  const Sqlite = require('better-sqlite3') as typeof import('better-sqlite3');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-test-fm-history-delta-'));
  const dbPath = path.join(dir, 'pof.db');
  const raw = new Sqlite(dbPath);
  // review_snapshots EXACTLY as it ships at schema version 5 (no feature_states).
  raw.exec(`
    CREATE TABLE review_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      implemented INTEGER NOT NULL DEFAULT 0,
      improved INTEGER NOT NULL DEFAULT 0,
      partial INTEGER NOT NULL DEFAULT 0,
      missing INTEGER NOT NULL DEFAULT 0,
      unknown INTEGER NOT NULL DEFAULT 0,
      avg_quality REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      project_id TEXT NOT NULL DEFAULT ''
    )`);
  // One pre-column snapshot for arpg-loot under the project (normalized id).
  raw.prepare(
    `INSERT INTO review_snapshots (module_id, reviewed_at, total, implemented, partial, avg_quality, project_id)
     VALUES ('arpg-loot', '2026-08-01T00:00:00.000Z', 1, 0, 1, 3, 'c:/p/pof')`,
  ).run();
  raw.pragma('user_version = 5');
  raw.close();
  process.env.POF_DB_PATH = dbPath;
});

import { GET } from '@/app/api/feature-matrix/history/route';
import { upsertFeatures, normalizeProjectId, type UpsertFeature } from '@/lib/feature-matrix-db';
import { getDb } from '@/lib/db';
import type { ReviewDelta } from '@/lib/feature-review-delta';
import type { FeatureStatus } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

const P = normalizeProjectId(P_RAW);

const row = (featureName: string, status: FeatureStatus, qualityScore: number, lastReviewedAt: string): UpsertFeature => ({
  featureName,
  category: 'Abilities',
  status,
  description: `${featureName} — ${status}`,
  filePaths: [],
  reviewNotes: '',
  qualityScore,
  lastReviewedAt,
});

interface HistoryData {
  snapshots: Record<string, unknown>[];
  projectId: string;
  delta?: ReviewDelta;
}

async function history(moduleId: string): Promise<HistoryData> {
  const res = await GET(
    new NextRequest(`http://localhost/api/feature-matrix/history?moduleId=${moduleId}&projectId=${encodeURIComponent(P_RAW)}`),
  );
  expect(res.status).toBe(200);
  const json = (await res.json()) as { success: boolean; data: HistoryData };
  expect(json.success).toBe(true);
  return json.data;
}

describe('schema 6: review_snapshots.feature_states on a user_version 5 DB', () => {
  it('opening the v5 DB adds the column and keeps the pre-column row untouched (NULL states)', () => {
    const db = getDb();
    const cols = (db.prepare('PRAGMA table_info(review_snapshots)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain('feature_states');
    expect(db.pragma('user_version', { simple: true })).toBe(6);
    const old = db.prepare("SELECT total, partial, avg_quality, feature_states FROM review_snapshots WHERE module_id = 'arpg-loot'").all();
    expect(old).toEqual([{ total: 1, partial: 1, avg_quality: 3, feature_states: null }]);
  });

  it('a capture after the upgrade succeeds, and the pre-column predecessor yields measured:false with a reason', async () => {
    expect(() =>
      upsertFeatures('arpg-loot' as SubModuleId, [row('Loot table', 'implemented', 4, '2026-09-03T00:00:00.000Z')], {
        source: 'review', projectId: P_RAW,
      }),
    ).not.toThrow();
    const data = await history('arpg-loot');
    expect(data.snapshots).toHaveLength(2);
    expect(data.delta).toBeDefined();
    expect(data.delta!.measured).toBe(false);
    expect(data.delta).not.toHaveProperty('regressed');
    if (data.delta!.measured) return;
    expect(typeof data.delta!.reason).toBe('string');
    expect(data.delta!.reason.length).toBeGreaterThan(0);
  });
});

describe('per-feature delta of the newest snapshot pair', () => {
  it('a review that drops Dodge roll implemented -> partial reports exactly that regression', async () => {
    const m = 'arpg-combat' as SubModuleId;
    upsertFeatures(m, [row('Dodge roll', 'implemented', 4, '2026-09-01T00:00:00.000Z')], { source: 'review', projectId: P });
    upsertFeatures(m, [row('Dodge roll', 'partial', 3, '2026-09-02T00:00:00.000Z')], { source: 'review', projectId: P });

    const data = await history('arpg-combat');
    expect(data.projectId).toBe(P);
    expect(data.delta).toMatchObject({
      measured: true,
      fromReviewedAt: '2026-09-01T00:00:00.000Z',
      toReviewedAt: '2026-09-02T00:00:00.000Z',
      regressed: [{ featureName: 'Dodge roll', from: 'implemented', to: 'partial' }],
      improved: [],
      qualityDropped: [{ featureName: 'Dodge roll', from: 4, to: 3 }],
    });

    // [guard] the snapshots keep exactly the count fields and values.
    expect(data.snapshots.map((s) => Object.keys(s).sort())).toEqual([
      ['avgQuality', 'id', 'implemented', 'improved', 'missing', 'moduleId', 'partial', 'reviewedAt', 'total', 'unknown'],
      ['avgQuality', 'id', 'implemented', 'improved', 'missing', 'moduleId', 'partial', 'reviewedAt', 'total', 'unknown'],
    ]);
    expect(data.snapshots.map((snap) => { const rest = { ...snap }; delete rest.id; return rest; })).toEqual([
      { moduleId: 'arpg-combat', reviewedAt: '2026-09-01T00:00:00.000Z', total: 1, implemented: 1, improved: 0, partial: 0, missing: 0, unknown: 0, avgQuality: 4 },
      { moduleId: 'arpg-combat', reviewedAt: '2026-09-02T00:00:00.000Z', total: 1, implemented: 0, improved: 0, partial: 1, missing: 0, unknown: 0, avgQuality: 3 },
    ]);
  });

  it('a polluted DB (own row + legacy twin) snapshots the feature ONCE, the own row winning', async () => {
    const m = 'arpg-character' as SubModuleId;
    const insert = getDb().prepare(
      `INSERT INTO feature_matrix (module_id, feature_name, category, status, quality_score, last_reviewed_at, source, project_id)
       VALUES (?, ?, 'Movement', ?, ?, ?, 'review', ?)`,
    );
    insert.run(m, 'Sprint', 'implemented', 4, '2026-09-01T00:00:00.000Z', P);
    insert.run(m, 'Sprint', 'partial', 2, '2026-08-01T00:00:00.000Z', '');

    upsertFeatures(m, [row('Sprint', 'missing', 2, '2026-09-05T00:00:00.000Z')], { source: 'review', projectId: P });

    const data = await history('arpg-character');
    const latest = data.snapshots[data.snapshots.length - 1];
    expect(latest).toMatchObject({ total: 1, missing: 1, partial: 0, implemented: 0 });
    const states = getDb()
      .prepare("SELECT feature_states FROM review_snapshots WHERE module_id = 'arpg-character' ORDER BY id DESC LIMIT 1")
      .get() as { feature_states: string };
    expect(JSON.parse(states.feature_states)).toEqual([
      { featureName: 'Sprint', status: 'missing', quality: 2, source: 'review' },
    ]);
  });
});
