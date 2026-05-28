import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCHEDULE,
  parseTimeOfDay,
  isDueAt,
  nextRunAt,
  shouldSkipUnchanged,
  describeSchedule,
  type BuildSchedule,
} from '@/lib/packaging/build-scheduler';

function schedule(overrides: Partial<BuildSchedule> = {}): BuildSchedule {
  return { ...DEFAULT_SCHEDULE, enabled: true, time: '02:00', ...overrides };
}

describe('parseTimeOfDay', () => {
  it('parses a valid HH:MM', () => {
    expect(parseTimeOfDay('02:00')).toEqual({ hours: 2, minutes: 0 });
    expect(parseTimeOfDay('23:59')).toEqual({ hours: 23, minutes: 59 });
    expect(parseTimeOfDay('00:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it('rejects malformed or out-of-range times', () => {
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('02:60')).toBeNull();
    expect(parseTimeOfDay('2:00')).toBeNull();
    expect(parseTimeOfDay('not-a-time')).toBeNull();
    expect(parseTimeOfDay('')).toBeNull();
  });
});

describe('isDueAt', () => {
  // May 27 2026 is a Wednesday (getDay() === 3).
  const before = new Date(2026, 4, 27, 1, 30, 0); // 01:30, before the 02:00 slot
  const after = new Date(2026, 4, 27, 3, 0, 0); // 03:00, after the 02:00 slot

  it('is not due when disabled', () => {
    expect(isDueAt(schedule({ enabled: false }), null, after)).toBe(false);
  });

  it('is not due before the scheduled time', () => {
    expect(isDueAt(schedule(), null, before)).toBe(false);
  });

  it('is due after the slot when never run', () => {
    expect(isDueAt(schedule(), null, after)).toBe(true);
  });

  it('is not due again once it has run since the slot opened', () => {
    const ranAt = new Date(2026, 4, 27, 2, 5, 0).toISOString();
    expect(isDueAt(schedule(), ranAt, after)).toBe(false);
  });

  it('is due again the next day even if it ran yesterday', () => {
    const ranYesterday = new Date(2026, 4, 26, 2, 5, 0).toISOString();
    expect(isDueAt(schedule(), ranYesterday, after)).toBe(true);
  });

  it('respects an allowed-days restriction', () => {
    // Wednesday is getDay() 3; restrict to Monday(1)/Friday(5) only.
    expect(isDueAt(schedule({ days: [1, 5] }), null, after)).toBe(false);
    expect(isDueAt(schedule({ days: [3] }), null, after)).toBe(true);
  });
});

describe('nextRunAt', () => {
  it('returns null when disabled', () => {
    expect(nextRunAt(schedule({ enabled: false }), new Date())).toBeNull();
  });

  it('returns today’s slot when it is still upcoming', () => {
    const now = new Date(2026, 4, 27, 1, 0, 0);
    const next = nextRunAt(schedule(), now);
    expect(next?.getDate()).toBe(27);
    expect(next?.getHours()).toBe(2);
  });

  it('rolls to tomorrow when today’s slot has passed', () => {
    const now = new Date(2026, 4, 27, 3, 0, 0);
    const next = nextRunAt(schedule(), now);
    expect(next?.getDate()).toBe(28);
    expect(next?.getHours()).toBe(2);
  });

  it('skips to the next allowed weekday', () => {
    // Wed 27th, restricted to Friday(5) only -> next is Fri 29th.
    const now = new Date(2026, 4, 27, 3, 0, 0);
    const next = nextRunAt(schedule({ days: [5] }), now);
    expect(next?.getDate()).toBe(29);
    expect(next?.getDay()).toBe(5);
  });
});

describe('shouldSkipUnchanged', () => {
  it('never skips when the toggle is off', () => {
    expect(shouldSkipUnchanged('aaa', 'aaa', false).skip).toBe(false);
  });

  it('builds anyway when the current HEAD is unknown', () => {
    expect(shouldSkipUnchanged(null, 'aaa', true).skip).toBe(false);
  });

  it('builds when no prior commit was recorded', () => {
    expect(shouldSkipUnchanged('aaa', null, true).skip).toBe(false);
  });

  it('skips when HEAD is unchanged since the last build', () => {
    const r = shouldSkipUnchanged('abc1234567', 'abc1234567', true);
    expect(r.skip).toBe(true);
    expect(r.reason).toMatch(/unchanged/i);
  });

  it('builds when HEAD has changed', () => {
    const r = shouldSkipUnchanged('newsha', 'oldsha', true);
    expect(r.skip).toBe(false);
    expect(r.reason).toMatch(/changed/i);
  });
});

describe('describeSchedule', () => {
  it('describes a disabled schedule', () => {
    expect(describeSchedule(schedule({ enabled: false }))).toMatch(/off/i);
  });

  it('describes a nightly (every-day) schedule', () => {
    expect(describeSchedule(schedule({ days: [] }))).toBe('Nightly at 02:00');
  });

  it('describes a weekday-restricted schedule', () => {
    expect(describeSchedule(schedule({ days: [1, 3, 5] }))).toBe('Mon, Wed, Fri at 02:00');
  });
});
