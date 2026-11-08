/**
 * POST /api/game-director action=complete must reject a summary whose
 * overallScore is not a finite 0-100 number, at write time, leaving the row
 * untouched (reads already ignore such sessions; the write used to accept them).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PlaytestConfig } from '@/types/game-director';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-gd-complete-validate-'));
process.env.POF_DB_PATH = path.join(TMP, 'pof.db');

type DbMod = typeof import('@/lib/db');
type GdMod = typeof import('@/lib/game-director-db');
type GdRoute = typeof import('@/app/api/game-director/route');
let dbm: DbMod;
let gd: GdMod;
let route: GdRoute;

beforeAll(async () => {
  dbm = await import('@/lib/db');
  gd = await import('@/lib/game-director-db');
  route = await import('@/app/api/game-director/route');
});

afterAll(() => {
  try { dbm?.getDb().close(); } catch { /* already closed */ }
  fs.rmSync(TMP, { recursive: true, force: true });
});

const CONFIG: PlaytestConfig = {
  testCategories: ['combat'],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function complete(id: string, summary: unknown) {
  const res = await route.POST(post({
    action: 'complete', sessionId: id, summary, durationMs: 1000, systemsTestedCount: 1, findingsCount: 0,
  }));
  return { status: res.status, body: (await res.json()) as { success: boolean; error?: string } };
}

describe('complete action validates summary.overallScore', () => {
  it.each([
    ['empty summary', {}],
    ['string score', { overallScore: 'x' }],
    ['out of range', { overallScore: 140 }],
  ])('rejects %s with 400 naming the field and leaves the row unchanged', async (_label, summary) => {
    const id = `gd-cv-${Math.random().toString(36).slice(2)}`;
    gd.createSession(id, 'Validate', '/build', CONFIG);
    const r = await complete(id, summary);
    expect(r.status).toBe(400);
    expect(r.body.success).toBe(false);
    expect(r.body.error).toMatch(/summary\.overallScore/);
    expect(gd.getSession(id)?.status).not.toBe('complete');
  });

  it('accepts a finite 0-100 score', async () => {
    const id = `gd-cv-ok-${Math.random().toString(36).slice(2)}`;
    gd.createSession(id, 'Validate ok', '/build', CONFIG);
    const r = await complete(id, {
      overallScore: 60, totalScreenshotsAnalyzed: null, systemsTested: ['combat'],
      findingsBySeverity: {}, findingsByCategory: {}, topIssues: [], coverageGaps: [], recommendations: [],
    });
    expect(r.status).toBe(200);
    expect(gd.getSession(id)?.status).toBe('complete');
  });
});
