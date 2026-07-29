import type { AcceptanceResult, JudgeAttribution, VerdictProvenance } from './types';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { newestRubricVerdicts, isCurrentRubric } from '@/lib/judge/rubrics';
import { stepContentHash } from '@/lib/judge/contentHash';

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
 *   - a judge FAIL that is CURRENT (right rubric, right class, and bound to the content
 *     actually on record) condemns the content even when the shape checker passed
 *     → the checker-pass is DOWN-GRADED to `fail` (which the /status map renders as
 *     `attention`), carrying the judge's verdict + findings excerpt as the reason;
 *   - the rubric filter is the SHARED `newestRubricVerdicts` (`@/lib/judge/rubrics`), the
 *     same rule `deriveCell` applies, so the two can't diverge when RUBRIC_VERSION moves;
 *     a verdict below the current rubric is `superseded` — provisional, never condemning;
 *   - a wrong-judge-class verdict never speaks for this step: when the step's audited
 *     judge class is known, only that class (or a `human` verdict) is relevant — exactly
 *     as `deriveCell` filters (`!fact || v.judge === fact.judge || v.judge === 'human'`).
 *
 * ── Content binding ────────────────────────────────────────────────────────────
 * A verdict used to condemn a step FOREVER: nothing recorded what content it judged, so
 * fixing a step and re-producing it left the obsolete condemnation in force. Verdicts now
 * carry a `contentHash` and every outcome is classified (see {@link verdictProvenance}) —
 * and a `stale` verdict is REPORTED on the result (`AcceptanceResult.judge`), never silently
 * dropped, so "unjudged since the re-produce" can't be mistaken for "judged and passed".
 *
 * READ-ONLY: this consults existing verdicts only; it never re-grades the judge and never
 * elevates (a judge PASS does not manufacture a checker pass — elevation stays a /status
 * concern where the produced-artifact tier is known).
 */

/** What the step currently holds, so a verdict can be checked against it. */
export interface JudgedContent {
  /** `stepContentHash(artifact.data)` for the content on record right now. */
  hash?: string;
  /** When the artifact was last written — the only staleness signal a legacy (hash-less)
   *  verdict has: a judgment made BEFORE the last write provably judged older content. */
  updatedAt?: string;
}

/** Build a {@link JudgedContent} from a step's persisted data + write time. */
export function judgedContentOf(data: Record<string, unknown> | undefined, updatedAt?: string): JudgedContent {
  return { hash: stepContentHash(data), ...(updatedAt ? { updatedAt } : {}) };
}

/** Tolerant timestamp parse: SQLite `datetime('now')` ("YYYY-MM-DD HH:MM:SS", UTC) and ISO
 *  both appear in this data, so they can't be compared as strings. `NaN` → unknown. */
function ts(v: string | undefined): number {
  if (!v) return NaN;
  const s = v.includes('T') || /[Zz]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v.replace(' ', 'T')}Z`;
  return Date.parse(s);
}

/**
 * How much a verdict still speaks for the content on record:
 *  - `superseded` — scored under an older rubric; provisional by the program's own rule.
 *  - `current`    — its `contentHash` matches what the step holds now. Fully binding.
 *  - `stale`      — it demonstrably judged DIFFERENT content: either its hash disagrees, or
 *                   (legacy, hash-less) it was judged before the artifact's last write. It
 *                   does not condemn, and is reported so the gap is visible.
 *  - `unknown`    — no hash and no way to date it against the content (legacy rows, or a
 *                   caller that supplied no content). It STILL condemns — a recorded fail is
 *                   evidence, and dropping it would be the optimistic lie this whole layer
 *                   exists to prevent — but it is labelled, never passed off as `current`.
 */
export function verdictProvenance(v: JudgeVerdict, content?: JudgedContent): VerdictProvenance {
  if (!isCurrentRubric(v)) return 'superseded';
  if (v.contentHash && content?.hash) return v.contentHash === content.hash ? 'current' : 'stale';
  if (!v.contentHash) {
    const judged = ts(v.judgedAt);
    const written = ts(content?.updatedAt);
    if (!Number.isNaN(judged) && !Number.isNaN(written) && judged < written) return 'stale';
  }
  return 'unknown';
}

/** Does a verdict at this provenance condemn a shape-pass? */
const CONDEMNS: ReadonlySet<VerdictProvenance> = new Set<VerdictProvenance>(['current', 'unknown']);

function attribute(v: JudgeVerdict, provenance: VerdictProvenance, note: string): JudgeAttribution {
  return {
    provenance, verdict: v.verdict, score: v.score, judge: v.judge,
    ...(v.model ? { model: v.model } : {}),
    ...(v.judgedAt ? { judgedAt: v.judgedAt } : {}),
    note,
  };
}

export function bridgeJudgeVerdict(
  result: AcceptanceResult,
  verdicts: JudgeVerdict[],
  /** The step's audited judge class (`StepFact.judge`), when known. `undefined` → every
   *  verdict is relevant, matching `deriveCell`'s `!fact` branch. */
  judgeClass?: string,
  /** What the step holds now, so each verdict's content binding can be checked. */
  content?: JudgedContent,
): AcceptanceResult {
  // Wrong-judge-class never speaks for this step (a `human` verdict always may).
  const byClass = judgeClass
    ? verdicts.filter((v) => v.judge === judgeClass || v.judge === 'human')
    : verdicts;
  // THE shared rubric filter — only the newest rubric present speaks (see rubrics.ts).
  const relevant = newestRubricVerdicts(byClass);

  const fails = relevant.filter((v) => v.verdict === 'fail');
  if (!fails.length) return result;

  const classified = fails.map((v) => ({ v, p: verdictProvenance(v, content) }));
  const binding = classified.find((c) => CONDEMNS.has(c.p));

  // Only a shape-PASS is down-graded: a gate deferral (L3/L4) and an already
  // failing/pending result are left exactly as the checker found them.
  if (binding && result.status === 'pass') {
    const { v, p } = binding;
    const excerpt = v.findings.trim().slice(0, 200);
    const caveat = p === 'unknown' ? ' [unverified provenance: this verdict records no content binding]' : '';
    return {
      ...result,
      status: 'fail',
      reason: `judge ${v.model || v.judge} scored ${v.score} (fail)${excerpt ? `: ${excerpt}` : ''}${caveat}`,
      judge: attribute(v, p, p === 'current'
        ? 'Judged the content currently on record.'
        : 'This verdict records no content binding, so it cannot be confirmed against the current content — it is still applied, and still needs a re-judge.'),
    };
  }
  if (binding) return { ...result, judge: attribute(binding.v, binding.p, 'A judge FAIL is on record; the checker had already not passed.') };

  // Every failing verdict is stale or superseded: the condemnation does NOT apply, but the
  // step is UNJUDGED SINCE — which must never read as "judged and passed".
  const first = classified[0];
  return {
    ...result,
    judge: attribute(first.v, first.p, first.p === 'stale'
      ? 'A judge FAIL is on record but it judged content this step no longer holds (re-produced since). Not applied — this step is UNJUDGED, not judged-and-passed.'
      : 'A judge FAIL is on record under a superseded rubric. Not applied — this step needs a re-judge under the current rubric.'),
  };
}
