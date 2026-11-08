import { pipelineForCatalog, trackLabel } from '@/lib/pipeline/tracks';
import { ITEM_STEP_NAMES } from './steps/itemsSteps';

/**
 * The curated fine-step list of a BESPOKE catalog (`catalogManifest` BESPOKE_CATALOGS). The
 * manifest reads this for the bespoke catalog and for a catalog with NO registered pipeline (the
 * generic track-label fallback) — never for a registered one, whose `StepSpec` labels are the
 * persisted `pipeline_artifacts.step` keys. A list here for a registered catalog is dead while the
 * registry is loaded and renders orphan labels when it is not (Rule 4b); spellbook, bestiary and
 * currencies carried such lists until 2026-11-08 (`labPipelinesShadow.test.ts` holds the line).
 */
const FINE_STEPS: Record<string, string[]> = {
  // Single source of truth: the Items step labels are declared once in
  // itemsSteps.ts (ITEM_STEP_SPECS keys → ITEM_STEP_NAMES) so the rendered
  // timeline, the bespoke-UI registry, and these specs can never drift apart.
  items: ITEM_STEP_NAMES,
};

export function labPipelineSteps(catalogId: string): string[] {
  return FINE_STEPS[catalogId] ?? pipelineForCatalog(catalogId).map(trackLabel);
}
