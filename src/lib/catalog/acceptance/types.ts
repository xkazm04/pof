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

/** A checker reads a step's produced data (+ optional context) and derives a result. */
export type Checker = (data: Record<string, unknown>) => AcceptanceResult;
