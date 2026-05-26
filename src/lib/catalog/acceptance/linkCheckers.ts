import type { AcceptanceResult } from './types';

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
  return { label, tier: 'L2', status: 'deferred', detail: `${links.length - missing.length}/${links.length} resolve`, reason: `unresolved: ${missing.map((m) => `${m.catalogId}::${m.entityId}`).join(', ')}` };
}
