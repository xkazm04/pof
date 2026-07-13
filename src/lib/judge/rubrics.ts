import { DIMENSIONS, STYLE_ANCHORS, type DeliverableClass } from './dimensions';

/**
 * Strict judge rubrics (Quality Program WS2). RUBRIC_VERSION is stamped on every verdict;
 * statusModel prefers the newest version and never counts an old-rubric verdict as a strict
 * pass. Bump this on ANY change to the strictness contract or dimensions, and re-run the
 * calibration guard (src/lib/judge/calibration).
 *
 * v1 = the old lenient "is it coherent?" era (pre-program). v2 = the AAA-lead-reviewer bar.
 * v3 = v2 + CANON AWARENESS: the judge now receives the project's binding design rules
 * (canon-seed, global + catalog-scoped) and a projection of the entity's sibling steps, so it
 * stops penalizing content for correctly following canon AND catches real canon violations /
 * cross-step contradictions the isolated judge was blind to. A stricter, more accurate contract
 * than v2 — bumping the version correctly makes every canon-blind v2 pass provisional (no longer
 * a strict pass) until the step is re-judged under v3.
 */
export const RUBRIC_VERSION = 3;

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

/** Frame the injected project canon so it REDIRECTS scrutiny rather than lowering the bar.
 *  A senior reviewer on this project knows its binding design constraints; a reviewer who
 *  dings content for correctly following them (a Unique whose power is a rule-changing mod, an
 *  audio budget within the project's cap, the project's own rarity ladder) is failing to
 *  understand the product, not applying a higher bar. Canon tells you what is DELIBERATE — it
 *  does NOT excuse weak execution, and a genuine VIOLATION of canon is itself a defect to
 *  penalize. This block is empty when no canon is supplied. */
function canonFraming(canonBlock: string): string {
  if (!canonBlock) return '';
  return [
    canonBlock,
    ``,
    `How to use the PROJECT CANON above:`,
    `- These are the binding design constraints a senior reviewer ON THIS PROJECT already knows.`,
    `  Content that CORRECTLY follows them is not a defect: do NOT dock a modest stat line whose`,
    `  power sits in a rule-changing mod (that is the rarity law, not under-tuning), a resident`,
    `  audio budget that fits the project's stated cap, or the project's own rarity/naming ladder,`,
    `  and do NOT demand a bigger raw number, a larger asset scale, or a different game's taxonomy`,
    `  than canon specifies.`,
    `- Canon does NOT lower the quality bar. Within these constraints, judge craft, coherence,`,
    `  specificity and completeness exactly as rigorously as before — canon explains the design's`,
    `  boundaries, it never excuses weak execution inside them.`,
    `- A genuine VIOLATION of canon (a value that breaks a stated law, a contradiction with the`,
    `  sibling context below) IS a defect — call it out and score it down.`,
  ].join('\n');
}

/**
 * Build the full judge prompt for a deliverable class. `payload` is the thing to judge:
 * for text, the config itself; for media, an instruction naming the local file to Read
 * (the CLI judge has vision via Read). `canonContext` is the project's binding design rules
 * for this catalog (global + catalog-scoped); `siblingContext` is a compact projection of the
 * entity's OTHER steps so the judge can verify cross-references instead of guessing.
 */
export function buildRubricPrompt(cls: DeliverableClass, opts: {
  subject: string;
  payload: string;
  siblingContext?: string;
  canonContext?: string;
}): string {
  return [
    strictnessContract(cls),
    ``,
    canonFraming(opts.canonContext ?? ''),
    ``,
    `SUBJECT: ${opts.subject}`,
    opts.siblingContext
      ? `\nSIBLING CONTEXT — the entity's OTHER pipeline steps (real values). A number or name`
        + ` consistent with these is CORRECT, not an invented reference; penalize only a GENUINE`
        + ` contradiction with them or within the asset:\n${opts.siblingContext}`
      : '',
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

/** Extract the first COMPLETE brace-balanced JSON object from text (string-aware, so braces
 *  or quotes inside "findings" don't confuse it — the greedy-regex approach did). */
function firstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return raw.slice(start, i + 1);
  }
  return null;
}

/** Parse the judge's JSON verdict out of raw CLI stdout (tolerant of stray text before/after). */
export function parseJudgeResult(raw: string): JudgeResult | null {
  const json = firstJsonObject(raw);
  if (!json) return null;
  try {
    const o = JSON.parse(json) as Partial<JudgeResult>;
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
