import { WEALTH_STACK_BREAKPOINT } from './constants';

/** Grid columns for the wealth Gini/histogram pair: two-up when wide, stacked below the breakpoint. Pure for unit-testing the reflow decision without a DOM. */
export function wealthGridClass(viewportWidth: number): string {
  return viewportWidth < WEALTH_STACK_BREAKPOINT ? 'grid-cols-1' : 'grid-cols-2';
}

/** Grid columns from the already-derived breakpoint boolean (`width >= WEALTH_STACK_BREAKPOINT`). Mirrors {@link wealthGridClass} so both stay in lockstep. */
export function wealthGridClassFromWide(wide: boolean): string {
  return wide ? 'grid-cols-2' : 'grid-cols-1';
}

/**
 * Reason the Run button is unavailable, or `null` when it's clickable. Pure so
 * the disabled state + tooltip can be unit-tested without the store. Listed in
 * priority order: an in-flight run, then a not-yet-loaded config, then any
 * out-of-range field edits the user must correct first.
 */
export function runBlockReason({
  isSimulating,
  hasConfig,
  invalidLabels,
}: {
  isSimulating: boolean;
  hasConfig: boolean;
  invalidLabels: string[];
}): string | null {
  if (isSimulating) return 'Simulation already running';
  if (!hasConfig) return 'Loading economy parameters…';
  if (invalidLabels.length > 0) {
    return `Fix out-of-range ${invalidLabels.length === 1 ? 'value' : 'values'}: ${invalidLabels.join(', ')}`;
  }
  return null;
}

/** Validate a raw draft against `[min, max]`; returns the reason it's rejected, or null. */
export function validateField(raw: string, min: number, max: number): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return `Enter ${min}–${max}`;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 'Numbers only';
  if (n < min) return `Below min — min is ${min}`;
  if (n > max) return `Above max — max is ${max}`;
  return null;
}

export function formatGold(amount: number): string {
  if (Math.abs(amount) >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return `${Math.round(amount)}`;
}
