/**
 * A verdict's STANDING — whether the acceptance layer still lets it speak (pure, isomorphic).
 *
 * `judge_verdicts` is an append-only record of everything the judges ever said. Acceptance
 * (`judgeBridge`) reads only the part of it that still applies: the newest rubric present, bound
 * to the content on record. Any surface that reports "how good is the project's content" must
 * count the SAME subset, or it states a number the app itself does not believe — which is what
 * the Evaluator's Verdicts tab did: it averaged every stored row, so a superseded-rubric fail and
 * a fail about content that no longer exists both inflated the headline fail count.
 *
 * Superseded / stale rows are EVIDENCE and stay visible — they are just not counted as current
 * quality. This module is the one place that draws that line.
 */

import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { VerdictProvenance } from '@/lib/catalog/acceptance/types';
import { CONDEMNING_PROVENANCE } from '@/lib/catalog/acceptance/judgeBridge';
import { RUBRIC_VERSION, rubricOf } from '@/lib/judge/rubrics';

/** A stored verdict plus the standing the server computed for it against the content on record. */
export interface StandingVerdict extends JudgeVerdict {
  /**
   * Provenance as `judgeBridge.verdictProvenance` classifies it. Computed SERVER-SIDE (only the
   * server holds the artifact rows the hash is compared against) and sent additively, so a client
   * can render the standing without re-deriving — or fabricating — it.
   */
  provenance: VerdictProvenance;
}

/**
 * Does this verdict still speak for current quality? Exactly the set acceptance condemns on, so
 * the Verdicts tab and a step's own banner can never report different truths.
 */
export function isStanding(p: VerdictProvenance): boolean {
  return CONDEMNING_PROVENANCE.has(p);
}

/** A verdict's rubric standing in words — `null` when it is the current rubric (nothing to say). */
export function rubricStanding(v: JudgeVerdict): string | null {
  const r = rubricOf(v);
  return r >= RUBRIC_VERSION ? null : `rubric v${r}, superseded by v${RUBRIC_VERSION}`;
}

/**
 * The provenance vocabulary, shared with the lab's `ProvenanceStrip` so the two surfaces speak
 * ONE language (glyph + word, never hue alone — WCAG 1.4.1). `current` is the only one that
 * reads as settled.
 */
export const VERDICT_STANDING_CHIP: Record<VerdictProvenance, { level: 'ok' | 'warn'; word: string }> = {
  current: { level: 'ok', word: 'VERDICT: CURRENT' },
  stale: { level: 'warn', word: 'VERDICT: STALE' },
  unknown: { level: 'warn', word: 'VERDICT: UNVERIFIED' },
  superseded: { level: 'warn', word: 'VERDICT: SUPERSEDED' },
};

/** One-line explanation of what a standing means, for a tooltip / modal line. */
export const VERDICT_STANDING_NOTE: Record<VerdictProvenance, string> = {
  current: 'Bound to the content this step holds now — counted as current quality.',
  stale: 'It judged content the step no longer holds (re-produced since). Kept as evidence, not counted.',
  unknown: 'Its content binding cannot be confirmed. Still applied by acceptance, and counted.',
  superseded: 'Scored under an older rubric. Kept as evidence, not counted until re-judged.',
};
