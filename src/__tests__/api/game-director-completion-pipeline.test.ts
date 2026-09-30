/**
 * Every completion path (simulate, ingest-external, the external writer's
 * `complete`) runs ONE pipeline: matrix routing + regression analysis, each
 * disclosed on the session timeline. Nobody has to remember to click Analyze.
 *
 * Throwaway DB in a unique mkdtemp dir per file (never ~/.pof/pof.db, never a
 * pid-named path), removed afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import type { PlaytestConfig, PlaytestSummary, DirectorEvent } from '@/types/game-director';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-gd-completion-'));
process.env.POF_DB_PATH = path.join(TMP, 'pof.db');

type DbMod = typeof import('@/lib/db');
type GdMod = typeof import('@/lib/game-director-db');
type RtMod = typeof import('@/lib/regression-tracker');
type GdRoute = typeof import('@/app/api/game-director/route');
type RtRoute = typeof import('@/app/api/regression-tracker/route');
let dbm: DbMod;
let gd: GdMod;
let rt: RtMod;
let gdRoute: GdRoute;
let rtRoute: RtRoute;

beforeAll(async () => {
  dbm = await import('@/lib/db');
  gd = await import('@/lib/game-director-db');
  rt = await import('@/lib/regression-tracker');
  gdRoute = await import('@/app/api/game-director/route');
  rtRoute = await import('@/app/api/regression-tracker/route');
});

afterAll(() => {
  try { dbm?.getDb().close(); } catch { /* already closed */ }
  fs.rmSync(TMP, { recursive: true, force: true });
});

const COMBAT: PlaytestConfig = {
  testCategories: ['combat'],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

const RUN = {
  plan: {
    game: 'PoF-Dzin',
    projectPath: 'C:/pof-completion-test',
    ueVersion: '5.7.3',
    iteration: 18,
    totalFeatures: 40,
    passingFeatures: 30,
    verifiedFeatures: 20,
    areas: [{ id: 'dzin-enemy-world-panels', moduleId: 'arpg-enemy-ai', label: 'Enemy AI & World Panels', features: [] }],
  },
  progress: [
    {
      iteration: 18,
      timestamp: '2026-04-01T13:23:07.776Z',
      areaId: 'dzin-enemy-world-panels',
      moduleId: 'arpg-enemy-ai',
      action: 'execute',
      outcome: 'partial',
      summary: 'Panels reviewed.',
      durationMs: 70791,
      featuresChanged: [],
      verification: 'fail',
    },
  ],
};

function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function json<T>(res: Response): Promise<{ success: boolean; data: T; error?: string }> {
  return res.json() as Promise<{ success: boolean; data: T; error?: string }>;
}

const REGRESSION_EVENT = /^Regression analysis\b.*\b(\d+) new\b.*\b(\d+) regressed\b.*\b(\d+) newly fixed\b/;

function regressionEvents(events: DirectorEvent[]) {
  return events.filter(e => e.message.startsWith('Regression analysis'));
}

describe('completion analyzes regressions without a manual step', () => {
  it('case 6: simulate -> tracker lists the session analyzed:true and fingerprints exist', async () => {
    const id = `sim-${crypto.randomUUID()}`;
    gd.createSession(id, 'Sim completion', '/build', COMBAT);

    const res = await gdRoute.POST(post({ action: 'simulate', sessionId: id }));
    expect((await json(res)).success).toBe(true);

    const listRes = await rtRoute.GET(new NextRequest('http://localhost/api/regression-tracker?action=sessions'));
    const list = await json<Array<{ id: string; analyzed: boolean }>>(listRes);
    expect(list.success).toBe(true);
    const row = list.data.find(s => s.id === id);
    expect(row?.analyzed).toBe(true);
    expect(rt.getAllFingerprints().length).toBeGreaterThan(0);
  });

  it('case 7a: the external writer seam `complete` routes AND analyzes, both on the timeline', async () => {
    const created = await json<{ id: string }>(await gdRoute.POST(post({
      action: 'create', name: 'External complete', buildPath: '/b', config: COMBAT, source: 'external',
    })));
    const id = created.data.id;
    await gdRoute.POST(post({
      action: 'add-finding',
      finding: {
        id: `f-${crypto.randomUUID()}`, sessionId: id, category: 'gameplay-feel', severity: 'high',
        title: 'Dodge roll eats input', description: '', relatedModule: 'arpg-combat',
        screenshotRef: null, gameTimestamp: null, suggestedFix: '', confidence: null,
        createdAt: new Date().toISOString(), triageStatus: 'active', triageNote: '',
        snoozedUntil: null, fixDispatchedAt: null,
      },
    }));
    const summary: PlaytestSummary = {
      overallScore: 60, totalScreenshotsAnalyzed: null, systemsTested: ['combat'],
      testCoverage: { combat: null } as PlaytestSummary['testCoverage'],
      topIssue: 'Dodge roll eats input', topPraise: '', playtimeSeconds: null,
    };
    const res = await gdRoute.POST(post({
      action: 'complete', sessionId: id, summary, durationMs: 1000, systemsTestedCount: 1, findingsCount: 1,
    }));
    expect((await json(res)).success).toBe(true);

    const events = gd.getEvents(id);
    const reg = regressionEvents(events);
    expect(reg).toHaveLength(1);
    expect(reg[0].message).toMatch(REGRESSION_EVENT);
    expect(events.some(e => e.message.startsWith('Matrix routing'))).toBe(true);
  });

  it('case 7b: ingest-external carries exactly one regression-analysis event with its counts', async () => {
    const res = await gdRoute.POST(post({ action: 'ingest-external', run: RUN, projectId: 'C:/pof-completion-test' }));
    const body = await json<{ sessionId: string }>(res);
    expect(body.success).toBe(true);

    const reg = regressionEvents(gd.getEvents(body.data.sessionId));
    expect(reg).toHaveLength(1);
    expect(reg[0].message).toMatch(REGRESSION_EVENT);
  });
});
