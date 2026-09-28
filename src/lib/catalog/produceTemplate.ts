/**
 * Stamp a stub produce as the catalog exemplar's TEMPLATE when it was written for another entity.
 *
 * A step's `produce` body is, for most catalogs, the exemplar entity's authored content with the
 * name interpolated. For the exemplar that IS its content; for every other entity it is a template.
 * Whether a body reads the entity is OBSERVED here, not declared: the body is re-run with `data`
 * blanked, and only a byte-identical output (the body is data-blind) is stamped. The stamp is read
 * by the registration guard (`acceptance/template.ts`), which holds its would-be pass at pending.
 *
 * The exemplar is the first CATALOG_SECTIONS seed — the entity the lab opens and the Rule 5 walker
 * produces (`e2e/helpers/lab-mode.ts` `firstSeededEntity`) — so the walker's stub pass is unchanged.
 * A catalog with no seed has no exemplar and is never stamped.
 */
import type { StepOutput } from '@/components/layout-lab/labPipelineStore';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import { TEMPLATE_FIELD, type TemplateStamp } from '@/lib/catalog/acceptance/template';

const exemplars = new Map<string, string | null>();

/** The catalog's exemplar entity id (its first code seed), or null when it has none. */
export function exemplarIdFor(catalogId: string): string | null {
  if (!exemplars.has(catalogId)) {
    const section = CATALOG_SECTIONS.find((s) => s.catalogId === catalogId);
    exemplars.set(catalogId, section?.seed()[0]?.id ?? null);
  }
  return exemplars.get(catalogId) ?? null;
}

/** Does this body's output change when the entity's data is blanked? A throw counts as reading it. */
function readsEntityData(spec: Pick<StepSpec, 'produce'>, entity: LabEntity, direction?: string): boolean {
  try {
    const real = JSON.stringify(spec.produce(entity, direction));
    const blank = JSON.stringify(spec.produce({ ...entity, data: {} }, direction));
    return real !== blank;
  } catch {
    return true;
  }
}

/**
 * Return `out` with `data.template` stamped when the entity is not its catalog's exemplar AND the
 * body is data-blind; otherwise `out` unchanged. No catalog id (an inline, unregistered spec) → unchanged.
 */
export function stampTemplate(
  catalogId: string | undefined,
  spec: Pick<StepSpec, 'produce'>,
  entity: LabEntity,
  out: StepOutput,
  direction?: string,
): StepOutput {
  if (!catalogId) return out;
  const exemplar = exemplarIdFor(catalogId);
  if (!exemplar || entity.id === exemplar || readsEntityData(spec, entity, direction)) return out;
  const stamp: TemplateStamp = { exemplar, entity: entity.id };
  return { ...out, data: { ...(out.data ?? {}), [TEMPLATE_FIELD]: stamp } };
}
