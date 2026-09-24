/**
 * One status, several graders. When two independent checks speak to the same artifact (a
 * packaging step's disk truth and its static checks; a step's content checker and its static
 * checks), the stored status must be the WORSE of them — a sweep that writes its own verdict
 * alone lets whichever ran last launder the other's missing half.
 */
import type { AcceptanceResult } from './types';

const SEVERITY: Record<AcceptanceResult['status'], number> = { pass: 0, pending: 1, deferred: 2, fail: 3 };

/** The worse of two verdicts, naming every non-passing half. Pure. `primary` wins ties and
 *  supplies label + tier on a tie; a null `secondary` means that grader has nothing to say. */
export function worstOf(primary: AcceptanceResult, secondary: AcceptanceResult | null): AcceptanceResult {
  if (!secondary) return primary;
  const worst = SEVERITY[secondary.status] > SEVERITY[primary.status] ? secondary : primary;
  const reasons = [primary, secondary]
    .filter((r) => r.status !== 'pass')
    .map((r) => r.reason ?? r.detail)
    .filter(Boolean);
  return {
    label: primary.label,
    tier: worst.tier,
    status: worst.status,
    detail: [primary.detail, secondary.detail].filter(Boolean).join('; '),
    ...(reasons.length ? { reason: reasons.join('; ') } : {}),
  };
}
