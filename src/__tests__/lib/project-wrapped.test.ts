import { describe, it, expect } from 'vitest';
import { aggregateProjectWrapped, type WrappedSessionRow } from '@/lib/project-wrapped';

const NOW = '2026-06-03T00:00:00.000Z';

/** Build a session row at noon UTC (TZ-robust for date-string derivations). */
function row(date: string, success: 0 | 1, moduleId: string, ms = 600_000): WrappedSessionRow {
  return { module_id: moduleId, success, duration_ms: ms, completed_at: `${date}T12:00:00.000Z` };
}

// A deterministic lifetime spanning two weeks in May + one June session.
// Week W1 (Mon 2025-05-05) clusters 6 sessions on Wed 05-07 — the biggest week.
const FIXTURE: WrappedSessionRow[] = [
  // W1 — 2025-05-07: 5 successes then a fail (combat x5 incl. 1 fail, loot x1)
  row('2025-05-07', 1, 'arpg-combat'),
  row('2025-05-07', 1, 'arpg-combat'),
  row('2025-05-07', 1, 'arpg-combat'),
  row('2025-05-07', 1, 'arpg-combat'),
  row('2025-05-07', 1, 'arpg-loot'),
  row('2025-05-07', 0, 'arpg-combat'),
  // W2 — 2025-05-14: 3 successes (combat x2, ui x1)
  row('2025-05-14', 1, 'arpg-combat'),
  row('2025-05-14', 1, 'arpg-combat'),
  row('2025-05-14', 1, 'arpg-ui'),
  // June — 2025-06-11: combat success, ui fail
  row('2025-06-11', 1, 'arpg-combat'),
  row('2025-06-11', 0, 'arpg-ui'),
];

describe('aggregateProjectWrapped — lifetime metrics', () => {
  const w = aggregateProjectWrapped(FIXTURE, NOW);

  it('stamps the provided generatedAt (no wall-clock read)', () => {
    expect(w.generatedAt).toBe(NOW);
  });

  it('totals sessions, successes, rate, and time across all rows', () => {
    expect(w.totalSessions).toBe(11);
    expect(w.successCount).toBe(9);
    expect(w.successRate).toBeCloseTo(9 / 11, 5);
    expect(w.totalTimeMs).toBe(11 * 600_000);
  });

  it('derives the lifetime span from the first and last session', () => {
    expect(w.firstSessionDate).toBe('2025-05-07');
    expect(w.lastSessionDate).toBe('2025-06-11');
    expect(w.activeDays).toBe(3);
    expect(w.spanDays).toBe(36); // 2025-05-07 → 2025-06-11 inclusive
  });

  it('counts modules touched vs conquered (>=3 sessions & >=70% success)', () => {
    expect(w.modulesTouched).toBe(3);
    expect(w.modulesConquered).toBe(1); // only arpg-combat (8 sessions, 87.5%)
    expect(w.topModules[0].moduleId).toBe('arpg-combat');
    expect(w.topModules[0].sessions).toBe(8);
    expect(w.topModules[0].successRate).toBeCloseTo(7 / 8, 5);
  });

  it('identifies the biggest week and biggest day', () => {
    expect(w.biggestWeek).not.toBeNull();
    expect(w.biggestWeek!.sessions).toBe(6);
    expect(w.biggestWeek!.successRate).toBeCloseTo(5 / 6, 5);
    // weekStart is the week's Monday; its serialized value is TZ-sensitive (the shared
    // getWeekStart mixes local/UTC), so just assert it lands on that week boundary.
    expect(w.biggestWeek!.weekStart).toMatch(/^2025-05-0[45]$/);
    expect(w.biggestDay).toEqual({ date: '2025-05-07', sessions: 6 });
  });

  it('computes the longest consecutive-success streak', () => {
    expect(w.longestStreak).toBe(5); // the 5 successes on 2025-05-07 before the fail
  });

  it('builds a continuous, gap-filled monthly arc', () => {
    expect(w.monthlyActivity.map((m) => m.month)).toEqual(['2025-05', '2025-06']);
    expect(w.monthlyActivity[0]).toEqual({ month: '2025-05', sessions: 9, success: 8 });
    expect(w.monthlyActivity[1]).toEqual({ month: '2025-06', sessions: 2, success: 1 });
  });
});

describe('aggregateProjectWrapped — milestones & achievements', () => {
  const w = aggregateProjectWrapped(FIXTURE, NOW);

  it('always leads the timeline with the first session', () => {
    expect(w.milestones[0].type).toBe('first-session');
    expect(w.milestones[0].date).toBe('2025-05-07');
  });

  it('dates the 10-session milestone at the moment the 10th session landed', () => {
    const m = w.milestones.find((x) => x.type === 'sessions' && x.title === '10 sessions');
    expect(m).toBeTruthy();
    expect(m!.date).toBe('2025-06-11');
  });

  it('records a time milestone once cumulative build time crosses 1h', () => {
    const m = w.milestones.find((x) => x.type === 'time');
    expect(m).toBeTruthy();
    expect(m!.title).toBe('1h invested');
    expect(m!.date).toBe('2025-05-07'); // 6 × 10min = 1h, reached on the 6th row
  });

  it('records biggest-week and streak milestones', () => {
    expect(w.milestones.some((x) => x.type === 'biggest-week')).toBe(true);
    expect(w.milestones.some((x) => x.type === 'streak' && x.title === '5-session streak')).toBe(true);
  });

  it('keeps the timeline (beyond the pinned first entry) chronological', () => {
    const rest = w.milestones.slice(1).map((m) => m.date);
    const sorted = [...rest].sort((a, b) => a.localeCompare(b));
    expect(rest).toEqual(sorted);
  });

  it('awards no lifetime achievements for a small project (tiers are intentionally high)', () => {
    // 11 sessions / 1.8h / 3 modules clears none of the lifetime thresholds.
    expect(w.achievements).toEqual([]);
  });
});

describe('aggregateProjectWrapped — achievement tiers', () => {
  it('promotes to higher tiers as volume grows', () => {
    const many: WrappedSessionRow[] = [];
    for (let i = 0; i < 120; i++) {
      // 120 sessions @ 100% success, ~6h total, spread across 12 modules
      many.push(row('2025-05-07', 1, `mod-${i % 12}`, 180_000));
    }
    const w = aggregateProjectWrapped(many, NOW);
    const ids = w.achievements.map((a) => a.id);
    expect(ids).toContain('lifetime-centurion'); // ≥100 sessions
    expect(ids).toContain('lifetime-marksman');  // ≥90% success
    expect(ids).toContain('lifetime-polymath');  // ≥10 modules
    expect(w.modulesTouched).toBe(12);
  });
});

describe('aggregateProjectWrapped — empty history', () => {
  const w = aggregateProjectWrapped([], NOW);

  it('returns a stable zeroed recap with no data', () => {
    expect(w.totalSessions).toBe(0);
    expect(w.firstSessionDate).toBeNull();
    expect(w.biggestWeek).toBeNull();
    expect(w.biggestDay).toBeNull();
    expect(w.milestones).toEqual([]);
    expect(w.achievements).toEqual([]);
    expect(w.monthlyActivity).toEqual([]);
    expect(w.generatedAt).toBe(NOW);
  });
});
