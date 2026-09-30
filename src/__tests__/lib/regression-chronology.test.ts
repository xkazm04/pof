/**
 * Regression state ages in SESSION time, not click order.
 *
 * What this suite proves (and no more): no analysis order can mark 'fixed' a
 * fingerprint the newest analyzed session contains, and a session older than
 * the newest analyzed one only backfills occurrences. It does NOT claim status
 * is order-independent — S1{X} S2{} S3{X} analyzed S1,S3,S2 ends 'open' while
 * the chronological order ends 'regressed' (cases 1 and 2).
 *
 * Throwaway DB in a unique mkdtemp dir per file (never ~/.pof/pof.db, never a
 * pid-named path that a reused Windows PID can collide with), removed afterAll.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PlaytestConfig, PlaytestFinding, PlaytestSummary } from '@/types/game-director';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-regression-chronology-'));
process.env.POF_DB_PATH = path.join(TMP, 'pof.db');

type DbMod = typeof import('@/lib/db');
type GdMod = typeof import('@/lib/game-director-db');
type RtMod = typeof import('@/lib/regression-tracker');
let dbm: DbMod;
let gd: GdMod;
let rt: RtMod;

beforeAll(async () => {
  dbm = await import('@/lib/db');
  gd = await import('@/lib/game-director-db');
  rt = await import('@/lib/regression-tracker');
  // Touch both lazily-created schemas so reset() has tables to clear.
  gd.listSessions(1);
  rt.getAllFingerprints();
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

const SUMMARY: PlaytestSummary = {
  overallScore: 70,
  totalScreenshotsAnalyzed: null,
  systemsTested: ['combat'],
  testCoverage: { combat: null } as PlaytestSummary['testCoverage'],
  topIssue: '',
  topPraise: '',
  playtimeSeconds: null,
};

function findingX(sessionId: string, createdAt: string): PlaytestFinding {
  return {
    id: `f-${sessionId}`,
    sessionId,
    category: 'gameplay-feel',
    severity: 'high',
    title: 'Combo window sluggish',
    description: '',
    relatedModule: 'arpg-combat',
    screenshotRef: null,
    gameTimestamp: null,
    suggestedFix: '',
    confidence: null,
    createdAt,
    triageStatus: 'active',
    triageNote: '',
    snoozedUntil: null,
    fixDispatchedAt: null,
  };
}

/** A completed combat session stamped at an explicit created_at. */
function mk(id: string, createdAt: string, withX: boolean) {
  gd.createSession(id, id, '/build', COMBAT);
  gd.updateSessionSummary(id, SUMMARY, 1000, 1, withX ? 1 : 0, 'simulated');
  dbm.getDb().prepare('UPDATE game_director_sessions SET created_at = ? WHERE id = ?').run(createdAt, id);
  if (withX) gd.addFinding(findingX(id, createdAt));
}

function analyze(id: string) {
  return rt.processSession(gd.getSession(id)!);
}

function seedThree() {
  mk('S1', '2026-09-01 10:00:00', true);
  mk('S2', '2026-09-02 10:00:00', false);
  mk('S3', '2026-09-03 10:00:00', true);
}

function xStatus(): string[] {
  return rt.getAllFingerprints().map(f => f.status);
}

function reset() {
  const db = dbm.getDb();
  for (const t of [
    'regression_alerts', 'regression_occurrences', 'regression_fingerprints',
    'game_director_findings', 'game_director_events', 'game_director_sessions',
  ]) {
    db.exec(`DELETE FROM ${t}`);
  }
}

beforeEach(() => reset());

describe('status transitions come only from the newest analyzed session', () => {
  it('case 1: S1{X} S2{} S3{X} analyzed S1,S3,S2 -> X open (never fixed); S2 backfills with no newly-fixed', () => {
    seedThree();
    analyze('S1');
    analyze('S3');
    const r2 = analyze('S2');

    expect(xStatus()).toEqual(['open']);
    expect(r2.mode).toBe('backfill');
    expect(r2.newlyFixed).toEqual([]);
    expect(rt.getActiveAlerts()).toHaveLength(0);
  });

  it('case 1 (claim): no permutation of analysis order marks X fixed while the newest session contains it', () => {
    const orders = [
      ['S1', 'S2', 'S3'], ['S1', 'S3', 'S2'], ['S2', 'S1', 'S3'],
      ['S2', 'S3', 'S1'], ['S3', 'S1', 'S2'], ['S3', 'S2', 'S1'],
    ];
    for (const order of orders) {
      reset();
      seedThree();
      for (const id of order) analyze(id);
      expect({ order, status: xStatus() }).not.toEqual({ order, status: ['fixed'] });
      expect(xStatus()).toHaveLength(1);
    }
  });

  it('case 2 [guard]: chronological S1,S2,S3 -> X regressed with exactly one alert S1 -> S3', () => {
    seedThree();
    analyze('S1');
    analyze('S2');
    analyze('S3');

    expect(xStatus()).toEqual(['regressed']);
    const alerts = rt.getActiveAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].fixedInSessionId).toBe('S1');
    expect(alerts[0].reappearedInSessionId).toBe('S3');
  });

  it('case 3: re-analyzing S2 after the chronological pass keeps X regressed and reports backfill', () => {
    seedThree();
    analyze('S1');
    analyze('S2');
    analyze('S3');
    const again = analyze('S2');

    expect(again.mode).toBe('backfill');
    expect(again.newlyFixed).toEqual([]);
    expect(xStatus()).toEqual(['regressed']);
    expect(rt.getActiveAlerts()).toHaveLength(1);
  });
});

describe('one chronology: (created_at, rowid)', () => {
  it('case 4: same-second sessions order by insertion; the later-inserted one is newer (20 repetitions)', () => {
    const T = '2026-09-10 12:00:00';
    for (let i = 0; i < 20; i++) {
      const a = `tie-${i}-a`;
      const b = `tie-${i}-b`;
      mk(a, T, true);
      mk(b, T, false);

      const ids = gd.sessionChronology().map(s => s.id);
      expect(ids.indexOf(a)).toBeLessThan(ids.indexOf(b));
      expect(ids[ids.length - 1]).toBe(b);

      // Analyze the later-inserted one first: the earlier one can only backfill.
      expect(analyze(b).mode).toBe('forward');
      expect(analyze(a).mode).toBe('backfill');
    }
  });

  it('case 5: 35 completed sessions -> getHealthTrend(30) is the NEWEST 30, oldest -> newest', () => {
    for (let n = 1; n <= 35; n++) {
      mk(`T${n}`, `2026-07-01 10:${String(n).padStart(2, '0')}:00`, false);
    }
    const trend = gd.getHealthTrend(30);
    expect(trend.map(p => p.sessionId)).toEqual(
      Array.from({ length: 30 }, (_, i) => `T${i + 6}`),
    );
  });
});
