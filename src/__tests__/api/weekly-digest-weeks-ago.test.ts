/**
 * GET /api/weekly-digest?weeksAgo=N reviews any of the last 52 weeks: the route steps
 * `previousWeek()` back from the current zone-local week and cuts the digest there.
 * No query keeps today's behaviour (the current week).
 *
 * Real route handler against the real SQLite schema. Throwaway DB in a per-file
 * mkdtemp dir (deleted in afterAll). Clock fixed at 2026-09-30T12:00Z, zone UTC.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-weekly-digest-'));
process.env.POF_DB_PATH = path.join(DIR, 'pof.db');

vi.mock('@/lib/analytics/report-window', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics/report-window')>();
  return { ...actual, reportZone: () => 'UTC' };
});

const { getDb } = await import('@/lib/db');
const route = await import('@/app/api/weekly-digest/route');

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-30T12:00:00.000Z'));
});

afterAll(() => {
  vi.useRealTimers();
  try { getDb().close(); } catch { /* already closed */ }
  fs.rmSync(DIR, { recursive: true, force: true });
});

async function get(query: string) {
  const res = await route.GET(new NextRequest(`http://localhost/api/weekly-digest${query}`));
  return { status: res.status, body: await res.json() };
}

describe('GET /api/weekly-digest?weeksAgo', () => {
  it('weeksAgo=1 cuts the digest on the previous zone-local week', async () => {
    const { status, body } = await get('?weeksAgo=1');
    expect(status).toBe(200);
    expect(body.data.digest.periodStart).toBe('2026-09-21');
    expect(body.data.digest.periodEnd).toBe('2026-09-28');
  });

  it.each(['-1', 'abc', '1.5', '53'])('weeksAgo=%s -> 400 naming the accepted range 0-52', async (v) => {
    const { status, body } = await get(`?weeksAgo=${v}`);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('0-52');
  });

  it('[guard] no query -> the current week with the same body shape as before', async () => {
    const { status, body } = await get('');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Object.keys(body.data)).toEqual(['digest']);
    expect(body.data.digest.periodStart).toBe('2026-09-28');
    expect(body.data.digest.periodEnd).toBe('2026-10-05');
    expect(body.data.digest.zone).toBe('UTC');
  });
});
