import { describe, it, expect } from 'vitest';
import {
  reportZone,
  dayKey,
  monthKey,
  weekKey,
  weekWindow,
  daysBetweenKeys,
} from '@/lib/analytics/report-window';

// Every case names its zone explicitly — nothing here depends on the machine's TZ.

describe('report-window — dayKey / monthKey', () => {
  it('cuts the calendar day in the declared zone, not in UTC', () => {
    expect(dayKey('2026-09-27T22:30:00.000Z', 'Europe/Prague')).toBe('2026-09-28');
    expect(dayKey('2026-09-27T22:30:00.000Z', 'UTC')).toBe('2026-09-27');
  });

  it('accepts a Date as well as an ISO string', () => {
    expect(dayKey(new Date('2026-09-27T22:30:00.000Z'), 'Europe/Prague')).toBe('2026-09-28');
  });

  it('cuts the month in the declared zone', () => {
    expect(monthKey('2026-09-30T23:00:00.000Z', 'Europe/Prague')).toBe('2026-10');
    expect(monthKey('2026-09-30T23:00:00.000Z', 'UTC')).toBe('2026-09');
  });

  it('keys an instant to the Monday of its zone-local week', () => {
    // Mon 21 Sep 00:30 Prague = Sun 20 Sep 22:30 UTC.
    expect(weekKey('2026-09-20T22:30:00.000Z', 'Europe/Prague')).toBe('2026-09-21');
    expect(weekKey('2026-09-20T22:30:00.000Z', 'UTC')).toBe('2026-09-14');
  });
});

describe('report-window — weekWindow', () => {
  it('returns a half-open Monday-first window cut at zone midnight', () => {
    const w = weekWindow(new Date('2026-09-27T18:00:00.000Z'), 'Europe/Prague');
    expect(w).toEqual({
      startKey: '2026-09-21',
      endKey: '2026-09-28',
      dayKeys: ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'],
      start: '2026-09-20T22:00:00.000Z',
      end: '2026-09-27T22:00:00.000Z',
      zone: 'Europe/Prague',
    });
  });

  it('treats an instant exactly at the end edge as the next week (half-open)', () => {
    const w = weekWindow(new Date('2026-09-27T22:00:00.000Z'), 'Europe/Prague');
    expect(w.startKey).toBe('2026-09-28');
    expect(w.start).toBe('2026-09-27T22:00:00.000Z');
  });

  it('keeps calendar edges across a DST change (Prague, 25 Oct 2026)', () => {
    const w = weekWindow(new Date('2026-10-22T12:00:00.000Z'), 'Europe/Prague');
    expect(w.startKey).toBe('2026-10-19');
    expect(w.start).toBe('2026-10-18T22:00:00.000Z'); // CEST (+2)
    expect(w.end).toBe('2026-10-25T23:00:00.000Z');   // CET (+1)
    expect(w.dayKeys).toHaveLength(7);
  });

  it('is identical to UTC arithmetic in the UTC zone', () => {
    const w = weekWindow(new Date('2026-09-27T18:00:00.000Z'), 'UTC');
    expect(w.start).toBe('2026-09-21T00:00:00.000Z');
    expect(w.end).toBe('2026-09-28T00:00:00.000Z');
  });
});

describe('report-window — calendar arithmetic + declared zone', () => {
  it('counts whole calendar days between keys', () => {
    expect(daysBetweenKeys('2025-05-07', '2025-06-11')).toBe(35);
    expect(daysBetweenKeys('2026-10-24', '2026-10-26')).toBe(2); // across DST, still calendar days
    expect(daysBetweenKeys('2025-05-08', '2025-05-07')).toBe(-1);
  });

  it('reportZone() is a single resolvable IANA zone', () => {
    const z = reportZone();
    expect(typeof z).toBe('string');
    expect(() => dayKey('2026-01-01T00:00:00.000Z', z)).not.toThrow();
  });
});
