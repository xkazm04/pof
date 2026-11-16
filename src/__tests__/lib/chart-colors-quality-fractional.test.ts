import { describe, it, expect } from 'vitest';
import { qualityColor, STATUS_WARNING, STATUS_LIME } from '@/lib/chart-colors';

describe('qualityColor between whole scores', () => {
  it('reads a fractional 1-5 score as its nearest band, not undefined', () => {
    expect(qualityColor(3.4)).toBe(STATUS_WARNING);
    expect(qualityColor(3.6)).toBe(STATUS_LIME);
  });

  it('reads NaN as unscored', () => {
    expect(qualityColor(Number.NaN)).toBe('var(--text-muted)');
  });
});
