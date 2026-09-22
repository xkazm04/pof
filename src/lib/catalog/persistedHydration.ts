/**
 * Merge server-persisted catalog entities (`catalog_entities`) into the lab's draft cache.
 *
 * The store called `draftEntitiesByCatalog` "a CACHE of the catalog_entities rows", but
 * nothing ever filled it from the server — only the one-shot flow's own `addDraft` in the
 * same browser session did. So a persisted entity from another session, another browser, or
 * an ingest (`source: 'ingest'`) existed for every server gate and was invisible in the lab.
 *
 * Precedence mirrors the server's `seededEntities`: a persisted row NEVER shadows a code seed
 * (the server reports that as a collision; the client simply does not render the row twice).
 * A server row replaces a cached entry of the same id — the server is the record — and a
 * browser-only draft the server does not know about is kept, because dropping it would lose
 * the one copy that exists.
 */
import type { StoredCatalogEntity } from './types';

export interface PersistedRow {
  catalogId: string;
  entityId: string;
  source: string;
  entity: StoredCatalogEntity;
}

type DraftMap<T> = Record<string, Record<string, T>>;

export function mergePersistedDrafts<T extends StoredCatalogEntity>(
  drafts: DraftMap<T>,
  seededIds: Record<string, Record<string, unknown>>,
  rows: PersistedRow[],
): { drafts: DraftMap<T>; added: number; shadowed: string[] } {
  const next: DraftMap<T> = { ...drafts };
  let added = 0;
  const shadowed: string[] = [];
  for (const row of rows) {
    if (seededIds[row.catalogId]?.[row.entityId]) { shadowed.push(`${row.catalogId}/${row.entityId}`); continue; }
    const catalog = { ...(next[row.catalogId] ?? {}) };
    if (!catalog[row.entityId]) added++;
    // The server copy carries no browser-only flag: it IS on the server.
    catalog[row.entityId] = { ...row.entity, id: row.entityId, catalogId: row.catalogId } as T;
    next[row.catalogId] = catalog;
  }
  return { drafts: next, added, shadowed };
}
