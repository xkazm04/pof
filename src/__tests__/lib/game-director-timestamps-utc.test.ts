/**
 * Game Director timestamps leave the DB module zone-explicit.
 *
 * `created_at`, `completed_at` (summary path), `fix_dispatched_at` and
 * `regression_analyzed_at` are written by SQLite's `datetime('now')` — UTC with no
 * zone marker ("2026-11-08 10:00:00"). The UI renders them with
 * `new Date(createdAt)`, which reads that spelling as LOCAL time, so every session
 * date, the "Fix dispatched" tooltip and the health-trend forecast's elapsed time
 * were off by the viewer's UTC offset. Other columns of the same rows
 * (`started_at`, `repro_last_attempted_at`) were already ISO-8601 `Z`.
 *
 * Throwaway DB (POF_DB_PATH is set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-timestamps-${process.pid}.db`;
});

import {
  createSession, getSession, listSessions, addFinding, getFindings,
  markFindingFixDispatched, updateSessionSummary, getHealthTrend,
  sessionChronology, markRegressionAnalyzed,
} from '@/lib/game-director-db';
import type { PlaytestConfig, PlaytestFinding, PlaytestSummary } from '@/types/game-director';

const config: PlaytestConfig = {
  testCategories: ['combat'], maxPlaytimeMinutes: 5, screenshotIntervalSeconds: 10,
  aggressiveMode: false, prioritySystems: [],
};

const ZONED = /(Z|[+-]\d{2}:\d{2})$/;
const SKEW_MS = 120_000;

function expectNowish(value: string | null | undefined) {
  expect(value).toMatch(ZONED);
  expect(Math.abs(Date.parse(value as string) - Date.now())).toBeLessThan(SKEW_MS);
}

const summary: PlaytestSummary = {
  overallScore: 70, totalScreenshotsAnalyzed: null, systemsTested: [],
  testCoverage: {} as PlaytestSummary['testCoverage'], topIssue: '', topPraise: '', playtimeSeconds: null,
};

function finding(sessionId: string): PlaytestFinding {
  return {
    id: `${sessionId}-f`, sessionId, category: 'gameplay-feel', severity: 'high', title: 't',
    description: '', relatedModule: null, screenshotRef: null, gameTimestamp: null,
    suggestedFix: '', confidence: null, confidenceBasis: null, createdAt: '',
    triageStatus: 'active', triageNote: '', snoozedUntil: null, fixDispatchedAt: null,
  };
}

describe('game-director-db timestamps are UTC-explicit', () => {
  const sid = `ts-${Date.now()}`;

  it('session createdAt / completedAt', () => {
    createSession(sid, 'ts', '', config);
    expectNowish(getSession(sid)?.createdAt);
    updateSessionSummary(sid, summary, 1, 0, 0);
    const s = listSessions().find(x => x.id === sid);
    expectNowish(s?.createdAt);
    expectNowish(s?.completedAt);
  });

  it('finding createdAt / fixDispatchedAt', () => {
    addFinding(finding(sid));
    expectNowish(getFindings(sid)[0].createdAt);
    expectNowish(markFindingFixDispatched(`${sid}-f`)?.fixDispatchedAt);
  });

  it('health trend and chronology', () => {
    expectNowish(getHealthTrend().find(p => p.sessionId === sid)?.createdAt);
    markRegressionAnalyzed(sid);
    const entry = sessionChronology().find(e => e.id === sid);
    expectNowish(entry?.createdAt);
    expectNowish(entry?.regressionAnalyzedAt);
  });
});
