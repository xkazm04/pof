/**
 * Lens map — which craft lens gauges which step.
 *
 * Every `step-facts.json` deliverable class maps to exactly ONE base lens (the
 * completeness test fails the build if a class is unmapped). Catalog overrides refine
 * the TEXT-shaped classes only: a dialogue catalog's text is gauged by the dialogue
 * lens, not the systems lens — but its 2D icons stay with the 2d-art lens. Overrides
 * never apply to media classes, so a lens can never be dodged by re-labelling.
 *
 * The lens files themselves live in `src/lib/craft/lenses/<lensId>.md` (research-
 * grounded rubrics with named benchmark anchors); their current versions are pinned in
 * `lens-versions.ts` so a version bump visibly invalidates dependent verdicts.
 */

export const LENS_IDS = [
  'game-systems-code',
  'narrative',
  'dialogue',
  'voiceover',
  'audio',
  'vfx',
  '2d-art',
  '3d-art',
  'animation',
  'production-process',
] as const;

export type LensId = (typeof LENS_IDS)[number];

/** Deliverable classes as audited in step-facts.json. */
export type DeliverableClass =
  | 'text-config'
  | 'graph-data'
  | 'ue-runtime'
  | '2d-art'
  | '3d-mesh'
  | 'animation'
  | 'audio'
  | 'vfx-particles';

/** Base map: deliverable class → lens. Complete by test. */
export const DELIVERABLE_LENS: Record<DeliverableClass, LensId> = {
  'text-config': 'game-systems-code',
  'graph-data': 'game-systems-code',
  'ue-runtime': 'game-systems-code',
  '2d-art': '2d-art',
  '3d-mesh': '3d-art',
  animation: 'animation',
  audio: 'audio',
  'vfx-particles': 'vfx',
};

/** The classes catalog overrides may redirect — text-shaped design output only. */
export const TEXT_CLASSES: readonly DeliverableClass[] = ['text-config', 'graph-data'] as const;

/**
 * Narrative-leaning catalogs: their text/graph steps are story craft, not systems
 * design. Judged by the narrative lens (structure, worldbuilding, voice) instead.
 */
const NARRATIVE_CATALOGS = new Set([
  'quests',
  'codex',
  'factions',
  'bestiary',
  'cutscenes',
  'tutorial-beats',
]);

/** Dialogue catalogs: line-level writing craft (subtext, character voice, brevity). */
const DIALOGUE_CATALOGS = new Set(['dialog-trees']);

/**
 * Audio steps that are VOICE, not SFX/music — gauged by the voiceover lens
 * (casting/direction/performance standards, not sound design standards).
 */
const VOICEOVER_AUDIO_CATALOGS = new Set(['cutscenes']);

/**
 * The lens that gauges one step. Pure.
 * `production-process` is deliberately unreachable here — it is a per-CATALOG lens
 * applied by the audit fleet to the pipeline as a whole, never to a step.
 */
export function lensForStep(deliverable: DeliverableClass, catalogId: string): LensId {
  if ((TEXT_CLASSES as readonly string[]).includes(deliverable)) {
    if (DIALOGUE_CATALOGS.has(catalogId)) return 'dialogue';
    if (NARRATIVE_CATALOGS.has(catalogId)) return 'narrative';
  }
  if (deliverable === 'audio' && VOICEOVER_AUDIO_CATALOGS.has(catalogId)) return 'voiceover';
  return DELIVERABLE_LENS[deliverable];
}
