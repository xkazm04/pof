import type { VariantStats } from '@/types/prompt-evolution';

/** Success-rate → badge variant (text carries the % so meaning isn't color-only). */
export function rateVariant(stats: VariantStats): 'success' | 'warning' | 'error' | 'default' {
  if (stats.trials === 0) return 'default';
  if (stats.successRate >= 0.7) return 'success';
  if (stats.successRate >= 0.4) return 'warning';
  return 'error';
}
