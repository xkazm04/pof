import { describe, it, expect } from 'vitest';
import {
  letterGrade,
  gradeBandLabel,
  gradeBandCaption,
  formatSince,
} from '@/lib/consistency-grade';

describe('letterGrade', () => {
  it('maps scores to A/B/C/D/F at the standard 90/80/70/60 thresholds', () => {
    expect(letterGrade(100)).toBe('A');
    expect(letterGrade(90)).toBe('A');
    expect(letterGrade(89)).toBe('B');
    expect(letterGrade(80)).toBe('B');
    expect(letterGrade(79)).toBe('C');
    expect(letterGrade(70)).toBe('C');
    expect(letterGrade(69)).toBe('D');
    expect(letterGrade(60)).toBe('D');
    expect(letterGrade(59)).toBe('F');
    expect(letterGrade(0)).toBe('F');
  });
});

describe('gradeBandLabel', () => {
  it('aligns the qualitative band with the success/warning/error color bands', () => {
    expect(gradeBandLabel(80)).toBe('Healthy');
    expect(gradeBandLabel(79)).toBe('Needs attention');
    expect(gradeBandLabel(50)).toBe('Needs attention');
    expect(gradeBandLabel(49)).toBe('Critical');
  });
});

describe('gradeBandCaption', () => {
  it('returns a distinct caption per band', () => {
    expect(gradeBandCaption(85)).not.toBe(gradeBandCaption(60));
    expect(gradeBandCaption(60)).not.toBe(gradeBandCaption(30));
    expect(gradeBandCaption(85)).toMatch(/well-aligned/i);
  });
});

describe('formatSince', () => {
  const now = new Date('2026-05-24T12:00:00'); // a Sunday

  it('reports same-day scans as "earlier today"', () => {
    expect(formatSince('2026-05-24T08:00:00', now)).toBe('since earlier today');
  });

  it('reports a one-day gap as "yesterday"', () => {
    expect(formatSince('2026-05-23T08:00:00', now)).toBe('since yesterday');
  });

  it('names the weekday for gaps within the last week', () => {
    // 2026-05-19 is a Tuesday → "since Tuesday" (assert via locale to stay env-robust)
    const weekday = new Date('2026-05-19T08:00:00').toLocaleDateString(undefined, { weekday: 'long' });
    expect(formatSince('2026-05-19T08:00:00', now)).toBe(`since ${weekday}`);
  });

  it('falls back to a calendar date beyond a week', () => {
    expect(formatSince('2026-05-01T08:00:00', now)).toMatch(/^since /);
    expect(formatSince('2026-05-01T08:00:00', now)).not.toMatch(/today|yesterday/);
  });

  it('returns empty string for an invalid timestamp', () => {
    expect(formatSince('not-a-date', now)).toBe('');
  });
});
