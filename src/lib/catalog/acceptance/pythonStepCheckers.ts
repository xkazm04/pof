/**
 * Acceptance checkers for python-pipeline-driven steps.
 *
 * The player-movement pipeline's Produce calls a Python module on the editor
 * thread via /pof/python/run. The module always returns:
 *
 *     {created: [...], skipped: [...], failed: [...], ...module-specific...}
 *
 * These checkers read that envelope from the persisted artifact data.
 */

import type { Checker } from './types';

/**
 * L2 checker: the python step succeeded — no entries in `failed`, and at least one entry
 * across created+skipped (so we know it actually ran, not that we never tried).
 *
 * @param label  Human-readable label shown in the acceptance banner.
 * @param expectAtLeast Minimum entries across created+skipped. Defaults to 1.
 */
export function pythonStepSuccess(label: string, expectAtLeast = 1): Checker {
  return (data) => {
    const failed = Array.isArray(data.failed) ? (data.failed as unknown[]) : [];
    const created = Array.isArray(data.created) ? (data.created as unknown[]) : [];
    const skipped = Array.isArray(data.skipped) ? (data.skipped as unknown[]) : [];
    const total = created.length + skipped.length;

    if (data.created === undefined && data.failed === undefined && data.skipped === undefined) {
      return { label, tier: 'L2', status: 'pending', detail: 'not yet run' };
    }
    if (failed.length > 0) {
      return {
        label,
        tier: 'L2',
        status: 'fail',
        detail: `${failed.length} failure${failed.length === 1 ? '' : 's'}`,
        reason: failed.map(String).join(' · '),
      };
    }
    if (total < expectAtLeast) {
      return {
        label,
        tier: 'L2',
        status: 'pending',
        detail: `${total} / ${expectAtLeast}`,
        reason: 'fewer artifacts than expected — re-run or check inputs',
      };
    }
    return {
      label,
      tier: 'L2',
      status: 'pass',
      detail: created.length > 0 ? `+${created.length} new` : `${skipped.length} already up to date`,
    };
  };
}

/**
 * L2 checker for verify_mesh-style modules that return {ok: bool, issues: [...]}.
 */
export function pythonStepOk(label: string): Checker {
  return (data) => {
    if (data.ok === undefined) {
      return { label, tier: 'L2', status: 'pending', detail: 'not yet run' };
    }
    const issues = Array.isArray(data.issues) ? (data.issues as unknown[]) : [];
    if (data.ok === true) {
      return { label, tier: 'L2', status: 'pass', detail: 'all checks pass' };
    }
    return {
      label,
      tier: 'L2',
      status: 'fail',
      detail: `${issues.length} issue${issues.length === 1 ? '' : 's'}`,
      reason: issues.map(String).join(' · '),
    };
  };
}

/**
 * L1 checker: human selection (the user has confirmed the Mixamo source files are present).
 */
export function humanConfirmed(label: string, field: string): Checker {
  return (data) => {
    const ok = data[field] === true;
    return {
      label,
      tier: 'L1',
      status: ok ? 'pass' : 'pending',
      detail: ok ? 'confirmed' : 'awaiting user confirmation',
    };
  };
}
