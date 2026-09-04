/**
 * The vision seam's ATTRIBUTION contract.
 *
 * A critique score is worthless as evidence if you cannot say who wrote it. The Qwen seam
 * walks a five-model fallback chain on any quota/throttle signal, so the model that
 * actually answered is routinely NOT the one that was requested — and until now the seam
 * returned only text, so nothing above it could ever know. PoF's `judge_verdicts` table
 * already stores the model per row; this brings the animation critique to that convention.
 *
 * The rule: report the model that ANSWERED, or say `unreported`. Never a defaulted name.
 */

/** The literal used when a seam genuinely cannot know which model answered. */
export const UNREPORTED_MODEL = 'unreported';

/**
 * How `model` was established:
 * - `answered`  — the provider echoed the model that produced this text (chain-walking seams).
 * - `requested` — a single-model seam with no fallback path: the model asked for is the model
 *                 that answered, by construction. Still not a guess.
 * - `unreported`— the seam cannot know (an arbitrary injected `callVision`, e.g. a test stub).
 */
export type VisionAttribution = 'answered' | 'requested' | 'unreported';

/** A vision-model answer plus who wrote it. */
export interface VisionAnswer {
  /** The raw model text (what the old `Promise<string>` seam returned). */
  text: string;
  /** The answering model, or `UNREPORTED_MODEL`. */
  model: string;
  attribution: VisionAttribution;
  /**
   * Models tried and rejected (quota / transport / empty) BEFORE this one answered, in
   * order. Empty means the primary answered. Non-empty means a fallback produced the score.
   */
  fellBackFrom: string[];
}

/** An answer from a seam that cannot name its writer. Pure. */
export function unattributedAnswer(text: string): VisionAnswer {
  return { text, model: UNREPORTED_MODEL, attribution: 'unreported', fellBackFrom: [] };
}

/** Accept either seam shape (legacy `string` or an attributed answer). Pure. */
export function normalizeVisionAnswer(result: string | VisionAnswer): VisionAnswer {
  return typeof result === 'string' ? unattributedAnswer(result) : result;
}

/** True when a fallback model — not the requested primary — produced the answer. Pure. */
export function usedFallback(answer: VisionAnswer): boolean {
  return answer.fellBackFrom.length > 0;
}

/** One-line provenance for a log line or a CLI footer. Pure. */
export function describeVisionAnswer(answer: VisionAnswer): string {
  if (answer.attribution === 'unreported') return 'model unreported';
  return usedFallback(answer)
    ? `${answer.model} (fallback; ${answer.fellBackFrom.join(', ')} did not answer)`
    : answer.model;
}
