/**
 * Quality dimensions — the shared craft checklist per deliverable class (Quality Program
 * WS2). This is imported by BOTH the strict judge rubric (WS2) and the quality prompt packs
 * (WS1) so the bar the judge scores and the bar the prompt asks for can never drift apart.
 *
 * Deliverable classes mirror step-facts `deliverable`; the strict judge scores each listed
 * dimension 0-100 and the overall verdict is gated on the aggregate (see rubrics.ts).
 */
export type DeliverableClass = 'text-config' | '2d-art' | '3d-mesh' | 'animation' | 'audio';

export interface Dimension {
  key: string;
  /** What "professional-grade" means for this dimension — the bar, stated positively. */
  bar: string;
}

/** Named modern-videogame anchors the judge/prompt compares against, per class. */
export const STYLE_ANCHORS: Record<DeliverableClass, string> = {
  'text-config': 'the design-doc craft of Path of Exile 2 / Diablo IV / Last Epoch systems writing',
  '2d-art': 'the shippable UI/concept art of Path of Exile 2, Diablo IV, and Hades II',
  '3d-mesh': 'an AAA outsourcing-review-passing game asset (Diablo IV / Lost Ark prop-and-character tier)',
  'animation': 'hand-keyed AAA locomotion/combat (God of War, Elden Ring) — not raw mocap dumps',
  'audio': 'the mixed, characterful game audio of a modern ARPG (Diablo IV / PoE2)',
};

export const DIMENSIONS: Record<DeliverableClass, Dimension[]> = {
  'text-config': [
    { key: 'coherence', bar: 'internally consistent and consistent with sibling steps — no contradictions, no invented references' },
    { key: 'specificity', bar: 'concrete, numeric, named — zero filler or generic-fantasy boilerplate' },
    { key: 'voice', bar: 'a distinctive, confident design voice; reads like a senior designer wrote it, not a template' },
    { key: 'completeness', bar: 'every field a real implementation would need is present and load-bearing' },
    { key: 'plausibility', bar: 'the values would actually ship — balanced, buildable, grounded in the ARPG laws' },
  ],
  '2d-art': [
    { key: 'silhouette', bar: 'reads instantly at icon scale; a clean, distinctive shape' },
    { key: 'valueHierarchy', bar: 'a deliberate light/dark structure that guides the eye; not flat or muddy' },
    { key: 'materialRendering', bar: 'believable metal/leather/gem/skin — surface, not a color blob' },
    { key: 'edgeQuality', bar: 'crisp, intentional edges; no AI mush, banding, or halo artifacts' },
    { key: 'styleCohesion', bar: 'matches the catalog’s art direction and the named anchors; would sit in the same UI set' },
    { key: 'cleanliness', bar: 'no watermark, no text, no extra subjects, no jpeg smear' },
  ],
  '3d-mesh': [
    { key: 'proportion', bar: 'correct, appealing proportions for the subject; no stretched limbs or bloat' },
    { key: 'formReadability', bar: 'the form reads clearly from the render — recognizable, well-defined masses' },
    { key: 'surface', bar: 'texture/material resolution honest to game-tier; not smeared or untextured' },
    { key: 'topologyHint', bar: 'no obvious degenerate geometry, fused parts, or floating bits in the render' },
    { key: 'shippability', bar: 'would pass an AAA outsourcing review as a placeholder-plus asset' },
  ],
  'animation': [
    { key: 'anticipation', bar: 'poses telegraph the motion; readable prep before action' },
    { key: 'weight', bar: 'believable weight shift and ground contact; not floaty' },
    { key: 'timing', bar: 'spacing/timing sells the action; no uniform robotic cadence' },
    { key: 'followThrough', bar: 'overlap and settle; secondary motion follows the lead' },
    { key: 'silhouette', bar: 'strong, clear poses across the cycle' },
    { key: 'believability', bar: 'reads as intentional hand-crafted motion, not a raw retarget' },
  ],
  'audio': [
    { key: 'clarity', bar: 'clean, artifact-free, correct level' },
    { key: 'characterFit', bar: 'matches the subject and the game’s tone' },
    { key: 'loopCleanliness', bar: 'seamless where it must loop; no clicks or obvious seams' },
    { key: 'mixPlausibility', bar: 'sits like game audio — spatial/eq/dynamics plausible, not a raw TTS/SFX dump' },
  ],
};

/** Map a step-facts `deliverable` string to a rubric class (some deliverables share a rubric). */
export function deliverableClassOf(deliverable: string): DeliverableClass | null {
  if (deliverable === '2d-art') return '2d-art';
  if (deliverable === '3d-mesh') return '3d-mesh';
  if (deliverable === 'animation') return 'animation';
  if (deliverable === 'audio') return 'audio';
  if (deliverable === 'text-config') return 'text-config';
  return null;
}
