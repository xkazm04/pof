'use client';

import { useEcwStore } from '@/stores/ecwStore';
import { useCatalogRoster } from './useCatalogRoster';
import { CatalogRow } from './CatalogRow';

/**
 * The Catalog Hub root view — the landing page of the Catalogs L1 tab.
 * Renders one row per registered catalog with progress bar and counts.
 * Selecting a row routes to the per-catalog detail view via
 * `ecwStore.selectEntity(catalogId, null)`.
 */
export function CatalogHubRoot() {
  const roster = useCatalogRoster();
  const selectEntity = useEcwStore((s) => s.selectEntity);

  const handleSelect = (catalogId: string) => {
    selectEntity(catalogId, null);
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">Catalogs</h1>
        <p className="text-sm text-text-muted">
          {roster.length} catalogs · {roster.reduce((s, r) => s + r.total, 0)} entities ·{' '}
          {roster.reduce((s, r) => s + r.verified, 0)} verified
        </p>
      </header>

      <div className="space-y-2 max-w-3xl">
        {roster.map((row) => (
          <CatalogRow
            key={row.catalogId}
            catalogId={row.catalogId}
            label={row.label}
            total={row.total}
            verified={row.verified}
            failingCount={row.failingCount}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
