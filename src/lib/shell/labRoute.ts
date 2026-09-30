/**
 * The lab's address codec — the lab half of `shellRoute.ts`. Legacy modules already had
 * addresses (`/?legacy=1&module=<id>`); no lab location did, so a surface that knows exactly
 * which entity step it is talking about (the /status evidence ledger, a report, a toast) could
 * only link to "wherever the lab was last left".
 *
 * A lab address is `/?legacy=0&c=<catalog>&e=<entity>&s=<step LABEL>&v=<view>`:
 *  - the step travels by LABEL, never by index — an index means a different step per canon
 *    profile (a profile-scoped pipeline), a label is resolved against the target entity's own
 *    list on arrival (`entityStepList`);
 *  - `legacy=0` is always named, so the root gate renders the lab whatever shell preference is
 *    stored (the same rule `parseShellRoute` gives every entry);
 *  - every param is validated against a closed vocabulary: an unknown catalog refuses the whole
 *    address (an entity id means nothing without its catalog), an unknown view is dropped.
 *    Never trusted — an unparseable address degrades to the persisted location.
 *
 * The location travels in the URL, not in `history.state` (see `shellRoute.ts`: Next's router
 * copies its own internals into plain pushState/replaceState calls).
 */
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { LabView } from '@/components/layout-lab/hooks/useLabPrefs';

/** A lab location as an address carries it. Only `catalogId` is required. */
export interface LabRoute {
  catalogId: string;
  entityId?: string;
  /** The pipeline step's LABEL (e.g. `Economy`), resolved per entity on arrival. */
  step?: string;
  view?: LabView;
}

const CATALOG_IDS: ReadonlySet<string> = new Set(CATALOG_SECTIONS.map((s) => s.catalogId));
const VIEWS: ReadonlySet<string> = new Set<LabView>(['catalogs', 'canon', 'matrix']);
/** The params a lab address owns (everything else on the URL is left alone). */
const LAB_PARAMS = ['c', 'e', 's', 'v'] as const;

/** Is `id` a catalog the lab can open? (The address allow-list.) */
export function isLabCatalog(id: string | null | undefined): id is string {
  return !!id && CATALOG_IDS.has(id);
}

/** The lab location `search` names, or `null` when it names none (or an unknown catalog). */
export function parseLabRoute(search: string): LabRoute | null {
  const p = new URLSearchParams(search);
  const catalogId = p.get('c');
  if (!isLabCatalog(catalogId)) return null;
  const entityId = p.get('e');
  const step = p.get('s');
  const view = p.get('v');
  return {
    catalogId,
    ...(entityId ? { entityId } : {}),
    ...(step ? { step } : {}),
    ...(view && VIEWS.has(view) ? { view: view as LabView } : {}),
  };
}

/**
 * `href` rewritten to name lab location `route`: the pathname, the hash and every param the
 * lab does not own are KEPT (so `/layout` stays `/layout`), `legacy=0` is set, and the lab's
 * own params are set or removed. Returns path + query + hash, ready for pushState/replaceState.
 */
export function labUrl(href: string, route: LabRoute): string {
  const url = new URL(href);
  const params = url.searchParams;
  params.set('legacy', '0');
  for (const k of LAB_PARAMS) params.delete(k);
  params.set('c', route.catalogId);
  if (route.entityId) params.set('e', route.entityId);
  if (route.step) params.set('s', route.step);
  if (route.view) params.set('v', route.view);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The address that opens `route` in the lab from anywhere in the app. */
export function labHref(route: LabRoute): string {
  return labUrl('http://pof.local/', route);
}

/** `href` with the lab's own params removed (the lab left the page); `null` when it names none. */
export function withoutLabParams(href: string): string | null {
  const url = new URL(href);
  if (!LAB_PARAMS.some((k) => url.searchParams.has(k))) return null;
  for (const k of LAB_PARAMS) url.searchParams.delete(k);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** One comparable key per location (field order fixed), so equal locations compare equal. */
export function labRouteKey(route: LabRoute): string {
  return labHref(route);
}
