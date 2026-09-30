import type { LabPrefs, LabView } from './hooks/useLabPrefs';

/**
 * WHERE the lab is — one value, not four loose `useState`s. Catalog + entity + pipeline step +
 * which of the three screens is up. Pure module: every navigation rule of the shell lives here
 * and is pinned at the unit rung (`labLocation.test.ts`), not only by whole-shell mounts.
 *
 * `entityId: null` means "no explicit pick" (a fresh catalog); `resolveLocation` turns it into
 * the entity the canvas actually shows.
 */
export interface LabLocation {
  catalogId: string;
  entityId: string | null;
  stepIdx: number;
  view: LabView;
}

export const DEFAULT_LOCATION: LabLocation = { catalogId: 'items', entityId: null, stepIdx: 0, view: 'catalogs' };

/**
 * Every way the location can move. `open` is THE one "take me to this entity's step" action —
 * matrix cell, matrix row, LabSearch hit, work-queue stop, coach jump and the one-shot toast's
 * "Open" all dispatch it, so every one of them also lands on the Catalogs view (the toast/coach
 * path used to move the location but leave the Matrix/Canon view on screen).
 */
export type LabNavAction =
  | { type: 'catalog'; catalogId: string }
  | { type: 'entity'; entityId: string }
  | { type: 'step'; stepIdx: number }
  | { type: 'view'; view: LabView }
  | { type: 'open'; catalogId: string; entityId: string; stepIdx: number };

/** The slice of `LabPrefs` the location owns. */
export type LocationPatch = Partial<Pick<LabPrefs, 'lastCatalogId' | 'lastEntityId' | 'lastStepIdx' | 'lastView'>>;

/**
 * The prefs patch an action persists. A function of the ACTION alone (never of the prior
 * location), so the hook can persist it outside the state updater and the updater stays pure.
 * Each patch names exactly the fields the action changes — a step move must not rewrite the
 * catalog, a view switch must not rewrite the step.
 */
export function locationPatch(action: LabNavAction): LocationPatch {
  switch (action.type) {
    case 'catalog': return { lastCatalogId: action.catalogId, lastEntityId: null, lastStepIdx: 0 };
    case 'entity': return { lastEntityId: action.entityId, lastStepIdx: 0 };
    case 'step': return { lastStepIdx: action.stepIdx };
    case 'view': return { lastView: action.view };
    case 'open': return { lastCatalogId: action.catalogId, lastEntityId: action.entityId, lastStepIdx: action.stepIdx, lastView: 'catalogs' };
  }
}

/** The location reducer: next location + the prefs patch that records it. */
export function reduceLocation(loc: LabLocation, action: LabNavAction): { loc: LabLocation; patch: LocationPatch } {
  const patch = locationPatch(action);
  switch (action.type) {
    case 'catalog': return { loc: { ...loc, catalogId: action.catalogId, entityId: null, stepIdx: 0 }, patch };
    case 'entity': return { loc: { ...loc, entityId: action.entityId, stepIdx: 0 }, patch };
    case 'step': return { loc: { ...loc, stepIdx: action.stepIdx }, patch };
    case 'view': return { loc: { ...loc, view: action.view }, patch };
    case 'open': return { loc: { catalogId: action.catalogId, entityId: action.entityId, stepIdx: action.stepIdx, view: 'catalogs' }, patch };
  }
}

/**
 * The location the canvas actually shows, DERIVED in render (never written back to state, and
 * never a prefs patch — a render must not write localStorage):
 *  - an entity id that names nothing in the list (a removed entity, or no pick yet) resolves to
 *    the first entity, so every consumer (LabSearch's step-hit resolution, `data-lab-entity`,
 *    the work queue) points at the entity on screen, never a phantom;
 *  - a step index past the resolved entity's OWN step list (a shrunk pipeline, a blob carried
 *    over from a longer catalog, a profile-scoped entity) resolves to step 0.
 * Returns the SAME object when nothing needs resolving, so it is cheap to memo against.
 */
export function resolveLocation<E extends { id: string }>(
  loc: LabLocation,
  entities: readonly E[] | undefined,
  stepCountOf: (entity: E | undefined) => number,
): LabLocation {
  const list = entities ?? [];
  const found = list.find((e) => e.id === loc.entityId);
  const entity = found ?? list[0];
  const entityId = found || list.length === 0 ? loc.entityId : list[0].id;
  const stepIdx = loc.stepIdx > 0 && loc.stepIdx >= stepCountOf(entity) ? 0 : loc.stepIdx;
  return entityId === loc.entityId && stepIdx === loc.stepIdx ? loc : { ...loc, entityId, stepIdx };
}

/** The one-time restore: stored location fields override the start location; none → same object. */
export function adoptPrefs(loc: LabLocation, prefs: LabPrefs): LabLocation {
  const next: LabLocation = {
    catalogId: prefs.lastCatalogId || loc.catalogId,
    entityId: prefs.lastEntityId || loc.entityId,
    stepIdx: prefs.lastStepIdx ?? loc.stepIdx,
    view: prefs.lastView ?? loc.view,
  };
  const same = next.catalogId === loc.catalogId && next.entityId === loc.entityId
    && next.stepIdx === loc.stepIdx && next.view === loc.view;
  return same ? loc : next;
}
