// Pure classification of a test-gate verdict change (no I/O). Shared by the
// emit site (drainOne), the webhook dispatcher, and the config UI so the meaning
// of "regression" / "failure" is defined once.

import type { AcceptanceStatus } from '@/lib/catalog/acceptance/types';

/** The gate's status before the drain. `null` = there was no prior artifact. */
export type VerdictFrom = AcceptanceStatus | null;
/** A drained gate only ever resolves to pass or fail. */
export type VerdictTo = 'pass' | 'fail';

export interface VerdictChange {
  /** The verdict actually moved (`from !== to`). Only changes are announced. */
  changed: boolean;
  /** A previously-passing gate now fails — the classic CI regression. */
  regression: boolean;
  /** The gate resolved to fail from any non-fail prior (deferred/pending/pass/none). */
  failure: boolean;
  /** The gate resolved to pass from a non-pass prior — recovery / good news. */
  recovery: boolean;
}

/** Classify a `from → to` transition into the notable categories. */
export function classifyVerdictChange(from: VerdictFrom, to: VerdictTo): VerdictChange {
  const changed = from !== to;
  return {
    changed,
    regression: changed && to === 'fail' && from === 'pass',
    failure: changed && to === 'fail',
    recovery: changed && to === 'pass',
  };
}

/** Which verdict changes an operator wants pinged about. */
export type GateNotifyMode = 'all' | 'failures' | 'regressions';

export const GATE_NOTIFY_MODES: readonly GateNotifyMode[] = ['all', 'failures', 'regressions'];

/**
 * Pure gate: does this change clear the configured notification threshold?
 * - `all` — any verdict change (incl. recoveries)
 * - `failures` — any change that lands on fail (deferred→fail or pass→fail)
 * - `regressions` — only a previously-passing gate now failing
 */
export function shouldNotify(mode: GateNotifyMode, change: VerdictChange): boolean {
  if (!change.changed) return false;
  switch (mode) {
    case 'all': return true;
    case 'failures': return change.failure;
    case 'regressions': return change.regression;
    default: return false;
  }
}
