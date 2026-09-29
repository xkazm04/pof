import '@/lib/catalog/pipelines/items'; // side-effect: ownership is decided against the REGISTERED items spec
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stampTemplate } from '@/lib/catalog/produceTemplate';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepOutput } from '@/components/layout-lab/labPipelineStore';

/**
 * ONE OWNER PER ITEMS LABEL.
 *
 * `items` is the one catalog with two step specs (`ITEMS_SPEC_DUALITY`). Six labels are declared
 * by BOTH — Concept Brief, Economy, Icon 2D Art, Tooltip / Compare, Test Gate, UE Packaging. The
 * server (`serverCheckerFor`), /status, the headless drains and the judge fleet resolve a label
 * REGISTERED-first; until 2026-09-29 the lab resolved, rendered and produced those six
 * BESPOKE-first. So one persisted row had two graders: measured read-only on the live DB, 15 of
 * 36 shared-label rows read differently in the lab than on the server, and the bespoke Produce
 * could overwrite a registry-shaped row with the unstamped Pillars exemplar stub.
 *
 * This function is the single answer to "which spec owns this items label", in the server's
 * order: the registered spec wins every label it declares; the bespoke spec owns only the labels
 * the registry does not declare. `getStepComponent` (render), `resolveAccept` (grade) and
 * `populateItemDemo` (produce) all route through it, so a label has one checker, one produce door
 * and one view shape. No label is renamed (Rule 4b) — only the owner of the six shared ones moves.
 */
export type ItemsLabelOwner = 'registry' | 'bespoke';

/** The REGISTERED items `StepSpec` for a label, or undefined when the registry does not declare it. */
export function itemsRegisteredStep(label: string): StepSpec | undefined {
  return getCatalogPipeline('items')?.steps.find((s) => s.label === label);
}

/** Which spec owns an items label — `null` when neither spec declares it. */
export function itemsLabelOwner(label: string): ItemsLabelOwner | null {
  if (itemsRegisteredStep(label)) return 'registry';
  return ITEM_STEP_SPECS[label] ? 'bespoke' : null;
}

/**
 * The stub an items label's OWNER writes for `entity`. A registry-owned label goes through the
 * registered `produce` + `stampTemplate` — the same door `ArchetypeStep` uses — so a data-blind
 * exemplar body written for any other entity is held at `pending` (TEMPLATE) by the registration
 * guard instead of grading `pass` on exemplar content. `null` when neither spec declares it.
 */
export function produceItemStep(entity: LabEntity, label: string): StepOutput | null {
  const reg = itemsRegisteredStep(label);
  if (reg) return stampTemplate('items', reg, entity, reg.produce(entity));
  return ITEM_STEP_SPECS[label]?.produce(entity) ?? null;
}
