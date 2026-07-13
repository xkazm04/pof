/**
 * Feature reconciliation matching — pure + testable.
 *
 * The executor reports feature results by NAME. We must map each reported name
 * back to a planned feature to update its status. The old matcher used fuzzy
 * substring `includes`, which mis-matched features ("attack" ⊂ "attack combo")
 * and, when nothing matched, force-passed everything. This matcher is strict:
 * exact match on a NORMALIZED key (case / whitespace / punctuation folded), on
 * either the feature's `name` or its `moduleId::name` id. No fuzzy fallback —
 * an unmatched report leaves the plan feature untouched (the caller logs it and
 * leaves the feature UNVERIFIED rather than silently passing it).
 */

/** Fold case, punctuation and whitespace so "Attack Combo!" == "attack  combo". */
export function normalizeFeatureKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export interface Matchable {
  id: string;
  name: string;
}

/**
 * Build a normalized lookup from a list of planned features. Names win over ids
 * on collision (a feature's id key is only added if it does not shadow another
 * feature's name key), so id-form reports resolve without clobbering name-form.
 */
export function buildFeatureIndex<T extends Matchable>(features: T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const f of features) {
    const nameKey = normalizeFeatureKey(f.name);
    if (nameKey) index.set(nameKey, f);
  }
  for (const f of features) {
    const idKey = normalizeFeatureKey(f.id);
    if (idKey && !index.has(idKey)) index.set(idKey, f);
  }
  return index;
}

/** Exact/normalized match only — no fuzzy substring. Returns null if unmatched. */
export function matchFeature<T extends Matchable>(
  index: Map<string, T>,
  reportedName: string,
): T | null {
  return index.get(normalizeFeatureKey(reportedName)) ?? null;
}

// ── Reconciliation (pure, testable) ─────────────────────────────────────────

/** The subset of a PlannedFeature this reconciler mutates. */
export interface ReconcilableFeature extends Matchable {
  status: string;
  quality: number | null;
  lastSession: number | null;
  failReason?: string;
}

/** A feature result as reported by the executor session. */
export interface ReportedFeature {
  name: string;
  status: 'pass' | 'fail';
  quality: number;
  notes: string;
}

/**
 * Apply executor-reported feature results to planned features by EXACT
 * normalized match only. Returns how many resolved and the names that did NOT.
 * Crucially: an unmatched report changes NOTHING (no force-pass) — the caller
 * decides how to surface the mismatch and the plan feature stays whatever it was.
 */
export function reconcileReportedFeatures<T extends ReconcilableFeature>(
  features: T[],
  reported: ReportedFeature[],
  iteration: number,
): { matched: number; unmatched: string[] } {
  const index = buildFeatureIndex(features);
  let matched = 0;
  const unmatched: string[] = [];
  for (const pf of reported) {
    const planFeature = matchFeature(index, pf.name);
    if (planFeature) {
      planFeature.status = pf.status === 'pass' ? 'pass' : 'fail';
      planFeature.quality = pf.quality;
      planFeature.lastSession = iteration;
      if (pf.status === 'fail') planFeature.failReason = pf.notes;
      matched++;
    } else {
      unmatched.push(pf.name);
    }
  }
  return { matched, unmatched };
}

/**
 * A session ran over the area, so any feature it never reported on is UNVERIFIED
 * — never a silent pass. Flips 'pending' → 'unverified' (with a reason) and
 * returns the count flipped. Idempotent for already-terminal features.
 */
export function markUnreportedUnverified<T extends ReconcilableFeature>(features: T[]): number {
  let flipped = 0;
  for (const f of features) {
    if (f.status === 'pending') {
      f.status = 'unverified';
      f.failReason = f.failReason ?? 'Not reported by executor session';
      flipped++;
    }
  }
  return flipped;
}
