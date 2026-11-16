import { describe, it, expect } from 'vitest';
import { rateVariant } from '@/components/modules/evaluator/PromptVersionTimeline/helpers';
import { MIN_TRIALS_PER_VARIANT } from '@/lib/prompt-evolution/verdict';
import type { VariantStats } from '@/types/prompt-evolution';

const stats = (trials: number, successRate: number): VariantStats => ({
  variantId: 'v', trials, successes: Math.round(trials * successRate), successRate, wins: 0, testCount: 0,
});

describe('rateVariant', () => {
  it('stays neutral below the per-arm trial floor', () => {
    expect(rateVariant(stats(MIN_TRIALS_PER_VARIANT - 1, 1))).toBe('default');
    expect(rateVariant(stats(1, 0))).toBe('default');
  });

  it('grades once the floor is met', () => {
    expect(rateVariant(stats(MIN_TRIALS_PER_VARIANT, 1))).toBe('success');
    expect(rateVariant(stats(10, 0.5))).toBe('warning');
    expect(rateVariant(stats(10, 0.1))).toBe('error');
  });

  it('is neutral with no trials', () => {
    expect(rateVariant(stats(0, 0))).toBe('default');
  });
});
