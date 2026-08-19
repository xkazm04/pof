/**
 * Review-snapshot history — the data behind the per-module quality sparkline.
 *
 * All RED before this change:
 *   • `getReviewHistory` was `ORDER BY reviewed_at ASC LIMIT ?` — the OLDEST N — so
 *     past 20 reviews the sparkline froze on ancient history forever, while its
 *     sibling `getAllReviewHistory` (ROW_NUMBER … DESC) showed the current window.
 *   • Snapshots were captured off the INPUT array, so a seed-only batch that wrote
 *     nothing still recorded a "review".
 *   • The timestamp is `MAX(last_reviewed_at)`, so re-importing a report appended a
 *     duplicate point at an identical instant — a flat stretch that never happened.
 *   • Retention was unbounded.
 *   • `improved` existed only as an ALTER migration; a fresh DB created after a
 *     SCHEMA_VERSION bump (which skips the migration probes) would lack the column
 *     `captureReviewSnapshot` inserts into.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-fm-history-${process.pid}.db`;
});

import {
  getReviewHistory,
  getAllReviewHistory,
  clearModuleFeatures,
  upsertFeatures,
  MAX_SNAPSHOTS_PER_MODULE,
} from '@/lib/feature-matrix-db';
import { getDb } from '@/lib/db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;
const declared = MODULE_FEATURE_DEFINITIONS[MODULE]!;
const FEATURE = declared[0].featureName;

const day = (n: number) => `2026-${String(Math.floor(n / 28) + 1).padStart(2, '0')}-${String((n % 28) + 1).padStart(2, '0')}T00:00:00.000Z`;

function snapshotCount(): number {
  return (
    getDb().prepare('SELECT COUNT(*) as c FROM review_snapshots WHERE module_id = ?').get(MODULE) as {
      c: number;
    }
  ).c;
}

/** Write one real review at `reviewedAt`, which is what stamps the snapshot. */
function review(reviewedAt: string, status: 'implemented' | 'partial' = 'implemented') {
  upsertFeatures(
    MODULE,
    [{
      featureName: FEATURE,
      category: 'Core',
      status,
      description: '',
      filePaths: [],
      reviewNotes: '',
      qualityScore: 4,
      nextSteps: '',
      lastReviewedAt: reviewedAt,
    }],
    { source: 'review' },
  );
}

beforeEach(() => {
  clearModuleFeatures(MODULE);
  getDb().prepare('DELETE FROM review_snapshots WHERE module_id = ?').run(MODULE);
});

describe('the review_snapshots schema is complete on a fresh DB', () => {
  it('declares `improved` in CREATE TABLE, not only in a migration probe', () => {
    const cols = (getDb().prepare('PRAGMA table_info(review_snapshots)').all() as { name: string }[])
      .map((c) => c.name);
    expect(cols).toContain('improved');

    // The freshly-created table must accept exactly what captureReviewSnapshot inserts.
    review(day(0));
    expect(getReviewHistory(MODULE)).toHaveLength(1);
  });
});

describe('getReviewHistory returns the RECENT window', () => {
  beforeEach(() => {
    // 25 distinct review instants; the sparkline may only plot 20 of them.
    for (let i = 0; i < 25; i++) review(day(i));
  });

  it('returns the newest 20 of 25 snapshots, not the oldest 20', () => {
    const history = getReviewHistory(MODULE, 20);
    expect(history).toHaveLength(20);

    const stamps = history.map((s) => s.reviewedAt);
    // The recent window is days 5..24 — day(0)..day(4) are the ones dropped.
    expect(stamps).toContain(day(24));
    expect(stamps).toContain(day(5));
    expect(stamps).not.toContain(day(0));
    expect(stamps).not.toContain(day(4));
  });

  it('returns that window oldest-first, so the sparkline plots left-to-right in time', () => {
    const stamps = getReviewHistory(MODULE, 20).map((s) => Date.parse(s.reviewedAt));
    const ascending = [...stamps].sort((a, b) => a - b);
    expect(stamps).toEqual(ascending);
  });

  it('agrees with its getAllReviewHistory sibling on the same table', () => {
    const mine = getReviewHistory(MODULE, 20).map((s) => s.reviewedAt);
    const all = (getAllReviewHistory(20)[MODULE] ?? []).map((s) => s.reviewedAt);
    expect(mine).toEqual(all);
  });
});

