/**
 * Review delta — WHICH features a review (or fix) moved, derived from the
 * per-feature states two consecutive `review_snapshots` rows recorded.
 *
 * The count trend (sparkline) shows that a module dipped; it cannot say that
 * "Dodge roll" fell from implemented to partial. Each snapshot now carries its
 * `feature_states` ([{ featureName, status, quality, source }]), and this module
 * diffs a pair of them.
 *
 * HONESTY RULES
 *  - Statuses rank missing < partial < implemented < improved. `unknown` is NOT a
 *    rung: unknown -> X is `assessed` (a first verdict, never an improvement) and
 *    X -> unknown is `cleared` (a lost verdict, never a measured regression).
 *  - A quality move is measured only when BOTH sides carry a score.
 *  - A snapshot written before the column existed (NULL / unparseable states)
 *    makes the pair `measured: false` with a reason. It is never diffed as an
 *    empty list, which would read as "nothing changed".
 *
 * Pure (no DB, no React): the server derives it in `feature-matrix-db`, the
 * client imports the types and the summary helpers.
 */
import type { FeatureSource, FeatureStatus } from '@/types/feature-matrix';

export interface FeatureStateEntry {
  featureName: string;
  status: FeatureStatus;
  quality: number | null;
  source?: FeatureSource;
}

export interface StatusMove {
  featureName: string;
  from: FeatureStatus;
  to: FeatureStatus;
}

export interface QualityMove {
  featureName: string;
  from: number;
  to: number;
}

export interface FeatureStateDiff {
  regressed: StatusMove[];
  improved: StatusMove[];
  qualityDropped: QualityMove[];
  qualityRaised: QualityMove[];
  /** unknown -> a verdict: a first assessment, not an improvement. */
  assessed: StatusMove[];
  /** a verdict -> unknown: the verdict was lost, not measured as worse. */
  cleared: StatusMove[];
  added: FeatureStateEntry[];
  removed: FeatureStateEntry[];
}

export type ReviewDelta =
  | ({ measured: true; fromReviewedAt: string; toReviewedAt: string } & FeatureStateDiff)
  | { measured: false; reason: string; fromReviewedAt: string | null; toReviewedAt: string | null };

/** One side of a pair: a snapshot's timestamp and its states (`null` = not recorded). */
export interface SnapshotStates {
  reviewedAt: string;
  featureStates: FeatureStateEntry[] | null;
}

const RANK: Partial<Record<FeatureStatus, number>> = { missing: 0, partial: 1, implemented: 2, improved: 3 };

export function diffFeatureStates(prev: FeatureStateEntry[], next: FeatureStateEntry[]): FeatureStateDiff {
  const diff: FeatureStateDiff = {
    regressed: [], improved: [], qualityDropped: [], qualityRaised: [],
    assessed: [], cleared: [], added: [], removed: [],
  };
  const before = new Map(prev.map((e) => [e.featureName, e]));
  const nextNames = new Set(next.map((e) => e.featureName));

  for (const now of next) {
    const was = before.get(now.featureName);
    if (!was) {
      diff.added.push(now);
      continue;
    }
    if (was.status !== now.status) {
      const move: StatusMove = { featureName: now.featureName, from: was.status, to: now.status };
      const a = RANK[was.status];
      const b = RANK[now.status];
      if (a === undefined) diff.assessed.push(move);
      else if (b === undefined) diff.cleared.push(move);
      else if (b < a) diff.regressed.push(move);
      else diff.improved.push(move);
    }
    if (was.quality != null && now.quality != null && was.quality !== now.quality) {
      const move: QualityMove = { featureName: now.featureName, from: was.quality, to: now.quality };
      (now.quality < was.quality ? diff.qualityDropped : diff.qualityRaised).push(move);
    }
  }
  for (const was of prev) {
    if (!nextNames.has(was.featureName)) diff.removed.push(was);
  }
  return diff;
}

/** Parse a stored `feature_states` value. NULL or corrupt -> `null` (unknown), never `[]`. */
export function parseFeatureStates(raw: string | null | undefined): FeatureStateEntry[] | null {
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeatureStateEntry[]) : null;
  } catch {
    return null;
  }
}

/** Delta of the newest pair (`prev` older, `next` newest). */
export function deriveReviewDelta(prev: SnapshotStates | undefined, next: SnapshotStates | undefined): ReviewDelta {
  const fromReviewedAt = prev?.reviewedAt ?? null;
  const toReviewedAt = next?.reviewedAt ?? null;
  const unmeasured = (reason: string): ReviewDelta => ({ measured: false, reason, fromReviewedAt, toReviewedAt });
  if (!next) return unmeasured('No review snapshot exists for this module yet.');
  if (!prev) return unmeasured('Only one review snapshot exists, so there is nothing to compare it with yet.');
  if (!prev.featureStates) {
    return unmeasured(
      `The previous snapshot (${prev.reviewedAt}) predates per-feature capture, so which features moved is not known.`,
    );
  }
  if (!next.featureStates) {
    return unmeasured(`The latest snapshot (${next.reviewedAt}) was recorded without per-feature states.`);
  }
  return {
    measured: true,
    fromReviewedAt: prev.reviewedAt,
    toReviewedAt: next.reviewedAt,
    ...diffFeatureStates(prev.featureStates, next.featureStates),
  };
}

/** "1 regressed, 0 improved" (+ quality drops / first assessments when present). */
export function summarizeDelta(delta: ReviewDelta): string {
  if (!delta.measured) return delta.reason;
  const parts = [`${delta.regressed.length} regressed, ${delta.improved.length} improved`];
  if (delta.qualityDropped.length) parts.push(`${delta.qualityDropped.length} quality dropped`);
  if (delta.assessed.length) parts.push(`${delta.assessed.length} newly assessed`);
  if (delta.cleared.length) parts.push(`${delta.cleared.length} verdict cleared`);
  return parts.join(', ');
}

/** 'warning' when the review measured something getting worse. */
export function deltaToastType(delta: ReviewDelta): 'success' | 'warning' {
  return delta.measured && (delta.regressed.length > 0 || delta.qualityDropped.length > 0) ? 'warning' : 'success';
}

/** Names of every feature the delta moved (status, quality, verdict, added). Empty when unmeasured. */
export function changedFeatureNames(delta: ReviewDelta | null | undefined): Set<string> {
  const names = new Set<string>();
  if (!delta?.measured) return names;
  for (const list of [delta.regressed, delta.improved, delta.qualityDropped, delta.qualityRaised, delta.assessed, delta.cleared, delta.added]) {
    for (const m of list) names.add(m.featureName);
  }
  return names;
}
