/**
 * SERVER-ONLY half of the proposal validation: link resolution reads the seeded + persisted
 * catalogs (`seededEntities` → `catalog-db` → better-sqlite3). It lives apart from
 * `proposal-issues.ts` because that module's pure helpers are imported by client components
 * (`ProposalView`, `ProposalIssues`), and one shared module dragged SQLite into the browser bundle
 * (the lab at `/` failed to compile in dev: "Can't resolve 'fs'").
 */
import { seededEntities } from '@/lib/catalog/seed';
import type { ValidationContext } from './validate-proposal';

/**
 * Link resolution against the seeded catalogs: `seededEntities` is read lazily and once per
 * catalog for the lifetime of the returned context (one request).
 */
export function seededLinkContext(): Pick<ValidationContext, 'resolveLink' | 'knownCatalog'> {
  const cache = new Map<string, Set<string>>();
  const idsOf = (catalogId: string): Set<string> => {
    let ids = cache.get(catalogId);
    if (!ids) {
      ids = new Set(seededEntities(catalogId).map((e) => e.id));
      cache.set(catalogId, ids);
    }
    return ids;
  };
  return {
    resolveLink: (catalogId, entityId) => idsOf(catalogId).has(entityId),
    knownCatalog: (catalogId) => idsOf(catalogId).size > 0,
  };
}
