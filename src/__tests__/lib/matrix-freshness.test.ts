import { describe, it, expect } from 'vitest';
import { matrixFreshness, MATRIX_FRESH_WINDOW_DAYS } from '@/lib/evaluator/matrix-freshness';

const NOW = Date.parse('2026-10-06T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const row = (moduleId: string, lastReviewedAt: string | null) => ({ moduleId, lastReviewedAt });

describe('matrixFreshness', () => {
  it('states a 14-day window', () => {
    expect(MATRIX_FRESH_WINDOW_DAYS).toBe(14);
    expect(matrixFreshness([], NOW).windowDays).toBe(14);
  });

  it('counts a module whose rows are all inside the window as fresh (14d boundary included)', () => {
    const r = matrixFreshness([row('combat', daysAgo(1)), row('combat', daysAgo(14))], NOW);
    expect(r).toMatchObject({ modulesTotal: 1, modulesFresh: 1, modulesWithNeverReviewedRow: 0, freshPct: 100 });
    expect(r.staleModules).toEqual([]);
  });

  it('makes one stale row stale the whole module and reports its oldest review', () => {
    const r = matrixFreshness([row('loot', daysAgo(2)), row('loot', daysAgo(30)), row('loot', daysAgo(15))], NOW);
    expect(r.modulesFresh).toBe(0);
    expect(r.staleModules).toEqual([
      { moduleId: 'loot', oldestReviewedAt: daysAgo(30), neverReviewedRows: 0 },
    ]);
  });

  it('flags a never-reviewed row, including a null-only module and an unparseable stamp', () => {
    const r = matrixFreshness(
      [row('audio', daysAgo(1)), row('audio', null), row('ai', null), row('physics', 'not-a-date'), row('ok', daysAgo(3))],
      NOW,
    );
    expect(r.modulesTotal).toBe(4);
    expect(r.modulesFresh).toBe(1);
    expect(r.modulesWithNeverReviewedRow).toBe(3);
    // never-reviewed modules lead; audio keeps its oldest REVIEWED date
    expect(r.staleModules.map((m) => m.moduleId)).toEqual(['ai', 'physics', 'audio']);
    expect(r.staleModules.find((m) => m.moduleId === 'audio')).toEqual({
      moduleId: 'audio', oldestReviewedAt: daysAgo(1), neverReviewedRows: 1,
    });
    expect(r.staleModules.find((m) => m.moduleId === 'ai')?.oldestReviewedAt).toBeNull();
    expect(r.freshPct).toBe(25);
  });

  it('reads naive SQLite UTC stamps and treats future-dated reviews as fresh', () => {
    const r = matrixFreshness([row('a', '2026-10-05 12:00:00'), row('b', daysAgo(-3))], NOW);
    expect(r.modulesFresh).toBe(2);
  });

  it('does not throw on an empty table: freshPct is null (no modules, not 0%)', () => {
    expect(matrixFreshness([], NOW)).toEqual({
      windowDays: 14, modulesTotal: 0, modulesFresh: 0, modulesWithNeverReviewedRow: 0, staleModules: [], freshPct: null,
    });
  });

  it('rounds freshPct to one decimal', () => {
    const rows = [row('a', daysAgo(1)), row('b', daysAgo(99)), row('c', daysAgo(99))];
    expect(matrixFreshness(rows, NOW).freshPct).toBe(33.3);
  });
});
