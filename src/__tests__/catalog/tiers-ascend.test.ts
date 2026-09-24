import { describe, expect, it } from 'vitest';
import { tiersAscend } from '@/lib/catalog/acceptance/tiersAscend';

describe('tiersAscend', () => {
  const check = tiersAscend('tiers');

  it('passes when unlock levels and maximum rolls are non-decreasing', () => {
    expect(check({
      tiers: [
        { tier: 'T3', minItemLevel: 1, valueMax: 5 },
        { tier: 'T2', minItemLevel: 20, valueMax: 11 },
        { tier: 'T1', minItemLevel: 20, valueMax: 20 },
      ],
    }).status).toBe('pass');
  });

  it('fails when a later tier unlocks earlier', () => {
    const result = check({
      tiers: [
        { tier: 'T2', minItemLevel: 20, valueMax: 11 },
        { tier: 'T1', minItemLevel: 10, valueMax: 20 },
      ],
    });
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('minItemLevel');
  });

  it('fails when a later tier has a lower maximum roll', () => {
    const result = check({
      tiers: [
        { tier: 'T2', minItemLevel: 20, valueMax: 11 },
        { tier: 'T1', minItemLevel: 40, valueMax: 10 },
      ],
    });
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('valueMax');
  });
});
