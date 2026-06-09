/**
 * Regression diff — compares a fresh deep-eval scan against the previous one so
 * that only what changed stands out, the way SonarQube's "New Code" period and
 * GitHub code-scanning PR checks do.
 *
 * Every current finding is tagged NEW (absent from the prior scan) or PERSISTING
 * (also present last time); prior findings no longer present are RESOLVED. The
 * comparison keys on the shared, line-insensitive {@link fingerprintFinding} so a
 * finding that merely shifted lines reads as persisting rather than churning into
 * one resolved + one new.
 */

import type { EvalFinding, FindingSeverity } from './finding-collector';
import { fingerprintFinding } from './finding-collector';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FindingStatus = 'new' | 'persisting' | 'resolved';

export type SeverityCounts = Record<FindingSeverity, number>;

/** A current-scan finding tagged with how it relates to the prior scan. */
export interface TaggedFinding extends EvalFinding {
  status: 'new' | 'persisting';
}

export interface RegressionSummary {
  new: SeverityCounts;
  resolved: SeverityCounts;
  persisting: SeverityCounts;
  newTotal: number;
  resolvedTotal: number;
  persistingTotal: number;
}

export interface RegressionDiff {
  /** Whether a previous scan existed to compare against (false on the first scan). */
  hasPrevious: boolean;
  /** Current findings, each tagged new | persisting. */
  tagged: TaggedFinding[];
  /** Prior findings (within scope) absent from the current scan. */
  resolved: EvalFinding[];
  /** Quick status lookup keyed by current finding id. */
  statusById: Record<string, 'new' | 'persisting'>;
  summary: RegressionSummary;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyCounts(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

function countBySeverity(findings: ReadonlyArray<{ severity: FindingSeverity }>): SeverityCounts {
  const counts = emptyCounts();
  for (const f of findings) counts[f.severity]++;
  return counts;
}

// ─── Diff ────────────────────────────────────────────────────────────────────

/**
 * Diff the current scan's findings against the previous scan's findings.
 *
 * @param previous  Prior-scan findings, or `null`/`undefined` if there is no
 *                  baseline yet (first scan). An empty array means a prior scan
 *                  that found nothing.
 * @param current   Current scan's (deduplicated) findings.
 * @param opts.scopeModuleIds  When only a subset of modules was re-evaluated,
 *                  restrict the comparison to those modules so untouched modules
 *                  aren't falsely reported as resolved.
 */
export function diffScans(
  previous: EvalFinding[] | null | undefined,
  current: EvalFinding[],
  opts?: { scopeModuleIds?: Iterable<string> },
): RegressionDiff {
  const hasPrevious = previous != null;
  const scope = opts?.scopeModuleIds ? new Set(opts.scopeModuleIds) : null;

  const previousScoped: EvalFinding[] = !previous
    ? []
    : scope
      ? previous.filter((f) => scope.has(f.moduleId))
      : previous;

  const previousFingerprints = new Set(previousScoped.map((f) => fingerprintFinding(f)));
  const currentFingerprints = new Set(current.map((f) => fingerprintFinding(f)));

  const tagged: TaggedFinding[] = current.map((f) => ({
    ...f,
    status: previousFingerprints.has(fingerprintFinding(f)) ? 'persisting' : 'new',
  }));

  const resolved = previousScoped.filter((f) => !currentFingerprints.has(fingerprintFinding(f)));

  const statusById: Record<string, 'new' | 'persisting'> = {};
  for (const t of tagged) statusById[t.id] = t.status;

  const newFindings = tagged.filter((t) => t.status === 'new');
  const persistingFindings = tagged.filter((t) => t.status === 'persisting');

  return {
    hasPrevious,
    tagged,
    resolved,
    statusById,
    summary: {
      new: countBySeverity(newFindings),
      resolved: countBySeverity(resolved),
      persisting: countBySeverity(persistingFindings),
      newTotal: newFindings.length,
      resolvedTotal: resolved.length,
      persistingTotal: persistingFindings.length,
    },
  };
}

/**
 * Build the next stored baseline after a (possibly partial) scan: replace the
 * findings of every re-evaluated module with the current ones, while keeping the
 * prior findings of modules that weren't part of this run. This keeps a
 * single-module re-eval from wiping the rest of the baseline.
 */
export function mergeBaseline(
  previous: EvalFinding[] | null | undefined,
  current: EvalFinding[],
  scopeModuleIds: Iterable<string>,
): EvalFinding[] {
  const scope = new Set(scopeModuleIds);
  const kept = (previous ?? []).filter((f) => !scope.has(f.moduleId));
  return [...kept, ...current];
}
