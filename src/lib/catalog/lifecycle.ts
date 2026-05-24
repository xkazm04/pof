import type { LifecycleState, TestResult } from '@/lib/catalog/types';

const ORDER: LifecycleState[] = ['planned', 'scaffolded', 'generated', 'wired', 'verified'];

/**
 * Structurally legal transition?  any → 'failed'; 'failed' → 'planned' (retry);
 * otherwise exactly one step forward along ORDER.
 */
export function canTransition(current: LifecycleState, next: LifecycleState): boolean {
  if (next === 'failed') return true;
  if (current === 'failed') return next === 'planned';
  const ci = ORDER.indexOf(current);
  const ni = ORDER.indexOf(next);
  if (ci < 0 || ni < 0) return false;
  return ni === ci + 1;
}

/**
 * The gate: returns the lifecycle to commit, or null to reject. `wired→verified`
 * additionally requires a passing functional test (the "compiles ≠ runs" rule).
 */
export function resolveTransition(
  current: LifecycleState,
  next: LifecycleState,
  testResult?: TestResult,
): LifecycleState | null {
  if (!canTransition(current, next)) return null;
  if (next === 'verified' && testResult !== 'pass') return null;
  return next;
}
