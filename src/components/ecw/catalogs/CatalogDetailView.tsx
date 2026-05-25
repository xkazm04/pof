'use client';

import { ChevronLeft } from 'lucide-react';
import { useEcwStore } from '@/stores/ecwStore';
import { useCatalogEntities, useCatalogEntity } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { EntityTree } from './EntityTree';
import { EntityInspector } from '@/components/ecw/inspector/EntityInspector';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  catalogId: string;
}

/**
 * Per-catalog detail view. Header (label + back-to-hub) + 2-column body
 * (EntityTree left, EntityInspector right). The right pane resolves
 * `activeEntityId` from `ecwStore` into the actual stored entity.
 */
export function CatalogDetailView({ catalogId }: Props) {
  const activeEntityId = useEcwStore((s) => s.activeEntityId);
  const selectEntity = useEcwStore((s) => s.selectEntity);
  const entities = useCatalogEntities(catalogId);
  const selectedEntity = useCatalogEntity(catalogId, activeEntityId ?? '');

  const label = CATALOG_SECTIONS.find((s) => s.catalogId === catalogId)?.label ?? catalogId;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0">
        <button
          onClick={() => selectEntity(null, null)}
          className="focus-ring flex items-center gap-1 px-2 py-1 rounded text-xs text-text-muted hover:text-text hover:bg-surface/40"
          aria-label="back to catalogs"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Catalogs</span>
        </button>
        <h1 className="text-lg font-bold text-text">{label}</h1>
        <span className="ml-auto text-xs text-text-muted">
          {entities.length} entities
        </span>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-border/40 bg-surface-deep/40 shrink-0 flex flex-col">
          <EntityTree catalogId={catalogId} entities={entities} />
        </div>
        <div className="flex-1 flex overflow-hidden bg-background">
          <EntityInspector entity={(selectedEntity as StoredCatalogEntity | undefined) ?? null} />
        </div>
      </div>
    </div>
  );
}
