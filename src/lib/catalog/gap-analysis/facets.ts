/**
 * Envelope facets - dimensions every catalog entity can answer, whatever its `data` holds.
 *
 * A plugin declares dimensions as paths into `entity.data`, but generic starters carry only
 * `{ description }`, so a stale plugin measures nothing. A path starting with `@` reads the
 * shared envelope instead: `@lifecycle` and `@category` (first `categoryPath` segment).
 * Facets are a FALLBACK (see `analyzeCatalog`) and carry no expected share, so they never
 * produce under-represented rows - a histogram of what exists, not a claim about balance.
 */
import type { StoredCatalogEntity } from '@/lib/catalog/types';

export const FACET_DIMENSIONS = ['@category', '@lifecycle'] as const;

/** True for an envelope-facet path (`@...`); a proposal's `data` cannot carry one. */
export function isFacet(path: string): boolean {
  return path.startsWith('@');
}

/** Read a dot-path value from an entity's `data` payload. */
export function readPath(data: unknown, path: string): unknown {
  if (data == null || typeof data !== 'object') return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, data);
}

/** Read one dimension path off an entity: `@lifecycle` / `@category` from the envelope, else from `data`. */
export function readEntityPath(entity: StoredCatalogEntity, path: string): unknown {
  if (path === '@lifecycle') return entity.lifecycle;
  if (path === '@category') return entity.categoryPath?.[0];
  return readPath(entity.data, path);
}
