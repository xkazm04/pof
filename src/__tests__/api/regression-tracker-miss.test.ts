/**
 * POST /api/regression-tracker dismiss / resolve: a success reply means a row changed.
 * Throwaway DB in a unique mkdtemp dir (never ~/.pof/pof.db), removed afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-regression-miss-'));
process.env.POF_DB_PATH = path.join(TMP, 'pof.db');

type DbMod = typeof import('@/lib/db');
type RouteMod = typeof import('@/app/api/regression-tracker/route');
let dbm: DbMod;
let route: RouteMod;

beforeAll(async () => {
  dbm = await import('@/lib/db');
  const rt = await import('@/lib/regression-tracker');
  route = await import('@/app/api/regression-tracker/route');
  rt.getAllFingerprints(); // creates the tables
  const db = dbm.getDb();
  db.prepare(
    "INSERT INTO regression_alerts (id, fingerprint_id, fixed_in_session_id, reappeared_in_session_id, category, severity, title) VALUES ('a1','fp1','s1','s2','combat','high','t')",
  ).run();
  db.prepare(
    "INSERT INTO regression_fingerprints (id, hash, category, title_stem, first_seen_session_id) VALUES ('fp1','h1','combat','t','s1')",
  ).run();
});

afterAll(() => {
  try { dbm?.getDb().close(); } catch { /* already closed */ }
  fs.rmSync(TMP, { recursive: true, force: true });
});

function post(body: unknown) {
  return route.POST(new NextRequest('http://localhost/api/regression-tracker', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  }));
}

describe('regression-tracker dismiss / resolve on a miss', () => {
  it('dismiss of an unknown alert id answers 404, not dismissed: true', async () => {
    const res = await post({ action: 'dismiss', alertId: 'nope' });
    expect(res.status).toBe(404);
  });

  it('resolve of an unknown fingerprint id answers 404, not resolved: true', async () => {
    const res = await post({ action: 'resolve', fingerprintId: 'nope' });
    expect(res.status).toBe(404);
  });

  it('dismiss of a known alert answers 200 and the row changed', async () => {
    const res = await post({ action: 'dismiss', alertId: 'a1' });
    expect(res.status).toBe(200);
    expect(dbm.getDb().prepare("SELECT dismissed FROM regression_alerts WHERE id='a1'").get()).toEqual({ dismissed: 1 });
  });

  it('resolve of a known fingerprint answers 200 and the row changed', async () => {
    const res = await post({ action: 'resolve', fingerprintId: 'fp1' });
    expect(res.status).toBe(200);
    expect(dbm.getDb().prepare("SELECT status FROM regression_fingerprints WHERE id='fp1'").get()).toEqual({ status: 'resolved' });
  });
});
