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

/** The /Game/Diablo folder each catalog's content lives under (W10: items beside the bestiary). */
const FOLDER: Record<string, string> = { bestiary: 'Bestiary', items: 'Items' };

export function diabloUeRoot(entity: { id: string; name: string }, catalogId = 'bestiary'): { root: string; slug: string } {
  const folder = FOLDER[catalogId];
  if (!folder) throw new Error(`no /Game/Diablo folder declared for catalog "${catalogId}"`);
  return rootFor(entity.name, entity.id, shared(catalogId), folder);
}
