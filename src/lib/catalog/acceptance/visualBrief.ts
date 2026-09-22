/**
 * The creature VISUAL BRIEF (/diablo W04 → graded since W05, decision D19).
 *
 * The image steps draw a creature from its Concept & Role `visualBrief`. W03/W04 measured that an
 * anatomy written around a category noun ("a corpse defined by slack flesh") renders as a bare
 * skeleton 10 of 12 times whatever the style, while a positive visual statement rendered 3 of 3 —
 * so the brief is the image's real input, and a creature catalog now grades that it exists. The
 * criteria are world-neutral: they say HOW to write it, never what any creature looks like.
 */
import { minLength } from './dataCheckers';
import type { Checker } from './types';

export const VISUAL_BRIEF_FIELD = 'visualBrief';
export const VISUAL_BRIEF_MIN_CHARS = 80;

export const VISUAL_BRIEF_CRITERIA: string[] = [
  'Write the anatomy as a VISUAL brief an image model can draw: state positively what is visible — body bulk, skin or hide coverage and colour, posture, limbs, clothing — and say explicitly whether any bone is exposed.',
  'Never let a category noun (corpse, undead, demon, beast) carry the look; describe what such a creature LOOKS like instead.',
  'Also write that visual description alone as a separate field `visualBrief` (at most 500 characters): the figure only — no combat role, no staging or setting, no place, franchise or character names. The image steps draw from it verbatim.',
];

export function visualBriefWritten(): Checker {
  return minLength(VISUAL_BRIEF_FIELD, `Visual brief (what the image steps draw) ≥ ${VISUAL_BRIEF_MIN_CHARS} characters`, VISUAL_BRIEF_MIN_CHARS);
}
