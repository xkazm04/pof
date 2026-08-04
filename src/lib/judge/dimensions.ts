/**
 * Quality dimensions — the shared craft checklist per deliverable class (Quality Program
 * WS2). This is imported by BOTH the strict judge rubric (WS2) and the quality prompt packs
 * (WS1) so the bar the judge scores and the bar the prompt asks for can never drift apart.
 *
 * Deliverable classes mirror step-facts `deliverable`; the strict judge scores each listed
 * dimension 0-100 and the overall verdict is gated on the aggregate (see rubrics.ts).
 */
export type DeliverableClass = 'text-config' | '2d-art' | 'ui-glyph' | 'ui-sheet' | 'ui-diagram' | '3d-mesh' | 'animation' | 'audio';

/** Catalogs whose 2D output is FLAT UI/HUD iconography, judged on icon craft (clarity/legibility)
 *  rather than painterly material — a legitimate sub-rubric (a clean flat vector glyph is shippable
 *  without painterly rendering, which the generic 2d-art bar wrongly penalized). WS1 calibration. */
export const UI_GLYPH_CATALOGS = new Set(['input-schemes', 'hud-elements', 'screen-flow', 'save-points']);

/**
 * Steps whose 2D deliverable is deliberately NOT one glyph, keyed `catalogId::step`.
 *
 * The `ui-glyph` routing above is per-CATALOG, so it also caught the steps in those catalogs
 * whose output is multi-element BY DESIGN — and `ui-glyph`'s cleanliness bar reads "no text,
 * no grid; exactly one glyph". The judge then condemned two steps for being exactly what they
 * were asked to be: `hud-elements::Wireframe` scored 10/100 with the finding "it is a
 * hairline wireframe/annotation diagram … with two callout labels" (labelled callouts are the
 * deliverable of a wireframe), and `input-schemes::Input Glyphs` scored 18/100 for being "a
 * 6x5 contact sheet of ~30 marks" (a glyph SET is the deliverable — the label is plural).
 *
 * These are explicit `catalogId::step` pairs, never a pattern: the routing must only change
 * for steps whose intent was actually mis-read, so no other step's standing verdict moves.
 * The escape is NOT leniency — both new rubrics keep a cleanliness bar, and it is stricter
 * about text than `ui-glyph` can be, because a sheet/diagram that legitimately CARRIES text
 * must have that text be real, correctly-spelled words (the same Input Glyphs sheet also
 * carried a garbled header reading "NUW HCUOR", which stays a defect under `ui-sheet`).
 */
export const UI_SHEET_STEPS = new Set(['input-schemes::Input Glyphs']);
export const UI_DIAGRAM_STEPS = new Set(['hud-elements::Wireframe']);

export interface Dimension {
  key: string;
  /** What "professional-grade" means for this dimension — the bar, stated positively. */
  bar: string;
}

/** Named modern-videogame anchors the judge/prompt compares against, per class. */
export const STYLE_ANCHORS: Record<DeliverableClass, string> = {
  'text-config': 'the design-doc craft of Path of Exile 2 / Diablo IV / Last Epoch systems writing',
  '2d-art': 'the shippable UI/concept art of Path of Exile 2, Diablo IV, and Hades II',
  'ui-glyph': 'the crisp, legible flat HUD/control iconography of Path of Exile 2, Diablo IV, and Hades II UI',
  'ui-sheet': 'a shipped input/ability glyph SET sheet — one consistent family of marks (Path of Exile 2, Diablo IV, Hades II control glyphs)',
  'ui-diagram': 'a production UI layout wireframe as a UX lead would annotate it — anatomy, anchors and states labelled',
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
  'ui-glyph': [
    { key: 'clarity', bar: 'one unambiguous shape that reads instantly; the function is obvious at a glance' },
    { key: 'legibility', bar: 'holds crisply at 32-40px; no detail that dissolves when downscaled' },
    { key: 'iconCraft', bar: 'clean flat or restrained-lit UI-icon craft with consistent stroke weight; not a painterly illustration' },
    { key: 'contrast', bar: 'clear figure/ground separation; the primary symbol is the brightest, highest-contrast element' },
    { key: 'setCohesion', bar: 'looks like it belongs to one cohesive HUD icon set; no skeuomorphic app-icon clutter' },
    { key: 'cleanliness', bar: 'no text, no watermark, no extra objects, no grid; exactly one glyph' },
  ],
  'ui-sheet': [
    { key: 'perGlyphClarity', bar: 'each mark in the set reads instantly on its own; no ambiguous or duplicate symbols' },
    { key: 'setCohesion', bar: 'one family — consistent stroke weight, corner radius, optical size and visual language across every mark' },
    { key: 'gridRegularity', bar: 'even, deliberate spacing and alignment; each glyph optically centred in its cell' },
    { key: 'legibility', bar: 'every glyph holds crisply at 32-40px; no detail that dissolves when downscaled' },
    { key: 'cleanliness', bar: 'no watermark, no jpeg smear, no stray marks; any text is real, correctly-spelled words — never garbled letterforms' },
  ],
  'ui-diagram': [
    { key: 'layoutClarity', bar: 'the screen anatomy reads at a glance — regions, hierarchy and reading order are unambiguous' },
    { key: 'annotationQuality', bar: 'callouts label the load-bearing parts (anchors, states, safe areas) and point at what they name' },
    { key: 'completeness', bar: 'every element the step\'s spec calls for is present and labelled; nothing load-bearing is missing' },
    { key: 'draftsmanship', bar: 'clean consistent line weights and leader lines; reads as a deliberate wireframe, not a sketch' },
    { key: 'cleanliness', bar: 'no watermark, no jpeg smear; all text is real, correctly-spelled words — never garbled letterforms' },
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

/**
 * Map a step-facts `deliverable` string to a rubric class (some deliverables share a rubric).
 *
 * Pass `catalogId` so flat UI/HUD 2D art routes to the `ui-glyph` sub-rubric (icon-craft bar)
 * instead of the painterly `2d-art` bar — and pass `step` too, so the steps in those catalogs
 * whose output is multi-element BY DESIGN (a glyph set, a wireframe) are not judged against
 * `ui-glyph`'s "exactly one glyph" bar. Without `step` the behaviour is unchanged, so every
 * existing caller keeps its meaning.
 */
export function deliverableClassOf(deliverable: string, catalogId?: string, step?: string): DeliverableClass | null {
  if (deliverable === '2d-art') {
    if (catalogId && step) {
      const key = `${catalogId}::${step}`;
      if (UI_SHEET_STEPS.has(key)) return 'ui-sheet';
      if (UI_DIAGRAM_STEPS.has(key)) return 'ui-diagram';
    }
    return catalogId && UI_GLYPH_CATALOGS.has(catalogId) ? 'ui-glyph' : '2d-art';
  }
  if (deliverable === '3d-mesh') return '3d-mesh';
  if (deliverable === 'animation') return 'animation';
  if (deliverable === 'audio') return 'audio';
  if (deliverable === 'text-config') return 'text-config';
  return null;
}
