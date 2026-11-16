import { describe, it, expect } from 'vitest';
import { formatNumber } from '@/components/modules/evaluator/EconomyRunsStrip';
import { formatGold } from '@/components/modules/evaluator/EconomySimulatorView/helpers';

describe('EconomyRunsStrip formatNumber', () => {
  it.each([999.6, 1500, 1234567, -2e6, 999_960])('agrees with formatGold for %s', (n) => {
    expect(formatNumber(n)).toBe(formatGold(n));
  });

  it('keeps 2-decimal precision for small deltas (Gini)', () => {
    expect(formatNumber(0.04)).toBe('0.04');
    expect(formatNumber(-3.456)).toBe('-3.46');
  });
});
