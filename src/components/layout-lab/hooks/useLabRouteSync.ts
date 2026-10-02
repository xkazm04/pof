'use client';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCatalogStore } from '@/stores/catalogStore';
import { labRouteKey, labUrl, parseLabRoute, withoutLabParams, type LabRoute } from '@/lib/shell/labRoute';
import { entityStepList, resolveStepJump, toLabEntity } from '@/components/layout-lab/entityPipeline';
import { useLabPrefs } from '@/components/layout-lab/hooks/useLabPrefs';
import type { LabLocation } from '@/components/layout-lab/labLocation';
import type { LabDetail } from '@/components/layout-lab/useLabCatalogData';
import type { useLabLocation } from '@/components/layout-lab/hooks/useLabLocation';

type LabNav = ReturnType<typeof useLabLocation>['nav'];

/** Lab shells mounted in this document — the params are stripped only when the last one leaves. */
let mountedLabs = 0;

/** Does `loc` already show everything `route` names? (A partial address names fewer fields.) */
function covers(loc: LabRoute, route: LabRoute): boolean {
  return loc.catalogId === route.catalogId
    && (route.entityId === undefined || loc.entityId === route.entityId)
    && (route.step === undefined || loc.step === route.step)
    && (route.view === undefined || loc.view === route.view);
}

function write(kind: 'push' | 'replace', route: LabRoute): void {
  const url = labUrl(window.location.href, route);
  if (kind === 'push') window.history.pushState({}, '', url);
  else window.history.replaceState({}, '', url);
}

/**
 * Keeps the lab location and the address in step. `location` is the location ON SCREEN (the
 * resolved one, step as a label), or `null` until it has settled (prefs adopted); `apply`
 * moves the lab to an address — it must dispatch through the one navigate door.
 *
 * - Arrival: a parsed address outranks the persisted location and is applied; the entry is
 *   REPLACED once the location lands, never pushed. No / an unparseable address → the persisted
 *   location stays and the entry is replaced to name it.
 * - A catalog, entity, open or view move PUSHES one entry; a step-only move (a rail click, the
 *   step clamp) and an entity reconcile (the entity changed in the same commit as `universe`,
 *   the entity list it resolves against) REPLACE, so the URL bar is always a link to what is
 *   on screen and only user moves become history.
 * - popstate applies the entry's location and pushes nothing (Back/Forward never grow history).
 * - The lab's params leave with the lab: when it unmounts (shell switch), they are stripped
 *   from the entry it leaves behind. Deferred a microtask, so a StrictMode (or any immediate)
 *   remount keeps them.
 */
export function useLabRouteSync(location: LabRoute | null, apply: (route: LabRoute) => void, universe?: unknown): void {
  const prev = useRef<LabRoute | null>(null);
  const prevUniverse = useRef(universe);
  const latest = useRef<LabRoute | null>(location);
  // The next location change came from the address (arrival / popstate): replace, never push.
  const fromAddress = useRef(false);
  const applyRef = useRef(apply);
  useEffect(() => { latest.current = location; applyRef.current = apply; });

  useEffect(() => {
    // A location that moved in the same commit as its entity universe (persisted entities
    // landing, an entity removed) is the render-time RECONCILE, not a user move.
    const reconciled = universe !== prevUniverse.current;
    prevUniverse.current = universe;
    // `last === location`: a StrictMode effect re-run on the same commit — nothing moved.
    if (!location || prev.current === location) return;
    const last = prev.current;
    prev.current = location;
    if (!last) {
      const addressed = parseLabRoute(window.location.search);
      if (addressed && !covers(location, addressed)) {
        fromAddress.current = true;
        applyRef.current(addressed);
      } else {
        write('replace', location);
      }
      return;
    }
    const wasAddress = fromAddress.current;
    fromAddress.current = false;
    // Landing from the address rewrites the entry to what is on screen even when the address
    // could not be fully honoured (e.g. an entity that no longer exists).
    if (labRouteKey(last) === labRouteKey(location) && !wasAddress) return;
    const moved = last.catalogId !== location.catalogId || last.view !== location.view;
    const section = moved || (last.entityId !== location.entityId && !reconciled);
    write(section && !wasAddress ? 'push' : 'replace', location);
  }, [location, universe]);

  useEffect(() => {
    mountedLabs += 1;
    const onPop = () => {
      const addressed = parseLabRoute(window.location.search);
      const here = latest.current;
      if (!addressed || !here || covers(here, addressed)) return;
      fromAddress.current = true;
      applyRef.current(addressed);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      mountedLabs -= 1;
      window.removeEventListener('popstate', onPop);
      queueMicrotask(() => {
        if (mountedLabs > 0) return;
        const url = withoutLabParams(window.location.href);
        if (url) window.history.replaceState({}, '', url);
      });
    };
  }, []);
}

/**
 * LayoutLab's binding: derives the on-screen address from the resolved location (step index →
 * the entity's own step LABEL) and applies an address through `nav` — the one navigate door.
 */
export function useLabAddress(loc: LabLocation, detail: LabDetail | null, nav: LabNav): void {
  const { hydrated } = useLabPrefs();
  const route = useMemo<LabRoute | null>(() => {
    if (!hydrated) return null;
    const entity = detail?.entities.find((e) => e.id === loc.entityId);
    const step = detail ? entityStepList(loc.catalogId, entity, detail.steps)[loc.stepIdx] : undefined;
    return { catalogId: loc.catalogId, ...(loc.entityId ? { entityId: loc.entityId } : {}), ...(step ? { step } : {}), view: loc.view };
  }, [hydrated, loc, detail]);

  const apply = useCallback((r: LabRoute) => {
    const { entitiesByCatalog, draftEntitiesByCatalog } = useCatalogStore.getState();
    const entities = [...Object.values(entitiesByCatalog[r.catalogId] ?? {}), ...Object.values(draftEntitiesByCatalog[r.catalogId] ?? {})].map(toLabEntity);
    if (r.entityId) {
      const idx = r.step ? entityStepList(r.catalogId, entities.find((e) => e.id === r.entityId)).indexOf(r.step) : 0;
      nav.open(r.catalogId, r.entityId, Math.max(0, idx));
    } else {
      const jump = r.step ? resolveStepJump(r.catalogId, r.step, entities, null) : null;
      if (jump) nav.open(r.catalogId, jump.entityId, jump.stepIndex);
      else nav.catalog(r.catalogId);
    }
    // `open` lands on the Catalogs view; an address naming another view moves there after it.
    if (r.view && r.view !== 'catalogs') nav.view(r.view);
  }, [nav]);

  useLabRouteSync(route, apply, detail?.entities);
}
