import { DIMENSIONS, STYLE_ANCHORS, type DeliverableClass } from '@/lib/judge/dimensions';

/**
 * Quality prompt packs (Quality Program WS1) — the production side of the same contract the
 * strict judge scores. A pack composes: senior-discipline role framing + the named
 * modern-videogame style anchors + the SAME craft checklist the judge uses (imported from
 * judge/dimensions, so prompt and rubric can never drift) + negative constraints. Prepended
 * to every generative Produce prompt so outputs aim at the professional bar from the start.
 *
 * PROMPT_VERSION is stamped into artifact provenance so /status can show score-by-prompt-
 * version and the WS1 improvement loop can prove a pack revision actually helped.
 */
export const PROMPT_VERSION = 'q1';

const DISCIPLINE: Record<DeliverableClass, string> = {
  'text-config': 'senior systems designer',
  '2d-art': 'senior concept/UI artist',
  'ui-glyph': 'senior UI/UX icon designer',
  '3d-mesh': 'senior 3D character/prop artist',
  'animation': 'senior gameplay animator',
  'audio': 'senior technical sound designer',
};

/** Class-specific hard "do not" constraints — the failure modes the judge penalizes. */
const NEGATIVES: Record<DeliverableClass, string[]> = {
  'text-config': ['no filler or generic-fantasy boilerplate', 'no placeholder/TODO values', 'no contradictions with sibling steps'],
  '2d-art': ['no watermark, signature, or text', 'no extra subjects or borders', 'no AI mush, banding, or halo artifacts', 'single centered subject on a clean readable ground'],
  'ui-glyph': ['no watermark, text, letters, or numbers', 'exactly one glyph, no icon grid or extra objects', 'must stay legible at 32-40px', 'clean flat or restrained-lit icon craft, not a painterly illustration'],
  '3d-mesh': ['no stretched or fused geometry', 'no untextured grey blob', '3/4 hero framing, neutral lighting'],
  'animation': ['no floaty weightless motion', 'no uniform robotic cadence', 'no foot sliding'],
  'audio': ['no clipping or artifacts', 'no raw un-mixed TTS/SFX dump', 'seamless where it must loop'],
};

/**
 * Build the quality pack for a deliverable class. Prepend this to the step's own direction so
 * production aims at the same bar the judge enforces.
 */
export function qualityPack(cls: DeliverableClass, catalogId: string): string {
  const checklist = DIMENSIONS[cls].map((d) => `  - ${d.key}: ${d.bar}`).join('\n');
  const negatives = NEGATIVES[cls].map((n) => `  - ${n}`).join('\n');
  return [
    `You are a ${DISCIPLINE[cls]} at a AAA action-RPG studio producing a shippable asset for the`,
    `${catalogId} catalog. The professional bar is: ${STYLE_ANCHORS[cls]}.`,
    ``,
    `This will be reviewed against these exact craft dimensions — meet the professional bar on each:`,
    checklist,
    ``,
    `Hard constraints:`,
    negatives,
    ``,
    cls === 'text-config' ? TEXT_TECHNIQUE : '',
    `Aim for work that could ship as-is in the reference games — not merely technically correct.`,
  ].filter(Boolean).join('\n');
}

/**
 * The text-config authoring technique that took every text step-type to ≥90 (WS1 hardening wave,
 * 6/6 agents converged on it). This is the difference between a coherent-but-shallow blurb (~40s)
 * and a shippable design doc (90+).
 */
export const TEXT_TECHNIQUE = [
  `Author it as a STRUCTURED design doc, not a prose blurb — every field load-bearing. To reach the bar:`,
  `  - Single source of truth: every number appears once; derive dependent values with the arithmetic SHOWN`,
  `    (a worked chain a reader can reproduce on a calculator). Forward-derive headline numbers from primitives —`,
  `    never reverse-engineer a figure to hit a target (the judge catches contradictions with your own inputs).`,
  `  - Sibling-sourced: cross-reference the entity's OTHER steps by their real values (ids, prices, stats, labels);`,
  `    contradicting a sibling is an automatic coherence failure. Add a crossReferences / statHooks block.`,
  `  - Prove hard cases INLINE, don't assert them (worked math, ICU plural/gender arms, edge cases, state machines).`,
  `  - Scope depth to the subject: a baseline Common is scoped DOWN (it's the zero-point), a boss scoped up.`,
  `  - Disclose your own discontinuities/edge cases precisely — that scores higher than claiming false airtightness.`,
  `  - Refuse vaporware: author real inline content, not promissory "TBD"/catalog-link stubs.`,
  `  - Declarative voice. NO meta-commentary defending your numbers; NO raw engine tokens/enums leaking into prose.`,
].join('\n');

/** Whether a deliverable class has a quality pack (all judged classes do). */
export function hasQualityPack(cls: DeliverableClass | null): cls is DeliverableClass {
  return cls != null;
}
