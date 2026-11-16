import { describe, it, expect } from 'vitest';
import { createABTest, recordTrial, evaluateTestWithBasis } from '@/lib/prompt-evolution/ab-testing';
import type { ABTest } from '@/types/prompt-evolution';

/**
 * A test that reaches its trial ceiling with no detected difference concludes as
 * "no difference at this sample size" (winnerId null), not as a crowned coin flip.
 */
function arms(
  a: { trials: number; wins: number; ms?: number },
  b: { trials: number; wins: number; ms?: number },
  minTrials = 5,
): ABTest {
  let t = createABTest('arpg-combat', 'combat-hit-detect', 'var-a', 'var-b', minTrials);
  for (let i = 0; i < a.trials; i++) t = recordTrial(t, 'A', i < a.wins, a.ms ?? 1000);
  for (let i = 0; i < b.trials; i++) t = recordTrial(t, 'B', i < b.wins, b.ms ?? 1000);
  return t;
}

describe('ceiling reached at band none', () => {
  it('50% vs 55% at 20 trials per arm concludes with no winner', () => {
    const out = evaluateTestWithBasis(arms({ trials: 20, wins: 10 }, { trials: 20, wins: 11 })).test;
    expect(out.status).toBe('concluded');
    expect(out.winnerId).toBeNull();
    expect(out.confidence).toBeLessThan(0.8);
  });

  it('a duration tie at the ceiling concludes with no winner', () => {
    const out = evaluateTestWithBasis(
      arms({ trials: 12, wins: 6, ms: 900 }, { trials: 12, wins: 6, ms: 300 }, 5),
    ).test;
    expect(out.status).toBe('concluded');
    expect(out.winnerId).toBeNull();
  });

  it('0% vs 0% at the ceiling concludes with no winner', () => {
    const out = evaluateTestWithBasis(arms({ trials: 10, wins: 0 }, { trials: 10, wins: 0 })).test;
    expect(out.status).toBe('concluded');
    expect(out.winnerId).toBeNull();
  });

  it('still crowns a winner when confidence clears the weak band', () => {
    const out = evaluateTestWithBasis(arms({ trials: 6, wins: 6 }, { trials: 6, wins: 2 }, 3)).test;
    expect(out.status).toBe('concluded');
    expect(out.winnerId).toBe('var-a');
  });
});
