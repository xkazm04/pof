import { describe, it, expect } from 'vitest';
import { scanSweepDebt, parseScanSweepLedger, isoWeekOf } from '@/lib/evaluator/scan-sweep-debt';

const NOW = Date.parse('2026-10-06T12:00:00Z');

/** A well-formed ledger row; override only what a case is about. */
const row = (at: string, over: Record<string, unknown> = {}) => ({
  at, scope: 'ctx', mode: 'resolve', strategy: 'optimize',
  lenses: 3, findings: 2, fixed: 2, fp: 0, carried: 0, escalations: 0, leads: 0, degraded: false, note: '',
  ...over,
});

describe('isoWeekOf', () => {
  it('buckets across a year boundary by ISO week-year, not calendar year', () => {
    // 2026 has 53 ISO weeks (1 Jan 2026 is a Thursday).
    expect(isoWeekOf(Date.parse('2026-12-31T23:59:59Z'))).toEqual({ week: '2026-W53', start: '2026-12-28' });
    expect(isoWeekOf(Date.parse('2027-01-01T00:00:00Z'))).toEqual({ week: '2026-W53', start: '2026-12-28' });
    expect(isoWeekOf(Date.parse('2027-01-03T23:59:59Z')).week).toBe('2026-W53');
    expect(isoWeekOf(Date.parse('2027-01-04T00:00:00Z'))).toEqual({ week: '2027-W01', start: '2027-01-04' });
    // the other direction: late December that already belongs to next year's week 1
    expect(isoWeekOf(Date.parse('2024-12-30T10:00:00Z'))).toEqual({ week: '2025-W01', start: '2024-12-30' });
    expect(isoWeekOf(Date.parse('2024-12-29T10:00:00Z')).week).toBe('2024-W52');
  });

  it('puts Sunday with the preceding Monday', () => {
    expect(isoWeekOf(Date.parse('2026-09-27T08:00:00Z'))).toEqual({ week: '2026-W39', start: '2026-09-21' });
    expect(isoWeekOf(Date.parse('2026-09-28T08:00:00Z'))).toEqual({ week: '2026-W40', start: '2026-09-28' });
  });
});

