// @vitest-environment node
/**
 * The budget guard (`getBudgetStatus`, called by every CLI pre-flight) sums today's and
 * this month's spend. It must reach `cli_spend` through `idx_cli_spend_recorded`, not a
 * full-table scan: the table only ever grows (one row per run), so a `substr(...) = ?`
 * predicate made every pre-flight O(all history). And it must count EXACTLY the rows a
 * prefix match counts — including legacy space-separated `datetime('now')` stamps.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from 'better-sqlite3';

vi.mock('@/lib/db', async () => {
  const { default: Db } = await import('better-sqlite3');
  const db = new Db(':memory:');
  return { getDb: () => db };
});

import { ensureCliSpendTables, getBudgetStatus } from '@/lib/cli-spend-db';
import { getDb } from '@/lib/db';

const NOW = new Date('2026-11-08T12:00:00.000Z');

function insertAt(recordedAt: string, cost: number) {
  getDb().prepare('INSERT INTO cli_spend (cost_usd, recorded_at) VALUES (?, ?)').run(cost, recordedAt);
}

/** Capture every SQL text getBudgetStatus prepares that sums cost. */
function captureSumSql(): string[] {
  const db = getDb() as Database.Database;
  const seen: string[] = [];
  const spy = vi.spyOn(db, 'prepare').mockImplementation(function (this: Database.Database, sql: string) {
    if (/SUM\(cost_usd\)/i.test(sql)) seen.push(sql);
    return Object.getPrototypeOf(db).prepare.call(db, sql);
  } as Database.Database['prepare']);
  getBudgetStatus();
  spy.mockRestore();
  return seen;
}

describe('cli-spend budget guard reads through the recorded_at index', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    ensureCliSpendTables();
    getDb().exec('DELETE FROM cli_spend; DELETE FROM cli_spend_budget;');
  });

  it('every period sum is an index SEARCH, never a SCAN of cli_spend', () => {
    const sqls = captureSumSql();
    expect(sqls.length).toBe(2); // today + this month
    for (const sql of sqls) {
      const params = (sql.match(/\?/g) ?? []).map(() => 'x');
      const plan = (getDb().prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[])
        .map((r) => r.detail)
        .join(' | ');
      expect(plan).toContain('USING INDEX idx_cli_spend_recorded');
      expect(plan).not.toMatch(/SCAN cli_spend(?! USING)/);
    }
    vi.useRealTimers();
  });

  it('counts exactly the rows of the current UTC day / month, legacy stamps included', () => {
    insertAt('2026-11-08T00:00:00.000Z', 1); // today, first instant
    insertAt('2026-11-08 23:59:59', 2); // today, legacy datetime('now') spelling
    insertAt('2026-11-07T23:59:59.999Z', 4); // yesterday, same month
    insertAt('2026-11-09T00:00:00.000Z', 8); // tomorrow, same month
    insertAt('2026-10-31T23:59:59.999Z', 16); // last month
    insertAt('2026-12-01T00:00:00.000Z', 32); // next month
    insertAt('2026-11', 64); // bare month key: in the month, not in the day

    const s = getBudgetStatus();
    expect(s.todaySpendUsd).toBe(1 + 2);
    expect(s.monthSpendUsd).toBe(1 + 2 + 4 + 8 + 64);
    vi.useRealTimers();
  });
});
