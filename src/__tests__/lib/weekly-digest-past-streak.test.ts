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

const ZONE = 'UTC';
const W = new Date('2026-09-23T12:00:00.000Z'); // week Mon 21 .. Mon 28 Sep

function seed(rows: [string, number][]): void {
  const db = getDb();
  db.exec('DELETE FROM session_analytics');
  const ins = db.prepare('INSERT INTO session_analytics (module_id, success, duration_ms, completed_at) VALUES (?, ?, 60000, ?)');
  for (const [at, ok] of rows) ins.run('arpg-combat', ok, at);
}

describe('generateWeeklyDigest — streaks belong to the viewed week', () => {
  beforeEach(() => {
    const rows: [string, number][] = [];
    // Before W: 3 successes then a failure.
    for (const d of ['01', '02', '03']) rows.push([`2026-09-${d}T10:00:00.000Z`, 1]);
    rows.push(['2026-09-04T10:00:00.000Z', 0]);
    // In W: one success.
    rows.push(['2026-09-22T10:00:00.000Z', 1]);
    // After W: 12 consecutive successes (would be "Unstoppable" if leaked).
    for (let i = 1; i <= 12; i++) rows.push([`2026-10-${String(i).padStart(2, '0')}T10:00:00.000Z`, 1]);
    seed(rows);
  });

  it('a past week reports the streak as of its end, not today', () => {
    const d = generateWeeklyDigest(W, ZONE);
    expect(d.currentStreak).toBe(1);
    expect(d.longestStreak).toBe(3);
  });

  it('a past week earns no streak achievement from later sessions', () => {
    const d = generateWeeklyDigest(W, ZONE);
    expect(d.achievements.some((a) => a.id.startsWith('streak-'))).toBe(false);
  });

  it('the current week still sees the live streak', () => {
    const d = generateWeeklyDigest(new Date('2026-10-12T12:00:00.000Z'), ZONE);
    expect(d.currentStreak).toBe(13);
    expect(d.achievements.some((a) => a.id === 'streak-10')).toBe(true);
  });

  it('a streak longer than 200 is not truncated', () => {
    const rows: [string, number][] = [];
    for (let i = 0; i < 250; i++) rows.push([new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), 1]);
    seed(rows);
    const d = generateWeeklyDigest(new Date('2026-01-02T00:00:00.000Z'), ZONE);
    expect(d.currentStreak).toBe(250);
  });
});
