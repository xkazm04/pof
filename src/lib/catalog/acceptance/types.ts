/** The acceptance ladder. Higher tiers prove more (data → render). */
export type AcceptanceTier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type AcceptanceStatus = 'pass' | 'pending' | 'fail' | 'deferred';

/**
 * How much a recorded judge verdict still speaks for the content on record. See
 * `judgeBridge.verdictProvenance` for the full rule.
 */
export type VerdictProvenance = 'current' | 'stale' | 'unknown' | 'superseded';

/**
 * The judge verdict behind (or NOT behind) a result — attached by `bridgeJudgeVerdict`
 * whenever a failing verdict exists for the step, INCLUDING when it was not applied.
 *
 * That inclusion is the point: a verdict that judged content the step no longer holds is
 * reported as `stale` rather than silently dropped, so "unjudged since the re-produce" can
 * never be read as "judged and passed".
 */
export interface JudgeAttribution {
  provenance: VerdictProvenance;
  verdict: 'pass' | 'fail';
  score: number;
  judge: string;
  model?: string;
  judgedAt?: string;
  /** Plain-language statement of what this verdict does and does not prove here. */
  note: string;
}

export interface AcceptanceResult {
  label: string;
  status: AcceptanceStatus;
  tier: AcceptanceTier;
  detail: string;
  /** Why it failed or was deferred (Rule 4 — never fail/skip silently). */
  reason?: string;
  /** Judge provenance for this step, when a failing verdict exists (applied or not). */
  judge?: JudgeAttribution;
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
/**
 * A sibling step's ALREADY-RESOLVED verdict, and which layer produced it.
 *
 * `siblings` carries raw `data`, so a checker that derives from upstream steps could only
 * re-run their own shape checkers — it saw no server drain outcome and no judge verdict. That
 * is how the Items Test Gate, the step that gates the whole item, printed PASS for a
 * `"Visual QA (icon + mesh)"` row whose `Icon 2D Art` the SERVER had already recorded as
 * `deferred/L4` ("not a generated asset").
 *
 * `source` is the layer that DECIDED, so a derived checker can name it: the step's own
 * checker, the server drain overlay, or the judge bridge.
 */
export interface SiblingVerdict {
  status: AcceptanceStatus;
  source: 'checker' | 'drain' | 'judge';
}

export interface CheckerContext {
  catalog: string;
  siblings: Record<string, Record<string, unknown>>;
  has: (catalog: string, entity: string) => boolean;
  /**
   * The resolved verdict for ONE sibling step — the same `resolveStepAcceptance` merge every
   * banner, rail and `/status` cell uses, exposed to derived checkers.
   *
   * A FUNCTION, not a map, so it stays lazy: only the handful of steps a derived checker
   * actually depends on are graded, instead of every sibling on every context build.
   * OPTIONAL — a caller that cannot resolve verdicts (a rollup, a bare unit test) omits it and
   * the derived checker falls back to re-running the sibling's own checker on `siblings[step]`,
   * which is the pre-existing behavior. Per this interface's contract, absence must never
   * regress a satisfied step.
   */
  siblingVerdict?: (step: string) => SiblingVerdict | undefined;
}

/** A checker reads a step's produced data (+ optional context) and derives a result. */
export type Checker = (data: Record<string, unknown>, ctx?: CheckerContext) => AcceptanceResult;
