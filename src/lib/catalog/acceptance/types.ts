/** The acceptance ladder. Higher tiers prove more (data → render). */
export type AcceptanceTier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type AcceptanceStatus = 'pass' | 'pending' | 'fail' | 'deferred';

export interface AcceptanceResult {
  label: string;
  status: AcceptanceStatus;
  tier: AcceptanceTier;
  detail: string;
  /** Why it failed or was deferred (Rule 4 — never fail/skip silently). */
  reason?: string;
}

/**
 * Optional cross-step / cross-catalog context a checker may consult in addition to its
 * own step's `data`. Threaded by every resolution path (the lab acceptance path and the
 * headless server path). BACKWARD-COMPATIBLE: it is the optional SECOND argument to a
 * Checker, so every existing single-argument checker keeps working unchanged.
 *
 *  - `catalog`  — the catalog this step belongs to.
 *  - `siblings` — the persisted data of the SAME entity's OTHER steps, keyed by step
 *                 label (so a checker can cross-validate against an upstream step).
 *  - `has`      — does an entity exist in a catalog? (cross-catalog link resolution).
 *
 * A checker that reads `ctx` must degrade gracefully when it is absent (e.g. a rollup
 * path that supplies none) — never regress a satisfied step to fail/pending purely
 * because the context wasn't provided.
 */
export interface CheckerContext {
  catalog: string;
  siblings: Record<string, Record<string, unknown>>;
  has: (catalog: string, entity: string) => boolean;
}

/** A checker reads a step's produced data (+ optional context) and derives a result. */
export type Checker = (data: Record<string, unknown>, ctx?: CheckerContext) => AcceptanceResult;
