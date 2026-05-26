/**
 * Server-side reader for seeded catalog entities.
 * Thin wrapper over CATALOG_SECTIONS so API routes can access seeded entities
 * without importing client-side store modules.
 */
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

/**
 * Return all statically-seeded entities for a catalogId.
 * Returns an empty array when the catalogId is not registered.
 */
export function seededEntities(catalogId: string): StoredCatalogEntity[] {
  const section = CATALOG_SECTIONS.find((s) => s.catalogId === catalogId);
  if (!section) return [];
  return section.seed() as StoredCatalogEntity[];
}