describe('scanSweepDebt', () => {
  it('does not throw on an empty ledger: no weeks, insufficient-data', () => {
    const r = scanSweepDebt([], NOW);
    expect(r).toMatchObject({ rows: 0, skipped: 0, weeks: [], trend: 'insufficient-data', latestWeekPartial: false });
  });

  it('buckets rows into ISO weeks across a year boundary and sums the flows', () => {
    const r = scanSweepDebt([
      row('2026-12-31T10:00:00Z', { findings: 5, fixed: 3, escalations: 1, leads: 1 }),
      row('2027-01-02T10:00:00Z', { findings: 4, fixed: 4 }),
      row('2027-01-05T10:00:00Z', { findings: 1, fixed: 0 }),
    ], Date.parse('2027-02-01T00:00:00Z'));
    expect(r.weeks.map((w) => w.week)).toEqual(['2026-W53', '2027-W01']);
    expect(r.weeks[0]).toMatchObject({ rounds: 2, findings: 9, fixed: 7, unfixed: 2, escalations: 1, leads: 1 });
    expect(r.weeks[1]).toMatchObject({ rounds: 1, findings: 1, fixed: 0, unfixed: 1 });
  });

  it('skips malformed rows and counts them instead of throwing', () => {
    const r = scanSweepDebt([
      row('2026-10-05T10:00:00Z'),
      undefined, null, 42, 'text', [],
      { at: 'not-a-date', findings: 1, fixed: 1 },
      { at: '2026-10-05T11:00:00Z', findings: 'many', fixed: 1 },
      { at: '2026-10-05T11:00:00Z', findings: 3 },
      { at: '2026-10-05T11:00:00Z', findings: -1, fixed: 0 },
    ], NOW);
    expect(r.rows).toBe(1);
    expect(r.skipped).toBe(9);
    expect(r.weeks).toHaveLength(1);
  });

  it('parses ledger text: bad JSON lines become skipped, blank lines are ignored', () => {
    const text = [
      JSON.stringify(row('2026-10-05T10:00:00Z')),
      '{"at": "2026-10-05T10:00:00Z", "findings": ',
      '',
      '   ',
      JSON.stringify(row('2026-10-05T11:00:00Z')),
    ].join('\r\n');
    const parsed = parseScanSweepLedger(text);
    expect(parsed).toHaveLength(3);
    const r = scanSweepDebt(parsed, NOW);
    expect(r.rows).toBe(2);
    expect(r.skipped).toBe(1);
  });

  it('reads carried as a closing stock per scope (last round of the week), not a sum', () => {
    const r = scanSweepDebt([
      row('2026-10-05T08:00:00Z', { scope: 'a', carried: 4 }),
      row('2026-10-05T09:00:00Z', { scope: 'a', carried: 1 }),
      row('2026-10-05T09:30:00Z', { scope: 'b', carried: 2 }),
      // legacy row without a carried field: unobserved, must not zero or add anything
      row('2026-10-05T10:00:00Z', { scope: 'c', carried: undefined }),
    ], NOW);
    expect(r.weeks[0].carried).toBe(3);
  });

  it('orders rows by timestamp, not file order, when picking the closing carried', () => {
    const r = scanSweepDebt([
      row('2026-10-05T09:00:00Z', { scope: 'a', carried: 1 }),
      row('2026-10-05T08:00:00Z', { scope: 'a', carried: 4 }),
    ], NOW);
    expect(r.weeks[0].carried).toBe(1);
  });

  it('defines outstanding as closing carried + escalations raised that week', () => {
    const r = scanSweepDebt([
      row('2026-10-05T09:00:00Z', { scope: 'a', carried: 2, escalations: 1 }),
      row('2026-10-05T10:00:00Z', { scope: 'b', carried: 0, escalations: 2 }),
    ], NOW);
    expect(r.weeks[0]).toMatchObject({ carried: 2, escalations: 3, outstanding: 5 });
  });

  it('computes the week-over-week delta against the previous week with data', () => {
    const r = scanSweepDebt([
      row('2026-09-01T10:00:00Z', { carried: 3 }),
      row('2026-09-29T10:00:00Z', { carried: 1 }),
    ], NOW);
    expect(r.weeks.map((w) => w.week)).toEqual(['2026-W36', '2026-W40']);
    expect(r.weeks[0].deltaOutstanding).toBeNull();
    expect(r.weeks[0].previousWeek).toBeNull();
    expect(r.weeks[1]).toMatchObject({ deltaOutstanding: -2, previousWeek: '2026-W36' });
  });

  describe('trend', () => {
    const wk = (at: string, carried: number) => row(at, { carried });
    it('insufficient-data with a single week', () => {
      expect(scanSweepDebt([wk('2026-09-29T10:00:00Z', 5)], NOW).trend).toBe('insufficient-data');
    });
    it('falling when the latest week has less outstanding than the one before', () => {
      expect(scanSweepDebt([wk('2026-09-22T10:00:00Z', 5), wk('2026-09-29T10:00:00Z', 2)], NOW).trend).toBe('falling');
    });
    it('flat when unchanged', () => {
      expect(scanSweepDebt([wk('2026-09-22T10:00:00Z', 2), wk('2026-09-29T10:00:00Z', 2)], NOW).trend).toBe('flat');
    });
    it('rising when the latest week has more outstanding', () => {
      expect(scanSweepDebt([wk('2026-09-22T10:00:00Z', 0), wk('2026-09-29T10:00:00Z', 1)], NOW).trend).toBe('rising');
    });
  });

  it('flags the week containing now as partial', () => {
    const r = scanSweepDebt([row('2026-09-29T10:00:00Z'), row('2026-10-05T10:00:00Z')], NOW);
    expect(r.weeks.map((w) => w.partial)).toEqual([false, true]);
    expect(r.latestWeekPartial).toBe(true);
  });

  it('states what outstanding means and which fields it leaves out', () => {
    const r = scanSweepDebt([], NOW);
    expect(r.definition.outstanding).toMatch(/carried/);
    expect(r.definition.outstanding).toMatch(/escalations/);
    expect(r.definition.notUsed.join(' ')).toMatch(/fp/);
  });
});
