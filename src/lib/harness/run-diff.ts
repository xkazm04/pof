/**
 * Pure run-to-run comparison. Compares two finalized harness runs ("a" = base,
 * "b" = head) and returns area-level regressions/improvements + aggregate deltas
 * (pass-rate, cost, duration, sessions). UI and API consume the result; the
 * function never touches the DB so it's trivially testable.
 */

import type { GamePlan, ProgressEntry, AreaStatus } from './types';
import type { HarnessRunDetail } from '@/lib/harness-runs-db';

export type AreaChangeKind =
  | 'unchanged'
  | 'improved'      // pass-rate went up OR went from failed → completed
  | 'regressed'     // pass-rate went down OR went from completed → failed
  | 'added'         // present in b but not a
  | 'removed';      // present in a but not b

export interface AreaDiffEntry {
  areaId: string;
  label: string;
  kind: AreaChangeKind;
  statusA: AreaStatus | null;
  statusB: AreaStatus | null;
  passRateA: number; // 0-1 over features
  passRateB: number;
  passRateDelta: number; // b - a
  passingA: number;
  passingB: number;
  totalA: number;
  totalB: number;
}

export interface RunDiff {
  base: { runId: string; label: string; startedAt: string };
  head: { runId: string; label: string; startedAt: string };
  passRateA: number; // 0-100
  passRateB: number;
  passRateDelta: number;
  passingDelta: number;
  totalFeaturesDelta: number;
  costDeltaUsd: number;
  sessionDelta: number;
  durationMsDelta: number | null;
  iterationDelta: number;
  areas: AreaDiffEntry[];
  regressed: AreaDiffEntry[];
  improved: AreaDiffEntry[];
  added: AreaDiffEntry[];
  removed: AreaDiffEntry[];
  /** Areas whose progress log shows new failures in b vs a. Derived from progress entries. */
  newFailureAreas: string[];
}

function areaRate(
  plan: GamePlan | null,
  areaId: string,
): { rate: number; passing: number; total: number; status: AreaStatus | null; label: string } {
  if (!plan) return { rate: 0, passing: 0, total: 0, status: null, label: areaId };
  const area = plan.areas.find((a) => a.id === areaId);
  if (!area) return { rate: 0, passing: 0, total: 0, status: null, label: areaId };
  const passing = area.features.filter((f) => f.status === 'pass').length;
  const total = area.features.length;
  return {
    rate: total > 0 ? passing / total : 0,
    passing,
    total,
    status: area.status,
    label: area.label,
  };
}

function classify(a: AreaStatus | null, b: AreaStatus | null, rateA: number, rateB: number): AreaChangeKind {
  if (a === null && b !== null) return 'added';
  if (a !== null && b === null) return 'removed';
  // Status transition dominates
  if (a !== 'completed' && b === 'completed') return 'improved';
  if (a === 'completed' && b === 'failed') return 'regressed';
  if (a === 'completed' && b !== 'completed' && b !== 'in-progress') return 'regressed';
  if (rateB > rateA + 1e-6) return 'improved';
  if (rateB < rateA - 1e-6) return 'regressed';
  return 'unchanged';
}

function failureAreaIds(progress: ProgressEntry[]): Set<string> {
  const set = new Set<string>();
  for (const p of progress) {
    if (p.outcome !== 'success') set.add(p.areaId);
  }
  return set;
}

function safeLabel(d: HarnessRunDetail): string {
  return d.themeDirective?.trim()
    ? `${d.projectName} — ${d.themeDirective.slice(0, 40)}`
    : d.projectName;
}

/**
 * Build the diff. Both inputs must be hydrated detail rows (with plan + progress);
 * pass-rate, cost and duration deltas read from the row metadata and area
 * comparisons hydrate from `plan.areas`.
 */
export function diffRuns(a: HarnessRunDetail, b: HarnessRunDetail): RunDiff {
  const idsA = new Set((a.plan?.areas ?? []).map((x) => x.id));
  const idsB = new Set((b.plan?.areas ?? []).map((x) => x.id));
  const allIds = new Set([...idsA, ...idsB]);

  const entries: AreaDiffEntry[] = [];
  for (const id of allIds) {
    const ra = areaRate(a.plan, id);
    const rb = areaRate(b.plan, id);
    entries.push({
      areaId: id,
      label: rb.label || ra.label || id,
      kind: classify(ra.status, rb.status, ra.rate, rb.rate),
      statusA: ra.status,
      statusB: rb.status,
      passRateA: ra.rate,
      passRateB: rb.rate,
      passRateDelta: rb.rate - ra.rate,
      passingA: ra.passing,
      passingB: rb.passing,
      totalA: ra.total,
      totalB: rb.total,
    });
  }
  entries.sort((x, y) => x.label.localeCompare(y.label));

  const failuresA = failureAreaIds(a.progress);
  const failuresB = failureAreaIds(b.progress);
  const newFailureAreas = [...failuresB].filter((id) => !failuresA.has(id));

  return {
    base: { runId: a.runId, label: safeLabel(a), startedAt: a.startedAt },
    head: { runId: b.runId, label: safeLabel(b), startedAt: b.startedAt },
    passRateA: a.passRate,
    passRateB: b.passRate,
    passRateDelta: b.passRate - a.passRate,
    passingDelta: b.passingFeatures - a.passingFeatures,
    totalFeaturesDelta: b.totalFeatures - a.totalFeatures,
    costDeltaUsd: b.spentUsd - a.spentUsd,
    sessionDelta: b.sessions - a.sessions,
    durationMsDelta:
      a.durationMs != null && b.durationMs != null ? b.durationMs - a.durationMs : null,
    iterationDelta: b.iteration - a.iteration,
    areas: entries,
    regressed: entries.filter((e) => e.kind === 'regressed'),
    improved: entries.filter((e) => e.kind === 'improved'),
    added: entries.filter((e) => e.kind === 'added'),
    removed: entries.filter((e) => e.kind === 'removed'),
    newFailureAreas,
  };
}
