import { describe, it, expect } from 'vitest';
import { formatGold } from '@/components/modules/evaluator/EconomySimulatorView/helpers';

describe('formatGold unit rollover', () => {
  it('promotes a value that rounds up to the next unit instead of printing 1000 of the smaller one', () => {
    expect(formatGold(999.6)).toBe('1.0K');
    expect(formatGold(999_960)).toBe('1.0M');
    expect(formatGold(-999_960)).toBe('-1.0M');
  });

  it('keeps the ordinary bands', () => {
    expect(formatGold(0)).toBe('0');
    expect(formatGold(999.4)).toBe('999');
    expect(formatGold(1500)).toBe('1.5K');
    expect(formatGold(-1500)).toBe('-1.5K');
    expect(formatGold(2_500_000)).toBe('2.5M');
  });
});
