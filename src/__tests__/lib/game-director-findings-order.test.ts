/**
 * `getFindings` returns a session's findings in severity order — the order
 * `SEVERITY_ORDER` declares and `SessionDetail/FindingsList` renders as-is.
 *
 * It used to `ORDER BY severity`, which sorts the TEXT column alphabetically:
 * critical, high, LOW, MEDIUM, positive — every low finding was listed above
 * every medium one.
 *
 * Throwaway DB (POF_DB_PATH is set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-findings-order-${process.pid}.db`;
});

import { createSession, addFinding, getFindings } from '@/lib/game-director-db';
import { SEVERITY_ORDER } from '@/lib/game-director-styles';
import type { FindingSeverity, PlaytestConfig, PlaytestFinding } from '@/types/game-director';

const config: PlaytestConfig = {
  testCategories: ['combat'],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

function finding(sessionId: string, id: string, severity: FindingSeverity): PlaytestFinding {
  return {
    id, sessionId, category: 'gameplay-feel', severity, title: `${severity} finding`,
    description: '', relatedModule: null, screenshotRef: null, gameTimestamp: null,
    suggestedFix: '', confidence: null, confidenceBasis: null,
    createdAt: new Date().toISOString(), triageStatus: 'active', triageNote: '',
    snoozedUntil: null, fixDispatchedAt: null,
  };
}

describe('getFindings — severity order, not alphabetical', () => {
  it('lists critical, high, medium, low, positive', () => {
    const sid = `order-${Date.now()}`;
    createSession(sid, 'order', '', config);
    // Inserted in an order that matches neither sort, so the result is the ORDER BY's.
    const inserted: FindingSeverity[] = ['positive', 'low', 'medium', 'critical', 'high', 'low', 'medium'];
    inserted.forEach((sev, i) => addFinding(finding(sid, `${sid}-${i}`, sev)));

    const got = getFindings(sid).map(f => f.severity);
    const rank = (s: FindingSeverity) => SEVERITY_ORDER.indexOf(s);
    expect(got).toEqual([...inserted].sort((a, b) => rank(a) - rank(b)));
    expect(got.indexOf('medium')).toBeLessThan(got.indexOf('low'));
  });
});
