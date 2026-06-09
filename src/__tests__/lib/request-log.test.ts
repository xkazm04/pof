import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  checkIdempotencyKey,
  saveIdempotencyResult,
  purgeExpiredKeys,
  tickPurgeExpiredKeys,
} from '@/lib/request-log';

// Mirror of the request_log schema in db.ts (created_at defaults to now).
function createSchema(): void {
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS request_log (
      idempotency_key TEXT PRIMARY KEY,
      route TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/** Insert a row with an explicit age (seconds in the past). */
function insertAged(key: string, ageSeconds: number): void {
  testDb.prepare(
    `INSERT OR REPLACE INTO request_log (idempotency_key, route, status_code, response_body, created_at)
     VALUES (?, ?, ?, ?, datetime('now', '-' || ? || ' seconds'))`
  ).run(key, '/api/test', 200, JSON.stringify({ ok: true }), ageSeconds);
}

function rowCount(): number {
  return (testDb.prepare('SELECT COUNT(*) AS n FROM request_log').get() as { n: number }).n;
}

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS request_log');
  createSchema();
});

describe('request-log idempotency', () => {
  it('saves and reads back a cached response within the TTL window', () => {
    saveIdempotencyResult('key-1', '/api/test', 201, { id: 7 });
    const cached = checkIdempotencyKey('key-1');
    expect(cached).toEqual({ statusCode: 201, responseBody: JSON.stringify({ id: 7 }) });
  });

  it('returns null for an unknown key', () => {
    expect(checkIdempotencyKey('missing')).toBeNull();
  });

  it('ignores entries older than the TTL on read', () => {
    insertAged('stale', 3601); // 1s past the 1h TTL
    expect(checkIdempotencyKey('stale')).toBeNull();
  });
});

describe('purgeExpiredKeys', () => {
  it('deletes expired rows and keeps fresh ones', () => {
    insertAged('fresh', 60);
    insertAged('stale-a', 3601);
    insertAged('stale-b', 7200);
    expect(rowCount()).toBe(3);

    const deleted = purgeExpiredKeys();
    expect(deleted).toBe(2);
    expect(rowCount()).toBe(1);
    expect(checkIdempotencyKey('fresh')).not.toBeNull();
  });

  it('returns 0 when there is nothing to purge', () => {
    insertAged('fresh', 10);
    expect(purgeExpiredKeys()).toBe(0);
    expect(rowCount()).toBe(1);
  });
});

describe('tickPurgeExpiredKeys throttling', () => {
  const HOUR_MS = 3600 * 1000;

  it('purges on the first call, then throttles until a full TTL window has elapsed', () => {
    // Seed three expired rows for the first purge to remove.
    insertAged('a', 3601);
    insertAged('b', 3601);
    insertAged('c', 3601);

    const t0 = 1_000_000_000_000; // arbitrary fixed epoch (avoids Date.now())

    // First call always purges.
    expect(tickPurgeExpiredKeys(t0)).toBe(3);
    expect(rowCount()).toBe(0);

    // A new expired row appears, but a tick well inside the window is a no-op.
    insertAged('d', 3601);
    expect(tickPurgeExpiredKeys(t0 + 60_000)).toBe(0);
    expect(rowCount()).toBe(1);

    // Just before a full window — still throttled.
    expect(tickPurgeExpiredKeys(t0 + HOUR_MS - 1)).toBe(0);
    expect(rowCount()).toBe(1);

    // A full TTL window later — purges again.
    expect(tickPurgeExpiredKeys(t0 + HOUR_MS)).toBe(1);
    expect(rowCount()).toBe(0);
  });
});