describe('a snapshot is written only for a real review event', () => {
  it('writes no snapshot for a seed-only batch that changed nothing', () => {
    review(day(0));
    const before = snapshotCount();

    // seedOnly is `DO NOTHING` on every row that already exists — so this batch
    // writes ZERO rows even though it carries real verdicts. The old capture read
    // the INPUT array, saw verdicts, and recorded a "review" that touched nothing.
    upsertFeatures(
      MODULE,
      [{
        featureName: FEATURE,
        category: 'Core',
        status: 'implemented',
        description: '',
        filePaths: [],
        reviewNotes: '',
        qualityScore: 5,
        lastReviewedAt: day(9),
      }],
      { seedOnly: true, source: 'seed' },
    );

    expect(snapshotCount()).toBe(before);
  });

  it('writes no snapshot for a seed of unscored placeholders either', () => {
    clearModuleFeatures(MODULE);
    upsertFeatures(
      MODULE,
      declared.map((d) => ({
        featureName: d.featureName,
        category: d.category,
        status: 'unknown' as const,
        description: d.description,
        filePaths: [],
        reviewNotes: '',
      })),
      { seedOnly: true, source: 'seed' },
    );

    expect(snapshotCount()).toBe(0);
  });

  it('writes no duplicate point when the same report is imported twice', () => {
    review(day(3));
    expect(snapshotCount()).toBe(1);

    review(day(3)); // identical reviewedAt — a re-import, not a new review
    expect(snapshotCount()).toBe(1);
  });

  it('updates the existing point in place when a re-import at the same instant changed the counts', () => {
    review(day(3), 'partial');
    expect(getReviewHistory(MODULE)[0].partial).toBe(1);

    review(day(3), 'implemented');
    const history = getReviewHistory(MODULE);
    expect(history).toHaveLength(1);
    expect(history[0].reviewedAt).toBe(day(3));
    expect(history[0].implemented).toBe(1);
    expect(history[0].partial).toBe(0);
  });

  it('still records a genuinely new review instant as a new point', () => {
    review(day(3));
    review(day(4));
    expect(snapshotCount()).toBe(2);
  });
});

describe('retention is bounded and never empties a module', () => {
  it(`keeps at most ${MAX_SNAPSHOTS_PER_MODULE} snapshots per module, dropping the oldest`, () => {
    const total = MAX_SNAPSHOTS_PER_MODULE + 15;
    for (let i = 0; i < total; i++) review(day(i));

    expect(snapshotCount()).toBe(MAX_SNAPSHOTS_PER_MODULE);

    const oldest = getDb()
      .prepare('SELECT MIN(reviewed_at) as m FROM review_snapshots WHERE module_id = ?')
      .get(MODULE) as { m: string };
    expect(oldest.m).toBe(day(total - MAX_SNAPSHOTS_PER_MODULE));
  });

  it('never prunes a module down to zero — a single snapshot survives', () => {
    review(day(0));
    expect(snapshotCount()).toBe(1);
    // Pruning is module-scoped, so activity elsewhere cannot take this one point.
    const other = 'arpg-loot' as SubModuleId;
    const otherFeature = MODULE_FEATURE_DEFINITIONS[other]![0].featureName;
    for (let i = 0; i < MAX_SNAPSHOTS_PER_MODULE + 5; i++) {
      upsertFeatures(
        other,
        [{
          featureName: otherFeature, category: 'Core', status: 'implemented',
          description: '', filePaths: [], reviewNotes: '', qualityScore: 3,
          lastReviewedAt: day(i),
        }],
        { source: 'review' },
      );
    }
    expect(snapshotCount()).toBe(1);
  });
});
