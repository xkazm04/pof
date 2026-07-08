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

/** The strictness contract, prepended to every rubric. */
function strictnessContract(cls: DeliverableClass): string {
  return [
    `You are a LEAD REVIEWER at a AAA action-RPG studio. You are reviewing a produced game asset for`,
    `shippability. Your reference bar is: ${STYLE_ANCHORS[cls]}.`,
    ``,
    `Be STRICT. This studio does not ship mediocrity. Rules:`,
    `- Default to a LOWER score when uncertain. "Technically correct but basic" is a FAIL, not a pass.`,
    `- Score bands: 90-100 = shippable as-is in a modern videogame. 70-89 = competent placeholder that a lead would send back for polish. Below 70 = FAIL, not usable.`,
    `- Judge CRAFT, not just correctness. A coherent-but-generic output scores in the 40s-60s.`,
    `- Compare directly to the named reference games above — would this sit in that product without embarrassment?`,
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
