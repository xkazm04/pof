/**
 * Provenance summary for an entity whose steps ALL pass — the honesty layer under
 * {@link NextStepCoach}'s "All done."
 *
 * The per-step {@link ProvenanceStrip} already refuses to let one green banner read as
 * proof: it names the true engine, shouts `JUDGE: NONE`, and marks a `CHECKER: SHAPE-ONLY`
 * pass as shallow. But the coach sits ABOVE the steps and summarises them, and its
 * terminal state said "All done." with no qualifier at all — so the overclaim the strip
 * removes per step came straight back at the entity level. Over a pipeline where the
 * 2026-07-07 gap audit found 316/342 checkers shape-only, "All done." is the single most
 * misleading sentence the lab can print.
 *
 * This module does not grade anything and cannot move a verdict. It reads the SAME audited
 * `step-facts.json` rows the strip reads and counts how many of the passes rest on ground
 * that could not prove quality:
 *
 *   • `generatorWired: false` — the step claims an output no wired generator produces.
 *   • `checkerMeaningful: false` — the checker is shape-deep (field presence / char count).
 *   • `judge: 'none'` — nothing could grade whether the content is any good.
 *   • no fact at all — unaudited; the strip prints a loud `PROVENANCE: UNAUDITED` for it,
 *     and it must never be counted as backed.
 *
 * The fact lookup is injected rather than imported so this stays pure and testable without
 * the real 342-row manifest; the caller binds `getStepFact(catalogId, …)`.
 */

import type { StepFact } from '@/lib/status/statusModel';

/** The weaknesses a step can carry, most-overclaiming first. Order IS the ranking. */
const WEAKNESS_ORDER = ['unwired', 'shapeOnly', 'unjudged', 'unaudited'] as const;
export type Weakness = (typeof WEAKNESS_ORDER)[number];

/** Why a step is the weakest link, in the coach's own voice (never invented content). */
const WEAKNESS_REASON: Record<Weakness, string> = {
  unwired: 'it claims an output no wired generator produces',
  shapeOnly: 'its checker only checks shape, not content',
  unjudged: 'no judge could prove the content is any good',
  unaudited: 'it has no audited provenance record at all',
};

/** Plural nouns for the detail sentence, keyed the same way. */
const WEAKNESS_NOUN: Record<Weakness, string> = {
  unwired: 'with no wired generator',
  shapeOnly: 'graded by a shape-only checker',
  unjudged: 'with no judge',
  unaudited: 'unaudited',
};

export interface DoneProvenance {
  /** Steps considered. */
  total: number;
  /** Steps whose audited fact carries none of the weaknesses below. */
  solid: number;
  /** DISTINCT steps carrying at least one weakness (`total - solid`). */
  weak: number;
  /** Steps whose acceptance checker is shape-deep. */
  shapeOnly: number;
  /** Steps no judge can grade. */
  unjudged: number;
  /** Steps claiming an output no wired generator produces. */
  unwired: number;
  /** Steps with no audited fact — unknown, never counted as backed. */
  unaudited: number;
  /** The first step at the most-overclaiming rung present, for a jump CTA. */
  weakest: { step: string; index: number; reason: string } | null;
}

/** Which weaknesses does this step's fact carry? An absent fact is `unaudited`. */
function weaknessesOf(f: StepFact | undefined): Weakness[] {
  if (!f) return ['unaudited'];
  const out: Weakness[] = [];
  if (!f.generatorWired) out.push('unwired');
  if (!f.checkerMeaningful) out.push('shapeOnly');
  if (f.judge === 'none') out.push('unjudged');
  return out;
}

/**
 * Tally the provenance behind a set of steps. Counts are per-weakness (one step can be
 * counted under several — they are not exclusive), while `weak`/`solid` count DISTINCT
 * steps so they always sum to `total`.
 */
export function summarizeDoneProvenance(
  steps: readonly string[],
  factOf: (step: string) => StepFact | undefined,
): DoneProvenance {
  const counts: Record<Weakness, number> = { unwired: 0, shapeOnly: 0, unjudged: 0, unaudited: 0 };
  const firstAt = new Map<Weakness, { step: string; index: number }>();
  let weak = 0;

  steps.forEach((step, index) => {
    const ws = weaknessesOf(factOf(step));
    if (!ws.length) return;
    weak += 1;
    for (const w of ws) {
      counts[w] += 1;
      if (!firstAt.has(w)) firstAt.set(w, { step, index });
    }
  });

  const rung = WEAKNESS_ORDER.find((w) => firstAt.has(w));
  const hit = rung ? firstAt.get(rung)! : null;

  return {
    total: steps.length,
    solid: steps.length - weak,
    weak,
    shapeOnly: counts.shapeOnly,
    unjudged: counts.unjudged,
    unwired: counts.unwired,
    unaudited: counts.unaudited,
    weakest: hit && rung ? { ...hit, reason: WEAKNESS_REASON[rung] } : null,
  };
}

export interface DoneHeadline {
  /** True only when every pass is backed by an audited, judgeable, wired step. */
  verified: boolean;
  /** The sentence that replaces (or keeps) "All done." */
  headline: string;
  /** The qualifying sentence. Empty when `verified`. */
  detail: string;
}

/**
 * Turn a {@link DoneProvenance} into the coach's terminal copy.
 *
 * A fully backed pipeline still reads "All done." — nothing is taken away from the honest
 * case. Anything else states the COUNT first (the number is what makes the overclaim
 * legible), then names only the weaknesses actually counted, then the weakest link so the
 * operator has somewhere to go.
 */
export function doneHeadline(p: DoneProvenance): DoneHeadline {
  if (p.weak === 0) {
    return { verified: true, headline: 'All done.', detail: '' };
  }
  const parts = WEAKNESS_ORDER.filter((w) => p[w] > 0).map((w) => `${p[w]} ${WEAKNESS_NOUN[w]}`);
  const detail =
    `Unproven: ${parts.join(', ')}. ` +
    (p.weakest ? `Weakest link — ${p.weakest.step}: ${p.weakest.reason}.` : '');
  return {
    verified: false,
    headline: `Every step passes, but ${p.weak} of ${p.total} can't prove it.`,
    detail: detail.trim(),
  };
}
