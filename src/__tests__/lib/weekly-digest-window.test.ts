import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE session_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NOT NULL
    );
  `);
  return { getDb: () => db };
});

import { generateWeeklyDigest } from '@/lib/weekly-digest';
import { getDb } from '@/lib/db';

const ZONE = 'Europe/Prague';
const REF = new Date('2026-09-27T18:00:00.000Z'); // Sun 27 Sep 20:00 Prague

function seed(completedAt: string[]): void {
  const db = getDb();
  db.exec('DELETE FROM session_analytics');
  const ins = db.prepare('INSERT INTO session_analytics (module_id, success, duration_ms, completed_at) VALUES (?, 1, 60000, ?)');
  for (const c of completedAt) ins.run('arpg-combat', c);
}

describe('generateWeeklyDigest — zone-true week (Europe/Prague)', () => {
  beforeEach(() => {
    // 10:00 Prague (CEST, +2) on each of Mon 21 .. Sun 27 = 08:00 UTC,
    // plus Mon 21 00:30 Prague = Sun 20 22:30 UTC.
    const rows = ['21', '22', '23', '24', '25', '26', '27'].map((d) => `2026-09-${d}T08:00:00.000Z`);
    rows.push('2026-09-20T22:30:00.000Z');
    // Outside the week on both sides: Sun 20 23:59 Prague and Mon 28 00:00 Prague.
    rows.push('2026-09-20T21:59:00.000Z', '2026-09-27T22:00:00.000Z');
    seed(rows);
  });

  it('labels the period Monday..next Monday (exclusive) in the declared zone', () => {
    const d = generateWeeklyDigest(REF, ZONE);
    expect(d.periodStart).toBe('2026-09-21');
    expect(d.periodEnd).toBe('2026-09-28');
  });

  it('daily bars sum to the Sessions card', () => {
    const d = generateWeeklyDigest(REF, ZONE);
    expect(d.totalSessions).toBe(8);
    expect(d.dailySessions.reduce((s, x) => s + x.total, 0)).toBe(d.totalSessions);
  });

  it('buckets the 00:30 Monday session on Monday and keeps Sunday', () => {
    const d = generateWeeklyDigest(REF, ZONE);
    expect(d.dailySessions).toHaveLength(7);
    expect(d.dailySessions[0]).toEqual({ date: '2026-09-21', total: 2, success: 2 });
    expect(d.dailySessions[6].date).toBe('2026-09-27');
    expect(d.dailySessions[6].total).toBe(1);
  });

  it('echoes the zone it was cut in', () => {
    expect(generateWeeklyDigest(REF, ZONE).zone).toBe(ZONE);
  });

  it('counts the previous zone-local week for the comparison', () => {
    const d = generateWeeklyDigest(REF, ZONE);
    expect(d.prevWeekSessions).toBe(1); // Sun 20 23:59 Prague
  });
});
