import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '@/lib/db';
import {
  recordSession,
  getDashboard,
  getPromptQualityScore,
  generateInsights,
} from '@/lib/session-analytics-db';
import type { SubModuleId } from '@/types/modules';

// These tests hit the real ~/.pof/pof.db singleton, so every module id is namespaced
// and cleaned up before/after the suite to avoid clobbering dev data.
const NS = 'n1test';

function clearNs(): void {
  getDb().prepare(`DELETE FROM session_analytics WHERE module_id LIKE '${NS}-%'`).run();
}

beforeAll(clearNs);
afterAll(clearNs);

let counter = 0;
function uniqueModuleId(): SubModuleId {
  counter += 1;
  return `${NS}-${counter}` as SubModuleId;
}

/**
 * Seed `successes.length` sessions for a module with strictly increasing
 * completed_at timestamps (index 0 = oldest, last = newest) so ORDER BY
 * completed_at DESC is deterministic.
 */
function seed(moduleId: SubModuleId, successes: boolean[]): void {
  const prompt = 'x'.repeat(120); // identical length for success + fail → no prompt-length insight
  successes.forEach((ok, i) => {
    const ts = `2026-01-01 00:${String(i).padStart(2, '0')}:00`;
    recordSession({
      moduleId,
      sessionKey: `${moduleId}-${i}`,
      prompt,
      hadProjectContext: false,
      success: ok,
      durationMs: 1000,
      startedAt: ts,
      completedAt: ts,
    });
  });
}

/** Count how many SQL statements getDashboard() prepares for one render. */
function countDashboardQueries(): number {
  const db = getDb() as unknown as { prepare: (sql: string) => unknown };
  const proto = Object.getPrototypeOf(db) as { prepare: (sql: string) => unknown };
  const realPrepare = proto.prepare;
  let count = 0;
  db.prepare = function (this: unknown, sql: string) {
    count += 1;
    return realPrepare.call(this, sql);
  };
  try {
    getDashboard();
  } finally {
    delete (db as { prepare?: unknown }).prepare;
  }
  return count;
}

describe('session-analytics getDashboard — N+1 elimination', () => {
  it('runs a constant number of DB queries regardless of module count (no N+1)', () => {
    const before = countDashboardQueries();

    // Add several brand-new modules, each with enough sessions to drive
    // both insights and quality scores.
    for (let i = 0; i < 5; i++) {
      seed(uniqueModuleId(), [true, true, false, true, true, false, true, true]);
    }

    const after = countDashboardQueries();
    expect(after).toBe(before);
  });

  it('dashboard qualityScores match per-module getPromptQualityScore', () => {
    const mid = uniqueModuleId();
    // 20 sessions: older half mostly fails, newer half mostly succeeds (a real trend).
    const successes = [
      false, false, true, false, false, true, false, false, true, false, // older (idx 0-9)
      true, true, true, false, true, true, true, true, false, true, // newer (idx 10-19)
    ];
    seed(mid, successes);

    const single = getPromptQualityScore(mid);
    const fromDash = getDashboard().qualityScores.find((q) => q.moduleId === mid);

    expect(fromDash).toBeDefined();
    expect(fromDash).toEqual(single);
  });

  it('dashboard insights match per-module generateInsights', () => {
    const mid = uniqueModuleId();
    // 3 successes / 9 failures of 12 → 25% success rate triggers the low-success insight.
    const successes = Array.from({ length: 12 }, (_, i) => i < 3);
    seed(mid, successes);

    const sortByType = (a: { type: string }, b: { type: string }) => a.type.localeCompare(b.type);
    const single = [...generateInsights(mid)].sort(sortByType);
    const fromDash = getDashboard().insights.filter((ins) => ins.moduleId === mid).sort(sortByType);

    expect(fromDash).toEqual(single);
    expect(single.length).toBeGreaterThan(0);
  });

  it('computes a perfect quality score for an all-success module', () => {
    const mid = uniqueModuleId();
    seed(mid, Array.from({ length: 8 }, () => true));

    const q = getDashboard().qualityScores.find((x) => x.moduleId === mid);
    expect(q).toBeDefined();
    expect(q!.score).toBe(100);
    expect(q!.overallSuccessRate).toBe(1);
    expect(q!.recentSuccessRate).toBe(1);
    expect(q!.trend).toBe('stable'); // fewer than 5 in the older window → stable
  });
});
