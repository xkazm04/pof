/**
 * scan-sweep --challenge lab-shell-and-navigation/A — the lab's location rules as ONE pure
 * reducer. Where the lab is (catalog, entity, step, view) used to be written through five
 * hand-paired setter+setPrefs callbacks and three render-phase bail-outs, pinned only by
 * 10-second whole-shell mounts. These pin each rule at the unit rung.
 */
import { describe, it, expect } from 'vitest';
import {
  reduceLocation, resolveLocation, adoptPrefs, DEFAULT_LOCATION, type LabLocation,
} from '@/components/layout-lab/labLocation';

const at = (over: Partial<LabLocation> = {}): LabLocation =>
  ({ catalogId: 'items', entityId: 'x', stepIdx: 5, view: 'matrix', ...over });

describe('reduceLocation — one navigate door, one prefs patch per action', () => {
  it('a catalog switch resets entity + step, keeps the view, and persists exactly the three reset fields', () => {
    const { loc, patch } = reduceLocation(at(), { type: 'catalog', catalogId: 'bestiary' });
    expect(loc).toEqual({ catalogId: 'bestiary', entityId: null, stepIdx: 0, view: 'matrix' });
    expect(patch).toStrictEqual({ lastCatalogId: 'bestiary', lastEntityId: null, lastStepIdx: 0 });
  });

  it('open lands on the Catalogs view and persists all four location fields', () => {
    const { loc, patch } = reduceLocation(at(), { type: 'open', catalogId: 'items', entityId: 'e2', stepIdx: 4 });
    expect(loc).toEqual({ catalogId: 'items', entityId: 'e2', stepIdx: 4, view: 'catalogs' });
    expect(patch).toStrictEqual({ lastCatalogId: 'items', lastEntityId: 'e2', lastStepIdx: 4, lastView: 'catalogs' });
  });

  it('a step move persists only the step; a view switch persists only the view', () => {
    const step = reduceLocation(at(), { type: 'step', stepIdx: 3 });
    expect(step.loc).toEqual(at({ stepIdx: 3 }));
    expect(step.patch).toStrictEqual({ lastStepIdx: 3 });
    const view = reduceLocation(at(), { type: 'view', view: 'canon' });
    expect(view.loc).toEqual(at({ view: 'canon' }));
    expect(view.patch).toStrictEqual({ lastView: 'canon' });
  });

  it('an entity pick resets the step and persists entity + step', () => {
    const { loc, patch } = reduceLocation(at(), { type: 'entity', entityId: 'e9' });
    expect(loc).toEqual(at({ entityId: 'e9', stepIdx: 0 }));
    expect(patch).toStrictEqual({ lastEntityId: 'e9', lastStepIdx: 0 });
  });
});

describe('resolveLocation — entity reconcile + step clamp as a derivation, never a write', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const stepCountOf = (e: { id: string } | undefined) => (e?.id === 'a' || e?.id === 'b' ? 12 : 0);

  it('a phantom entity falls back to the first real one and an index past ITS list clamps to 0', () => {
    const loc = at({ entityId: 'ghost', stepIdx: 12, view: 'catalogs' });
    const resolved = resolveLocation(loc, [a, b], stepCountOf);
    expect(resolved).toEqual({ catalogId: 'items', entityId: 'a', stepIdx: 0, view: 'catalogs' });
    // A derivation returns a location only — never a prefs patch (a render must not write localStorage).
    expect(resolved).not.toHaveProperty('patch');
    expect(Object.keys(resolved).sort()).toEqual(['catalogId', 'entityId', 'stepIdx', 'view']);
  });

  it('returns the SAME object when nothing needs resolving', () => {
    const loc = at({ entityId: 'b', stepIdx: 11 });
    expect(resolveLocation(loc, [a, b], stepCountOf)).toBe(loc);
  });

  it('with no entity list (detail not loaded) any non-zero step clamps and the entity is left alone', () => {
    const loc = at({ entityId: null, stepIdx: 3 });
    expect(resolveLocation(loc, undefined, () => 0)).toEqual(at({ entityId: null, stepIdx: 0 }));
  });
});

describe('adoptPrefs — the one-time restore of the stored location', () => {
  it('adopts every stored location field', () => {
    const prefs = { themeId: 'light' as const, lastCatalogId: 'items', lastEntityId: 'e1', lastStepIdx: 4, lastView: 'matrix' as const };
    expect(adoptPrefs(DEFAULT_LOCATION, prefs)).toEqual({ catalogId: 'items', entityId: 'e1', stepIdx: 4, view: 'matrix' });
  });

  it('a blob with no location leaves the default untouched (same object)', () => {
    expect(adoptPrefs(DEFAULT_LOCATION, { themeId: 'light' })).toBe(DEFAULT_LOCATION);
  });
});
