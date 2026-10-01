/**
 * Cross-module overlap TWINS - pure (no DB / no React).
 *
 * `analyzeOverlaps` reports pairs of features defined in two modules (most are the
 * same name, e.g. arpg-animation / animations 'Animation state machine'). Each copy
 * carries its own feature-matrix status, so a pair is a question the matrix can
 * answer: do the twins agree? `classifyTwin` reads both statuses through the one done
 * rule (`isFeatureDone`) and names which twin(s) a review should look at.
 *
 * Read-only and keyed by module + feature name (`moduleId::featureName`, the matrix
 * key): it never writes or copies a status from one twin onto the other.
 */

import { isFeatureDone } from '@/lib/feature-done';
import type { OverlapPair } from '@/lib/overlap-detection';

export type TwinKind = 'diverged' | 'unreviewed' | 'agreed-open' | 'agreed-done';

export type TwinPairRef = Pick<OverlapPair, 'moduleA' | 'featureA' | 'moduleB' | 'featureB'>;

export interface TwinStatus {
  kind: TwinKind;
  keyA: string;
  keyB: string;
  /** Raw matrix status per side (null = no row). */
  statusA: string | null;
  statusB: string | null;
  /** The done twin of a diverged pair (null otherwise). */
  leadingKey: string | null;
  /** Twins a review should look at, sorted: the lagging one, or every unreviewed one. */
  reviewKeys: string[];
}

export interface TwinRow {
  overlap: OverlapPair;
  /** null while the statuses are not readable (loading / failed) - never a guess. */
  twin: TwinStatus | null;
}

export function twinKey(moduleId: string, featureName: string): string {
  return `${moduleId}::${featureName}`;
}

/** Split a `moduleId::featureName` key (feature names never contain '::'). */
export function splitTwinKey(key: string): { moduleId: string; featureName: string } {
  const i = key.indexOf('::');
  return { moduleId: key.slice(0, i), featureName: key.slice(i + 2) };
}

const isUnreviewed = (status: string | null) => status === null || status === 'unknown';

export function classifyTwin(pair: TwinPairRef, statusMap: ReadonlyMap<string, string>): TwinStatus {
  const keyA = twinKey(pair.moduleA, pair.featureA);
  const keyB = twinKey(pair.moduleB, pair.featureB);
  const statusA = statusMap.get(keyA) ?? null;
  const statusB = statusMap.get(keyB) ?? null;
  const doneA = isFeatureDone(statusA);
  const doneB = isFeatureDone(statusB);
  const base = { keyA, keyB, statusA, statusB };

  if (doneA !== doneB) {
    return { ...base, kind: 'diverged', leadingKey: doneA ? keyA : keyB, reviewKeys: [doneA ? keyB : keyA] };
  }
  if (doneA) return { ...base, kind: 'agreed-done', leadingKey: null, reviewKeys: [] };

  const unreviewed = [isUnreviewed(statusA) ? keyA : null, isUnreviewed(statusB) ? keyB : null]
    .filter((k): k is string => k !== null)
    .sort();
  if (unreviewed.length > 0) return { ...base, kind: 'unreviewed', leadingKey: null, reviewKeys: unreviewed };
  return { ...base, kind: 'agreed-open', leadingKey: null, reviewKeys: [] };
}

const KIND_RANK: Record<TwinKind, number> = { diverged: 0, unreviewed: 1, 'agreed-open': 2, 'agreed-done': 3 };

/** Divergence first, then unreviewed, then agreed; similarity desc within a kind.
 *  Rows without a readable twin (statuses not loaded) order by similarity alone. */
export function orderTwins<R extends TwinRow>(rows: readonly R[]): R[] {
  const rank = (r: TwinRow) => (r.twin ? KIND_RANK[r.twin.kind] : 0);
  return [...rows].sort((a, b) => rank(a) - rank(b) || b.overlap.similarity - a.overlap.similarity);
}

/** Classify every overlap (or none, when statuses are unreadable) and order them. */
export function buildTwinRows(
  overlaps: readonly OverlapPair[],
  statusMap: ReadonlyMap<string, string> | null,
): TwinRow[] {
  return orderTwins(overlaps.map((overlap) => ({
    overlap,
    twin: statusMap ? classifyTwin(overlap, statusMap) : null,
  })));
}
