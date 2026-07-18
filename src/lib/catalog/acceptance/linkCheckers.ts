import type { AcceptanceResult, Checker } from './types';

export interface CatalogLinkRef { catalogId: string; entityId: string; role?: string }

/** L2 data-integrity: do a step's declared cross-catalog links resolve to real entities?
 *  `has(catalogId, entityId)` is injected (reads the catalog store). Missing targets resolve to
 *  `deferred` (the target may be authored later) — never a hard fail — so links don't block config-complete. */
export function linkTargetsExist(
  links: CatalogLinkRef[],
  has: (catalogId: string, entityId: string) => boolean,
  label = 'Cross-catalog links resolve',
): AcceptanceResult {
  if (!links.length) return { label, tier: 'L2', status: 'pending', detail: 'no links declared' };
  const missing = links.filter((l) => !has(l.catalogId, l.entityId));
  if (missing.length === 0) return { label, tier: 'L2', status: 'pass', detail: `${links.length}/${links.length} links resolve` };
  // Deferred (canon proj-links — never a hard fail; the target may be authored later), but with an
  // ACTIONABLE reason: name the unresolved targets AND what to do about them.
  return {
    label,
    tier: 'L2',
    status: 'deferred',
    detail: `${links.length - missing.length}/${links.length} resolve`,
    reason: `unresolved: ${missing.map((m) => `${m.catalogId}::${m.entityId}`).join(', ')} — seed the target entity, or drop the link and model it as descriptive data`,
  };
}

/** Read a step's declared links from its persisted data (links are stored at data.links). */
export function readLinks(data: Record<string, unknown>): CatalogLinkRef[] {
  const l = (data as { links?: unknown }).links;
  return Array.isArray(l) ? (l as CatalogLinkRef[]) : [];
}

/**
 * A `Checker` that resolves a step's declared cross-catalog links IN ACCEPT — using the
 * `has(catalog, entity)` supplied by the CheckerContext. This is the accept-time counterpart
 * of the display-only `linkTargetsExist` call: a satisfied link set → `pass`, a broken one →
 * `deferred` naming the unresolved targets (never a hard fail — the target may be authored later).
 *
 * NON-REGRESSING when context is unavailable: a rollup path that supplies no `ctx` genuinely
 * cannot resolve links, so this returns `pass` rather than dragging a satisfied step to pending.
 * The paths that CAN resolve (the lab step view via the catalog store, and the headless server
 * via seeded entities) supply `ctx`, so the real verdict surfaces there. Empty link set → `pass`.
 */
export function linksResolve(label = 'Cross-catalog links resolve'): Checker {
  return (data, ctx) => {
    const links = readLinks(data);
    if (!links.length) return { label, tier: 'L2', status: 'pass', detail: 'no links declared' };
    if (!ctx) return { label, tier: 'L2', status: 'pass', detail: `${links.length} link(s) — resolution needs catalog context` };
    return linkTargetsExist(links, ctx.has, label);
  };
}
