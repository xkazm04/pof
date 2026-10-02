'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLabDetail } from '@/components/layout-lab/useLabCatalogData';
import { entityStepList } from '@/components/layout-lab/entityPipeline';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { setLabPrefs, useLabPrefs, type LabView } from '@/components/layout-lab/hooks/useLabPrefs';
import {
  DEFAULT_LOCATION, adoptPrefs, locationPatch, reduceLocation, resolveLocation,
  type LabLocation, type LabNavAction,
} from '@/components/layout-lab/labLocation';

/**
 * The lab shell's ONE navigate door. Holds the location, adopts the stored one once after
 * hydration, and persists every dispatched action's patch — so persistence and step-reset are
 * identical on every path because there is only one path. The rules themselves live in the
 * pure `labLocation` module.
 *
 * The returned `loc` is RESOLVED (`resolveLocation`): the phantom-entity reconcile and the
 * step clamp are derivations in render, not state writes — so a render never writes state or
 * localStorage for them, and a stored location whose entity arrives late (persisted-entity
 * hydration) is honoured once it lands instead of being overwritten by `entities[0]`.
 *
 * It also owns the cross-view door: a `pendingNavigation` write (GlobalCoach jump, one-shot
 * toast "Open") is consumed exactly once as an `open`, which lands on the Catalogs view.
 */
export function useLabLocation() {
  const { prefs, hydrated } = useLabPrefs();
  const [state, setState] = useState<{ adopted: boolean; loc: LabLocation }>({ adopted: false, loc: DEFAULT_LOCATION });
  // Adopt persisted last-location once after hydration (React-sanctioned adjust-state-during-render
  // bail-out; StrictMode-safe, no ref mutation). The only render-phase write left in the shell.
  if (hydrated && !state.adopted) setState({ adopted: true, loc: adoptPrefs(state.loc, prefs) });

  const raw = state.loc;
  const detail = useLabDetail(raw.catalogId);
  const loc = useMemo(
    () => resolveLocation(raw, detail?.entities, (e) => (detail ? entityStepList(raw.catalogId, e, detail.steps).length : 0)),
    [raw, detail],
  );

  // An explicit move also counts as adopted: a user's action outranks a late stored location.
  const dispatch = useCallback((action: LabNavAction) => {
    setState((s) => ({ adopted: true, loc: reduceLocation(s.loc, action).loc }));
    setLabPrefs(locationPatch(action));
  }, []);

  // Stable binders for the shell's props — thin: every rule is in the reducer.
  const nav = useMemo(() => ({
    catalog: (catalogId: string) => dispatch({ type: 'catalog', catalogId }),
    entity: (entityId: string) => dispatch({ type: 'entity', entityId }),
    step: (stepIdx: number) => dispatch({ type: 'step', stepIdx }),
    view: (view: LabView) => dispatch({ type: 'view', view }),
    open: (catalogId: string, entityId: string, stepIdx: number) => dispatch({ type: 'open', catalogId, entityId, stepIdx }),
  }), [dispatch]);

  // Subscribe directly so the dispatch happens inside a store callback, not in the effect body.
  useEffect(() => useOneShotLabStore.subscribe((s, prev) => {
    const pending = s.pendingNavigation;
    if (!pending || pending === prev.pendingNavigation) return;
    nav.open(pending.catalogId, pending.entityId, pending.stepIndex ?? 0);
    useOneShotLabStore.getState().setPendingNavigation(null);
  }), [nav]);

  return { loc, detail, dispatch, nav };
}
