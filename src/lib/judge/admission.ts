/**
 * The judge verdict admission door (pure, isomorphic) — what `POST /api/judge-verdicts` will
 * store. Every invariant that makes a stored verdict mean what `/status` and acceptance read it
 * as is checked HERE, once, instead of trusted on the writer's word.
 *
 * Honest-floor rule: a tightening only ever removes a PASS's power, never a FAIL's. So the door
 * refuses only passes:
 *  - a PASS stamped under a rubric this build does not hold (`rubricVersion > RUBRIC_VERSION`,
 *    e.g. written into the shared `~/.pof/pof.db` by a branch that bumped the rubric) — it would
 *    win the newest-present selection and silence every current-rubric verdict;
 *  - a current-rubric non-human PASS below `BANDS.shippable` — the rubric itself says
 *    `verdict = "pass" only if overall >= 90` and `scripts/judge-run.ts` derives the verdict from
 *    the median band; a pass below it contradicts its own score.
 * A FAIL is admitted at any score and any rubric: refusing a stricter condemnation would only let
 * the previous (possibly passing) verdict stand. Rows that bypass the route (direct
 * `upsertVerdict` writers) are covered on read: `verdictProvenance` reads a future-rubric row as
 * `unknown` — it still condemns, it never elevates.
 *
 * Human verdicts and pre-program (v1, unstamped — the vlm tier's 0-10 gate) verdicts are not
 * band-derived and are exempt from the band rule.
 */
import { BANDS, RUBRIC_VERSION, rubricOf } from '@/lib/judge/rubrics';
import { err, ok, type Result } from '@/types/result';

/** The fields the door reads — structurally satisfied by the route's parsed body. */
export interface JudgeVerdictClaim {
  judge: 'llm-panel' | 'vlm' | 'human';
  verdict: 'pass' | 'fail';
  score: number;
  rubricVersion?: number;
}

/** Admit a verdict, or say every reason it cannot be stored. */
export function admitJudgeVerdict<T extends JudgeVerdictClaim>(v: T): Result<T, string[]> {
  const reasons: string[] = [];
  const rubric = rubricOf(v);
  if (v.verdict === 'pass' && rubric > RUBRIC_VERSION) {
    reasons.push(
      `rubric v${rubric} is not in force (current v${RUBRIC_VERSION}) — a pass scored under a rubric this build does not hold cannot be admitted`,
    );
  }
  if (v.verdict === 'pass' && rubric === RUBRIC_VERSION && v.judge !== 'human' && v.score < BANDS.shippable) {
    reasons.push(
      `a rubric v${RUBRIC_VERSION} pass must score >= ${BANDS.shippable} (BANDS.shippable); ${v.score} is a fail under its own rubric`,
    );
  }
  return reasons.length ? err(reasons) : ok(v);
}
