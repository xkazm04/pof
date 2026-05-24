'use client';

import type { ComponentType } from 'react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

export interface FacetDef {
  /** Unique within its catalog. Used as the tab key. */
  id: string;
  /** Human-readable tab label. */
  label: string;
  /** Rendered with the active entity as prop. */
  Component: ComponentType<{ entity: StoredCatalogEntity }>;
}

const _registry = new Map<string, FacetDef[]>();

/**
 * Register a per-catalog custom facet. Called by side-effect import of a
 * facet module (e.g., importing BestiaryDetailFacet's module registers
 * itself). EntityFacetsTabStrip reads this registry at render time.
 */
export function registerFacet(catalogId: string, def: FacetDef): void {
  const existing = _registry.get(catalogId) ?? [];
  // Replace by id if re-registering (keeps tests deterministic).
  const next = existing.filter((f) => f.id !== def.id);
  next.push(def);
  _registry.set(catalogId, next);
}

/** Return facets registered for a catalog, in registration order. */
export function getFacetsForCatalog(catalogId: string): FacetDef[] {
  return _registry.get(catalogId) ?? [];
}

/** Test-only: clears the registry between tests. */
export function __resetFacetRegistry(): void {
  _registry.clear();
}
