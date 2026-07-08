import { DIMENSIONS, STYLE_ANCHORS, type DeliverableClass } from './dimensions';

/**
 * Strict judge rubrics (Quality Program WS2). RUBRIC_VERSION is stamped on every verdict;
 * statusModel prefers the newest version and never counts an old-rubric verdict as a strict
 * pass. Bump this on ANY change to the strictness contract or dimensions, and re-run the
 * calibration guard (src/lib/judge/calibration).
 *
 * v1 = the old lenient "is it coherent?" era (pre-program). v2 = the AAA-lead-reviewer bar.
 */
export const RUBRIC_VERSION = 2;

/** Score bands the whole program agrees on. */
export const BANDS = {
  shippable: 90,   // >= 90: shippable in a modern videogame → /status verified-green
  placeholder: 70, // 70-89: competent placeholder, NOT green
  // < 70: FAIL
} as const;

/** The evaluation contract, prepended to every rubric. Firm professional bar, applied
 *  honestly — NOT a mandate to lowball (an earlier "default to a low score / fail correct
 *  work" wording made the judge refuse; the bar is high, the scoring is fair). */
function strictnessContract(cls: DeliverableClass): string {
  return [
    `Evaluate this produced game asset against the professional quality bar for a SHIPPING AAA`,
    `action-RPG. The reference standard is: ${STYLE_ANCHORS[cls]}.`,
    ``,
    `Score honestly and rigorously against that bar — base every score on specific, observable`,
    `properties of the asset, never on a quota. The bar is high:`,
    `- Correctness is the FLOOR, not a passing grade. An asset that is functional but generic, or`,
    `  that a lead would hand back for polish before shipping, is competent-placeholder work — that`,
    `  is roughly 40-70, not a pass.`,
    `- Reserve 90-100 for work that could ship AS-IS in the reference games. 70-89 = a solid`,
    `  placeholder that still needs a polish pass. Below 70 = not yet usable.`,
    `- Judge CRAFT, not just whether it is technically valid. Ask: would this sit in that shipped`,
    `  product without looking out of place? Where it would not, say specifically why.`,
    `- When the asset does not clearly meet the professional bar, do not give it the benefit of the`,
    `  doubt — but always ground the score in what you actually observe.`,
  ].join('\n');
}

/** The dimension block: what to score. */
function dimensionBlock(cls: DeliverableClass): string {
  const dims = DIMENSIONS[cls];
  return [
    `Score EACH of these dimensions 0-100 against the professional bar:`,
    ...dims.map((d) => `  - ${d.key}: ${d.bar}`),
    ``,
    `The overall score is your holistic judgment (roughly the weakest-few dimensions dominate — a single`,
    `broken dimension caps the asset). verdict = "pass" only if overall >= ${BANDS.shippable}, else "fail".`,
  ].join('\n');
}

/** The output contract — forces auditable, parseable, actionable output. */
function outputContract(): string {
  return [
    `Respond with ONLY a single JSON object on one line, no prose, no code fence:`,
    `{"dimensions":{"<key>":<0-100>,...},"score":<0-100>,"verdict":"pass"|"fail","findings":"<2-4 sentences citing SPECIFIC visible/textual deficiencies>","fix":"<one concrete directive to raise the score — this feeds prompt improvement>"}`,
  ].join('\n');
}

/**
 * Build the full judge prompt for a deliverable class. `payload` is the thing to judge:
 * for text, the config itself; for media, an instruction naming the local file to Read
 * (the CLI judge has vision via Read). `context` carries subject + sibling summary.
 */
export function buildRubricPrompt(cls: DeliverableClass, opts: {
  subject: string;
  payload: string;
  siblingContext?: string;
}): string {
  return [
    strictnessContract(cls),
    ``,
    `SUBJECT: ${opts.subject}`,
    opts.siblingContext ? `\nSIBLING CONTEXT (cross-check for contradictions):\n${opts.siblingContext}` : '',
    ``,
    `THE ASSET TO JUDGE:`,
    opts.payload,
    ``,
    dimensionBlock(cls),
    ``,
    outputContract(),
  ].filter((s) => s !== '').join('\n');
}

export interface JudgeResult {
  dimensions: Record<string, number>;
  score: number;
  verdict: 'pass' | 'fail';
  findings: string;
  fix: string;
}

/** Parse the judge's JSON verdict out of raw CLI stdout (tolerant of stray text). */
export function parseJudgeResult(raw: string): JudgeResult | null {
  const m = raw.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Partial<JudgeResult>;
    if (typeof o.score !== 'number' || (o.verdict !== 'pass' && o.verdict !== 'fail')) return null;
    return {
      dimensions: (o.dimensions as Record<string, number>) ?? {},
      score: Math.max(0, Math.min(100, Math.round(o.score))),
      verdict: o.verdict,
      findings: String(o.findings ?? ''),
      fix: String(o.fix ?? ''),
    };
  } catch {
    return null;
  }
}
