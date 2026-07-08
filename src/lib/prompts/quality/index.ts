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
  '3d-mesh': 'senior 3D character/prop artist',
  'animation': 'senior gameplay animator',
  'audio': 'senior technical sound designer',
};

/** Class-specific hard "do not" constraints — the failure modes the judge penalizes. */
const NEGATIVES: Record<DeliverableClass, string[]> = {
  'text-config': ['no filler or generic-fantasy boilerplate', 'no placeholder/TODO values', 'no contradictions with sibling steps'],
  '2d-art': ['no watermark, signature, or text', 'no extra subjects or borders', 'no AI mush, banding, or halo artifacts', 'single centered subject on a clean readable ground'],
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
    `Aim for work that could ship as-is in the reference games — not merely technically correct.`,
  ].join('\n');
}

/** Whether a deliverable class has a quality pack (all judged classes do). */
export function hasQualityPack(cls: DeliverableClass | null): cls is DeliverableClass {
  return cls != null;
}
