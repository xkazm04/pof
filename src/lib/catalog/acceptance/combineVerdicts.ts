/**
 * One status, several graders. When two independent checks speak to the same artifact (a
 * packaging step's disk truth and its static checks; a step's content checker and its static
 * checks), the stored status must be the WORSE of them — a sweep that writes its own verdict
 * alone lets whichever ran last launder the other's missing half.
 *
 * Two lattices, because the halves are of two kinds. Sweep halves (disk truth, static checks)
 * speak pass/deferred/fail only: `worstOf`. A step's own CONTENT hold is a different claim —
 * `pending` is blocked on an AUTHOR, `deferred` on an ENVIRONMENT — so folding it into a sweep
 * verdict ranks fail > pending > deferred > pass (`foldContentHold`): a declared gap, a SOURCED or
 * TEMPLATE hold never reads as a deferral (registry: content-acceptance-tiering ·
 * deferred-as-honest-progress), and its marker keeps leading the stored reason.
 */
import type { AcceptanceResult } from './types';

const SEVERITY: Record<AcceptanceResult['status'], number> = { pass: 0, pending: 1, deferred: 2, fail: 3 };
/** A content hold outranks an environment deferral: author-owed work is never hidden as waiting. */
const HOLD_SEVERITY: Record<AcceptanceResult['status'], number> = { pass: 0, deferred: 1, pending: 2, fail: 3 };

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

/** True when the content checker withholds a pass for a reason in the DATA (not a runtime gate
 *  still to run) — the only content verdicts a sweep must not paper over. Pure. */
export function holdsBackAtDataTier(content: AcceptanceResult): boolean {
  if (content.status === 'pending' || content.status === 'fail') return true;
  return content.status === 'deferred' && content.tier !== 'L3' && content.tier !== 'L4';
}

/** A sweep's verdict with the step's own content hold folded in — what BOTH L2 sweeps store. Pure.
 *  Content that passes, or defers only to a runtime gate (L3/L4), leaves the sweep verdict as is.
 *  Otherwise the stricter wins under fail > pending > deferred > pass (content on a tie), and the
 *  winner's reason leads so a SOURCED:/TEMPLATE:/UNGRADED marker stays the reason's prefix. */
export function foldContentHold(sweep: AcceptanceResult, content: AcceptanceResult | null): AcceptanceResult {
  if (!content || !holdsBackAtDataTier(content)) return sweep;
  const [winner, other] = HOLD_SEVERITY[content.status] >= HOLD_SEVERITY[sweep.status] ? [content, sweep] : [sweep, content];
  const reasons = [winner, other]
    .filter((r) => r.status !== 'pass')
    .map((r) => r.reason ?? r.detail)
    .filter(Boolean);
  return {
    label: sweep.label,
    tier: winner.tier,
    status: winner.status,
    detail: [winner.detail, other.detail].filter(Boolean).join('; '),
    ...(reasons.length ? { reason: reasons.join('; ') } : {}),
  };
}
