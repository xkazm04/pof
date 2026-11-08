/**
 * The nav urgency pill (getDirectorStats.openCriticalHigh) must count what the
 * findings list shows as open: a finding parked by a snooze that has not lapsed
 * is hidden by rowToFinding, so it must not be counted either.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-snooze-open-${process.pid}.db`;
});

import { createSession, addFinding, updateFindingTriage, getDirectorStats } from '@/lib/game-director-db';
import type { PlaytestConfig, PlaytestFinding } from '@/types/game-director';

const config: PlaytestConfig = {
  testCategories: ['combat'],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

const DAY = 24 * 60 * 60 * 1000;
let seq = 0;

function finding(sessionId: string): PlaytestFinding {
  return {
    id: `f-${sessionId}-${seq++}`,
    sessionId,
    category: 'gameplay-feel',
    severity: 'critical',
    title: 'Dash cancels itself on slopes',
    description: '',
    relatedModule: null,
    screenshotRef: null,
    gameTimestamp: null,
    suggestedFix: '',
    confidence: null,
    confidenceBasis: null,
    createdAt: new Date().toISOString(),
    triageStatus: 'active',
    triageNote: '',
    snoozedUntil: null,
    fixDispatchedAt: null,
    reproAttempts: null,
    reproBuildId: null,
    reproLastAttemptedAt: null,
  };
}

describe('openCriticalHigh and snoozed findings', () => {
  it('counts a critical whose snooze lapsed, not one snoozed into the future', () => {
    createSession('snz', 'Snooze', '/build', config);
    const future = finding('snz');
    const lapsed = finding('snz');
    addFinding(future);
    addFinding(lapsed);
    expect(getDirectorStats().openCriticalHigh).toBe(2);

    updateFindingTriage(future.id, 'snooze', 'later', new Date(Date.now() + 7 * DAY).toISOString());
    updateFindingTriage(lapsed.id, 'snooze', 'earlier', new Date(Date.now() - DAY).toISOString());

    expect(getDirectorStats().openCriticalHigh).toBe(1);
  });
});
