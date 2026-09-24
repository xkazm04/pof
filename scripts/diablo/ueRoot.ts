/**
 * Where an ingested entity's UE content lives — the scripts' door to `@/lib/catalog/reference/ueRoot`.
 * Shared display names are computed over the WHOLE wrapped source table (not the promoted slice), so a
 * folder cannot change when another monster with the same name is promoted later (W07).
 */
import { getDb } from '../../src/lib/db';
import { listWrappers } from '../../src/lib/catalog/reference/wrappers-db';
import { diabloUeRoot as rootFor, sharedNames } from '../../src/lib/catalog/reference/ueRoot';

const cache = new Map<string, Set<string>>();
function shared(catalogId: string): Set<string> {
  if (!cache.has(catalogId)) {
    cache.set(catalogId, sharedNames(listWrappers(getDb(), { sourceId: 'diablo1', catalogId }).map((w) => ({ name: w.entity.name }))));
  }
  return cache.get(catalogId)!;
}

export function diabloUeRoot(entity: { id: string; name: string }, catalogId = 'bestiary'): { root: string; slug: string } {
  return rootFor(entity.name, entity.id, shared(catalogId));
}
