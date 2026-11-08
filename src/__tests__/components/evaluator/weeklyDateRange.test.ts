import { describe, it, expect } from 'vitest';
import { formatDateRange } from '@/components/modules/evaluator/WeeklyDigestView/helpers';

describe('formatDateRange', () => {
  it('names both years when the week crosses New Year', () => {
    expect(formatDateRange('2025-12-29', '2026-01-05')).toBe('Dec 29, 2025 — Jan 4, 2026');
  });
  it('names one year for a week inside a year', () => {
    expect(formatDateRange('2026-09-28', '2026-10-05')).toBe('Sep 28 — Oct 4, 2026');
  });
});
