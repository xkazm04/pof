import type { AcceptanceResult } from './types';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';

/**
 * Judge → Acceptance bridge (pure).
 *
 * The acceptance ladder (a step's shape Checker) and the judge honesty-overlay
 * (`judge_verdicts`) are two separate truths. `statusModel.deriveCell` merges them ONLY
 * for the /status map, so the pipeline's own `AcceptanceResult` — the thing the lab, the
 * headless recipe, and the gate-drain consume — never saw a judge verdict: a step could
 * show a bare checker-pass while a matching-class judge had already scored it FAIL.
 *
 * This mirrors `deriveCell`'s judge semantics into the acceptance path so acceptance and
 * judge speak ONE truth:
 *   - a CURRENT-RUBRIC judge FAIL condemns the content even when the shape checker passed
 *     → the checker-pass is DOWN-GRADED to `fail` (which the /status map renders as
 *     `attention`), carrying the judge's verdict + findings excerpt as the reason;
 *   - only verdicts at `rubricVersion >= RUBRIC_VERSION` count — an older verdict is
 *     provisional / superseded (canon-blind pre-v3) and is IGNORED, never downgrading;
 *   - a wrong-judge-class verdict never speaks for this step: when the step's audited
 *     judge class is known, only that class (or a `human` verdict) is relevant — exactly
 *     as `deriveCell` filters (`!fact || v.judge === fact.judge || v.judge === 'human'`).
 *
 * READ-ONLY: this consults existing verdicts only; it never re-grades the judge and never
 * elevates (a judge PASS does not manufacture a checker pass — elevation stays a /status
 * concern where the produced-artifact tier is known).
 */
export function bridgeJudgeVerdict(
  result: AcceptanceResult,
  verdicts: JudgeVerdict[],
  /** The step's audited judge class (`StepFact.judge`), when known. `undefined` → every
   *  verdict is relevant, matching `deriveCell`'s `!fact` branch. */
  judgeClass?: string,
): AcceptanceResult {
  // Only CURRENT-RUBRIC verdicts count; older ones are provisional/superseded → ignored.
  const current = verdicts.filter((v) => (v.rubricVersion ?? 1) >= RUBRIC_VERSION);
  // Wrong-judge-class never speaks for this step (a `human` verdict always may).
  const relevant = judgeClass
    ? current.filter((v) => v.judge === judgeClass || v.judge === 'human')
    : current;

  const fail = relevant.find((v) => v.verdict === 'fail');
  // Only a shape-PASS is down-graded: a gate deferral (L3/L4) and an already
  // failing/pending result are left exactly as the checker found them.
  if (fail && result.status === 'pass') {
    const excerpt = fail.findings.trim().slice(0, 200);
    return {
      ...result,
      status: 'fail',
      reason: `judge ${fail.model || fail.judge} scored ${fail.score} (fail)${excerpt ? `: ${excerpt}` : ''}`,
    };
  }
  return result;
}
