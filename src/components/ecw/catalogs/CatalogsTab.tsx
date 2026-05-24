'use client';

import { useEcwStore } from '@/stores/ecwStore';
import { CatalogHubRoot } from './CatalogHubRoot';
import { CatalogDetailView } from './CatalogDetailView';

/**
 * Top-level body for the Catalogs L1 tab. Routes between the 8-row hub
 * overview (no catalog selected) and the per-catalog detail view (catalog
 * selected) based on `ecwStore.activeCatalogId`.
 */
export function CatalogsTab() {
  const activeCatalogId = useEcwStore((s) => s.activeCatalogId);

  if (!activeCatalogId) return <CatalogHubRoot />;
  return <CatalogDetailView catalogId={activeCatalogId} />;
}
