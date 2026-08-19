/**
 * The "mark fixed" sweep may only speak about ground the analyzed session
 * covered. Before this was scoped, a combat-only session declared every
 * exploration / audio / save-load fingerprint fixed, and the next session that
 * tested those categories fired a regression alert for each — the systemic
 * source of false regressions behind the nav's "active alerts" badge.
 *
 * Throwaway DB (POF_DB_PATH is set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-regression-scope-${process.pid}.db`;
});

import { getDb } from '@/lib/db';
import { createSession, getSession, addFinding } from '@/lib/game-director-db';
import { processSession, getAllFingerprints, getActiveAlerts } from '@/lib/regression-tracker';
import type { PlaytestConfig, PlaytestFinding, TestCategory } from '@/types/game-director';

function config(testCategories: TestCategory[]): PlaytestConfig {
  return {
    testCategories,
    maxPlaytimeMinutes: 5,
    screenshotIntervalSeconds: 10,
    aggressiveMode: false,
    prioritySystems: [],
  };
}

let seq = 0;

/** A finding shaped so its fingerprint hash is stable across sessions. */
function finding(sessionId: string, title: string, category: PlaytestFinding['category']): PlaytestFinding {
  return {
    id: `f-${sessionId}-${seq++}`,
    sessionId,
    category,
    severity: 'high',
    title,
    description: '',
    relatedModule: null,
    screenshotRef: null,
    gameTimestamp: null,
    suggestedFix: '',
    confidence: 90,
    createdAt: new Date().toISOString(),
    triageStatus: 'active',
    triageNote: '',
    snoozedUntil: null,
    fixDispatchedAt: null,
  };
}

/** Create + populate + analyze a session in one step. */
function runSession(
  id: string,
  categories: TestCategory[],
  findings: Array<[title: string, category: PlaytestFinding['category']]>,
) {
  createSession(id, id, '/build', config(categories));
  for (const [title, cat] of findings) addFinding(finding(id, title, cat));
  return processSession(getSession(id)!);
}

const COMBAT_BUG: [string, PlaytestFinding['category']] = ['Hit reaction overlaps dodge', 'animation-issue'];
const EXPLORE_BUG: [string, PlaytestFinding['category']] = ['Dead zone in north corridor', 'level-pacing'];

function reset() {
  const db = getDb();
  for (const t of [
    'regression_alerts', 'regression_occurrences', 'regression_fingerprints',
    'game_director_findings', 'game_director_events', 'game_director_sessions',
  ]) {
    db.exec(`DELETE FROM ${t}`);
  }
}

describe('the fixed-sweep is scoped to what the session tested', () => {
  beforeEach(() => {
    // regression_* tables are created lazily by the tracker; touch it once so the
    // DELETE loop has tables to clear.
    runSession('bootstrap', ['combat'], []);
    reset();
    seq = 0;
  });

  it('leaves fingerprints from untested categories alone', () => {
    runSession('s1-full', ['combat', 'exploration'], [COMBAT_BUG, EXPLORE_BUG]);
    expect(getAllFingerprints().every(f => f.status === 'open')).toBe(true);

    // A combat-only session says nothing about exploration.
    const report = runSession('s2-combat', ['combat'], [COMBAT_BUG]);

    const explore = getAllFingerprints().find(f => f.titleStem.includes('north corridor'))!;
    expect(explore.status).toBe('open');
    expect(report.newlyFixed.map(f => f.titleStem)).toEqual([]);
  });

  it('fires NO regression when the untested category is exercised again', () => {
    runSession('s1-full', ['combat', 'exploration'], [COMBAT_BUG, EXPLORE_BUG]);
    runSession('s2-combat', ['combat'], [COMBAT_BUG]);

    // The exact sequence that used to mint a false alert: the exploration
    // fingerprint reappears in a session that tests exploration again.
    const report = runSession('s3-full', ['combat', 'exploration'], [COMBAT_BUG, EXPLORE_BUG]);

    expect(report.regressions).toEqual([]);
    expect(getActiveAlerts()).toEqual([]);
  });

  it('still detects a genuine in-category regression', () => {
    runSession('g1', ['combat'], [COMBAT_BUG]);
    // Same category, bug gone → a real fix the session is entitled to declare.
    const fixReport = runSession('g2', ['combat'], []);
    expect(fixReport.newlyFixed.map(f => f.titleStem)).toContain('hit reaction overlaps dodge');
    expect(getAllFingerprints()[0].status).toBe('fixed');

    // And back again → a real regression.
    const regReport = runSession('g3', ['combat'], [COMBAT_BUG]);
    expect(regReport.regressions).toHaveLength(1);
    expect(regReport.regressions[0].title).toBe(COMBAT_BUG[0]);
    expect(getActiveAlerts()).toHaveLength(1);
    expect(getAllFingerprints()[0].status).toBe('regressed');
  });

  it('sweeps nothing when the session declares no test categories', () => {
    runSession('n1', ['combat'], [COMBAT_BUG]);
    // An empty scope covers nothing, so it can vindicate nothing. The old global
    // sweep would have marked the combat fingerprint fixed here.
    const report = runSession('n2', [], []);
    expect(report.newlyFixed).toEqual([]);
    expect(getAllFingerprints()[0].status).toBe('open');
  });

  it('does not re-hydrate every session to name the fixing session on an alert', () => {
    runSession('h1', ['combat'], [COMBAT_BUG]);
    runSession('h2', ['combat'], []);
    const report = runSession('h3', ['combat'], [COMBAT_BUG]);
    // The alert still carries the human-readable names it always did — they now
    // come from an id+name projection instead of listSessions() unbounded.
    // `fixedInSession` is the last session the finding was SEEN in (h1), which is
    // the pre-existing semantics of findLastFixedSession; scoping does not change it.
    expect(report.regressions[0].fixedInSessionName).toBe('h1');
    expect(report.regressions[0].reappearedInSessionName).toBe('h3');
  });
});
