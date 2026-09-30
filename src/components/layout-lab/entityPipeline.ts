/**
 * ONE per-entity step list for every lab surface.
 *
 * `stepScope.stepLabelsForProfile` is the one rule for "which steps does THIS entity have"
 * (a step may be scoped to canon profiles, /diablo W05 D18). The rail and the matrix used it;
 * the cross-catalog coach and lab search indexed the unscoped CATALOG list instead — and the
 * coach built its entities without `canonProfile` — so for a profile-scoped catalog they named
 * steps the entity does not have, graded under the wrong canon, and opened a different step
 * than they named (a jump carries an index, and an index only means something in one list).
 *
 * So every lab surface goes through here:
 *  - {@link toLabEntity} — the single lab `LabEntity` constructor (wraps `labIdentityOf`, so a
 *    stored entity's canon profile and reference can never be dropped by one path);
 *  - {@link entityStepList} — that entity's own steps, in pipeline order: the list the rail
 *    renders and every `stepIndex` indexes;
 *  - {@link resolveStepJump} — a jump that names a step by LABEL resolves its index against
 *    the TARGET entity's own list, never a position in another list.
 */
import { labIdentityOf } from '@/lib/catalog/canon/profiles';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepLabelsForProfile } from '@/lib/catalog/stepScope';
import type { CatalogEntityBase } from '@/lib/catalog/types';
import { resolveCatalogSteps } from './catalogManifest';
import type { LabEntity } from './useLabCatalogData';

/** A stored catalog entity (seeded, draft, or persisted) as the stores hold it. */
export type StoredLabEntity = Pick<CatalogEntityBase, 'id' | 'name' | 'lifecycle' | 'links' | 'provenance'>;

/** The ONE constructor from a stored entity to the lab's `LabEntity`. */
export function toLabEntity(e: StoredLabEntity): LabEntity {
  return {
    id: e.id, name: e.name, lifecycle: e.lifecycle, data: (e as { data?: unknown }).data,
    ...(e.links ? { links: e.links } : {}),
    ...labIdentityOf(e),
  };
}

/**
 * The steps `entity` has in `catalogId`, in pipeline order. `catalogSteps` is the catalog's
 * resolved list (`resolveCatalogSteps`) — pass it when the caller already holds it, so a
 * whole-catalog derivation resolves the catalog once, not once per entity.
 */
export function entityStepList(
  catalogId: string,
  entity: { canonProfile?: string } | null | undefined,
  catalogSteps: readonly string[] = resolveCatalogSteps(catalogId),
): string[] {
  return stepLabelsForProfile(getCatalogPipeline(catalogId), catalogSteps, entity?.canonProfile);
}

/**
 * Where a jump to `step` in `catalogId` lands: the preferred (open) entity when its own
 * pipeline has the step, else the first entity whose pipeline does — at THAT entity's own
 * index. `null` when no entity has the step (the caller degrades to selecting the catalog).
 */
export function resolveStepJump(
  catalogId: string,
  step: string,
  entities: readonly LabEntity[],
  preferredEntityId: string | null,
): { entityId: string; stepIndex: number } | null {
  const catalogSteps = resolveCatalogSteps(catalogId);
  const preferred = entities.find((e) => e.id === preferredEntityId);
  for (const e of preferred ? [preferred, ...entities] : entities) {
    const stepIndex = entityStepList(catalogId, e, catalogSteps).indexOf(step);
    if (stepIndex >= 0) return { entityId: e.id, stepIndex };
  }
  return null;
}
