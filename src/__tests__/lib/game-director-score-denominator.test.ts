/**
 * A completed session whose summary carries no numeric `overallScore` (the
 * writer API's `complete` action stores the caller's summary as sent) has no
 * score. Two readers disagreed about that:
 *
 *  - `getDirectorStats`: `AVG(json_extract(...))` skipped it, but
 *    `scoredSessions` (and `scoreSource`) still counted it — "average of N
 *    sessions" named a denominator the average did not use.
 *  - `getHealthTrend` plotted it as a 0 — an unmeasured session drawn as the
 *    worst possible build.
 *
 * Throwaway DB (POF_DB_PATH is set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-score-denominator-${process.pid}.db`;
});

import { createSession, updateSessionSummary, getDirectorStats, getHealthTrend } from '@/lib/game-director-db';
import type { PlaytestConfig, PlaytestSummary } from '@/types/game-director';

const config: PlaytestConfig = {
  testCategories: ['combat'], maxPlaytimeMinutes: 5, screenshotIntervalSeconds: 10,
  aggressiveMode: false, prioritySystems: [],
};

const base = {
  totalScreenshotsAnalyzed: null, systemsTested: [],
  testCoverage: {} as PlaytestSummary['testCoverage'], topIssue: '', topPraise: '', playtimeSeconds: null,
};

describe('a summary without a numeric score is not a scored session', () => {
  const stamp = Date.now();
  const scored = `scored-${stamp}`;
  const unscored = `unscored-${stamp}`;
  createSession(scored, 'scored', '', config, 'external');
  updateSessionSummary(scored, { ...base, overallScore: 80 }, 1, 0, 0, 'external');
  createSession(unscored, 'unscored', '', config, 'simulated');
  updateSessionSummary(unscored, { ...base } as unknown as PlaytestSummary, 1, 0, 0, 'simulated');

  it('stats count only sessions the average actually averaged', () => {
    const stats = getDirectorStats();
    expect(stats.avgScore).toBe(80);
    expect(stats.scoredSessions).toBe(1);
    expect(stats.scoreSource).toBe('external');
  });

  it('the trend omits the unscored session instead of plotting 0', () => {
    const trend = getHealthTrend();
    expect(trend.map(p => p.sessionId)).toEqual([scored]);
  });
});
