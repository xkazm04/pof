import { describe, it, expect, afterAll } from 'vitest';
import { parseDateInput, formatDateInput, toLocalNoon } from '@/lib/roadmap-dates';

/**
 * Regression coverage for the CalendarRoadmapView off-by-one bug.
 *
 * The original code built the date <input> value with toISOString() (UTC) but
 * saved the picked value with `new Date(value + 'T00:00:00')` (local). For users
 * east/west of UTC those two interpretations disagree, silently shifting a
 * deadline by a day. The fix anchors every conversion to LOCAL noon, which can
 * never cross a calendar-day boundary regardless of the user's offset.
 */

const ORIGINAL_TZ = process.env.TZ;
const ZONES = ['UTC', 'America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];

afterAll(() => { process.env.TZ = ORIGINAL_TZ; });

describe('parseDateInput', () => {
  it('parses a YYYY-MM-DD string to LOCAL noon (never midnight)', () => {
    const d = parseDateInput('2026-05-24');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // May (0-based)
    expect(d.getDate()).toBe(24);
    expect(d.getHours()).toBe(12); // noon anchor keeps the day stable under any offset
  });
});

describe('formatDateInput', () => {
  it('formats from LOCAL calendar components, not UTC', () => {
    expect(formatDateInput(new Date(2026, 4, 24, 12, 0, 0))).toBe('2026-05-24');
  });
});

describe('format/parse round-trip is timezone-stable', () => {
  for (const tz of ZONES) {
    it(`preserves the calendar day in ${tz}`, () => {
      process.env.TZ = tz;
      for (const s of ['2026-05-24', '2026-01-01', '2026-12-31', '2026-03-08']) {
        expect(formatDateInput(parseDateInput(s))).toBe(s);
      }
    });
  }
});

describe('toLocalNoon', () => {
  it('snaps an instant to local noon of the same calendar day', () => {
    process.env.TZ = 'America/New_York';
    const noon = toLocalNoon(new Date(2026, 4, 24, 3, 17, 42));
    expect(noon.getHours()).toBe(12);
    expect(noon.getMinutes()).toBe(0);
    expect(noon.getSeconds()).toBe(0);
    expect(noon.getDate()).toBe(24);
  });

  it('a noon-anchored ISO string round-trips to the same local day in every timezone', () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      const iso = toLocalNoon(new Date(2026, 4, 24)).toISOString();
      expect(formatDateInput(new Date(iso))).toBe('2026-05-24');
    }
  });
});
