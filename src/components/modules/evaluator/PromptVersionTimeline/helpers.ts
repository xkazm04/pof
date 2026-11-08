import { MIN_TRIALS_PER_VARIANT } from '@/lib/prompt-evolution/verdict';
import type { VariantStats } from '@/types/prompt-evolution';

/**
 * Success-rate → badge variant (text carries the % so meaning isn't color-only).
 * Below the per-arm trial floor the rate is not graded: 1/1 is not a green result.
 */
export function rateVariant(stats: VariantStats): 'success' | 'warning' | 'error' | 'default' {
  if (stats.trials < MIN_TRIALS_PER_VARIANT) return 'default';
  if (stats.successRate >= 0.7) return 'success';
  if (stats.successRate >= 0.4) return 'warning';
  return 'error';
}
