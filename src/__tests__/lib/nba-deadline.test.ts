/**
 * Defect: `milestone_deadlines` was a store nothing read. It is defined in
 * `db.ts`, served by `/api/milestone-deadlines`, written by the calendar
 * roadmap — and `nba-engine.ts` contained zero occurrences of "deadline", so a
 * milestone due next week and one due next quarter ranked identically.
 *
 * Law L13 — declaring an input is not consuming it.
 *
 * The fix adds a BOUNDED urgency contribution derived from time-to-deadline,
 * with one hard rule: no declared deadline ⇒ no contribution, ever. With the
 * store empty the ranking must be byte-identical to what it was before.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  deadlinePressure,
  DEADLINE_URGENCY_MAX,
  DEADLINE_HORIZON_DAYS,
  type MilestoneDeadlineMap,
} from '@/lib/nba-deadline';
import { computeNBA, NBA_FACTOR_WEIGHTS } from '@/lib/nba-engine';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';

const NOW = new Date('2026-09-03T00:00:00.000Z');

function inDays(n: number): string {
  return new Date(NOW.getTime() + n * 86_400_000).toISOString();
}

beforeEach(() => {
  useModuleStore.setState({ checklistProgress: {}, moduleHistory: {}, moduleHealth: {} });
  usePatternLibraryStore.setState({ patterns: [] });
  useEvaluatorStore.setState({ lastScan: null });
});

describe('deadlinePressure', () => {
  it('returns null when no deadline store was supplied', () => {
    expect(deadlinePressure(undefined, NOW)).toBeNull();
    expect(deadlinePressure(null, NOW)).toBeNull();
  });

  it('returns null when the deadline store is empty — never a default urgency', () => {
    expect(deadlinePressure({}, NOW)).toBeNull();
  });

  it('ignores rows whose target date does not parse', () => {
    expect(deadlinePressure({ 'vertical-slice': { targetDate: 'not-a-date' } }, NOW)).toBeNull();
  });

  it('contributes nothing for a deadline beyond the horizon', () => {
    const p = deadlinePressure(
      { 'release': { targetDate: inDays(DEADLINE_HORIZON_DAYS + 30) } },
      NOW,
    )!;
    expect(p).not.toBeNull();
    expect(p.points).toBe(0);
  });

  it('contributes the maximum for an overdue deadline', () => {
    const p = deadlinePressure({ 'beta-ready': { targetDate: inDays(-5) } }, NOW)!;
    expect(p.points).toBe(DEADLINE_URGENCY_MAX);
    expect(p.daysRemaining).toBeLessThan(0);
  });

  it('scales monotonically as the deadline approaches, bounded by the max', () => {
    const seq = [DEADLINE_HORIZON_DAYS, 60, 30, 7, 1, 0, -10].map((d) =>
      deadlinePressure({ m: { targetDate: inDays(d) } }, NOW)!.points,
    );
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i], `step ${i}`).toBeGreaterThanOrEqual(seq[i - 1]);
    }
    expect(Math.max(...seq)).toBe(DEADLINE_URGENCY_MAX);
    expect(Math.min(...seq)).toBe(0);
  });

  it('picks the soonest declared deadline when several exist', () => {
    const p = deadlinePressure(
      {
        'release': { targetDate: inDays(200), label: 'RC' },
        'vertical-slice': { targetDate: inDays(10), label: 'Slice' },
        'beta-ready': { targetDate: inDays(90) },
      },
      NOW,
    )!;
    expect(p.milestoneId).toBe('vertical-slice');
    expect(p.daysRemaining).toBe(10);
  });

  it('names the milestone and the remaining time in its note', () => {
    const p = deadlinePressure({ 'beta-ready': { targetDate: inDays(3), label: 'Beta' } }, NOW)!;
    expect(p.note).toContain('Beta');
    expect(p.note).toMatch(/3 days/);
  });
});

describe('computeNBA — deadline term', () => {
  const statusMap = new Map<string, string>();

  it('ranks byte-identically when no deadlines are declared', () => {
    const before = JSON.stringify(computeNBA('arpg-combat', statusMap));
    expect(JSON.stringify(computeNBA('arpg-combat', statusMap, undefined, undefined, undefined)))
      .toBe(before);
    expect(JSON.stringify(computeNBA('arpg-combat', statusMap, undefined, undefined, null)))
      .toBe(before);
    expect(JSON.stringify(computeNBA('arpg-combat', statusMap, undefined, undefined, {})))
      .toBe(before);
  });

  it('ranks byte-identically for a deadline beyond the horizon', () => {
    const before = JSON.stringify(computeNBA('arpg-combat', statusMap));
    const far: MilestoneDeadlineMap = { release: { targetDate: inDays(DEADLINE_HORIZON_DAYS + 1) } };
    const withFar = computeNBA('arpg-combat', statusMap, undefined, undefined, far, NOW);
    // Provenance is attached, but not one point of urgency moved.
    expect(withFar.every((r) => r.deadline?.points === 0)).toBe(true);
    expect(JSON.stringify(withFar.map((r) => [r.item.id, r.score, r.breakdown])))
      .toBe(JSON.stringify(JSON.parse(before).map((r: { item: { id: string }; score: number; breakdown: unknown }) => [r.item.id, r.score, r.breakdown])));
  });

  it('raises urgency for startable work when a deadline is near', () => {
    const base = computeNBA('arpg-combat', statusMap, undefined, undefined, undefined, NOW);
    const near: MilestoneDeadlineMap = { 'vertical-slice': { targetDate: inDays(3), label: 'Slice' } };
    const pressed = computeNBA('arpg-combat', statusMap, undefined, undefined, near, NOW);

    const baseById = new Map(base.map((r) => [r.item.id, r]));
    let raised = 0;
    for (const rec of pressed) {
      const before = baseById.get(rec.item.id)!;
      expect(rec.breakdown.urgency).toBeGreaterThanOrEqual(before.breakdown.urgency);
      expect(rec.breakdown.urgency).toBeLessThanOrEqual(NBA_FACTOR_WEIGHTS.urgency);
      if (rec.breakdown.urgency > before.breakdown.urgency) raised += 1;
    }
    expect(raised, 'at least one startable item gained deadline urgency').toBeGreaterThan(0);
  });

  it('never accelerates work that cannot be started', () => {
    const base = computeNBA('arpg-combat', statusMap, undefined, undefined, undefined, NOW);
    const near: MilestoneDeadlineMap = { 'vertical-slice': { targetDate: inDays(1) } };
    const pressed = computeNBA('arpg-combat', statusMap, undefined, undefined, near, NOW);
    const baseById = new Map(base.map((r) => [r.item.id, r]));

    const blocked = pressed.filter((r) => r.breakdown.readiness === 0);
    expect(blocked.length, 'fixture has blocked items').toBeGreaterThan(0);
    for (const rec of blocked) {
      expect(rec.breakdown.urgency).toBe(baseById.get(rec.item.id)!.breakdown.urgency);
    }
  });

  it('carries the deadline provenance on every recommendation it scored', () => {
    const near: MilestoneDeadlineMap = { 'beta-ready': { targetDate: inDays(2), label: 'Beta' } };
    const recs = computeNBA('arpg-combat', statusMap, undefined, undefined, near, NOW);
    expect(recs.length).toBeGreaterThan(0);
    for (const rec of recs) {
      expect(rec.deadline).not.toBeNull();
      expect(rec.deadline!.milestoneId).toBe('beta-ready');
    }
  });
});
