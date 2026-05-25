'use client';

import { useMemo } from 'react';
import { Database } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCatalogStore } from '@/stores/catalogStore';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';

interface CatalogAssetRow {
  catalogId: string;
  label: string;
  entityCount: number;
  generatedCount: number;
}

/**
 * Per-catalog "defined here" vs "in UE" summary. Phase 6 ships the defined-here
 * side (entity counts + generatedCount = entities with at least one ueAsset)
 * plus the UE total from `usePofBridgeStore.pluginInfo.manifestAssetCount`.
 *
 * Phase 6b enhancement: match `entity.ueAssets[]` paths against the bridge
 * manifest's `assets[].path` to compute a true defined-here-but-missing-in-UE
 * count per catalog. For now the in-UE column is "?" pending that work.
 */
export function AssetManifestCard() {
  const entitiesByCatalog = useCatalogStore(useShallow((s) => s.entitiesByCatalog));
  const pluginInfo = usePofBridgeStore((s) => s.pluginInfo);

  const rows: CatalogAssetRow[] = useMemo(
    () =>
      CATALOG_SECTIONS.map((section) => {
        const entities = Object.values(entitiesByCatalog[section.catalogId] ?? {});
        return {
          catalogId: section.catalogId,
          label: section.label,
          entityCount: entities.length,
          generatedCount: entities.filter((e) => e.ueAssets && e.ueAssets.length > 0).length,
        };
      }),
    [entitiesByCatalog],
  );

  const totalEntities = rows.reduce((s, r) => s + r.entityCount, 0);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Database className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Asset Manifest</h2>
        <span className="ml-auto text-xs text-text-muted">
          {totalEntities} entities defined
          {pluginInfo && ` · ${pluginInfo.manifestAssetCount.toLocaleString()} assets in UE`}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-x-3 text-2xs font-mono uppercase tracking-wider text-text-muted/70 px-2 py-1 border-b border-border/40">
        <span>Catalog</span>
        <span className="text-right">Defined</span>
        <span className="text-right">Generated</span>
      </div>

      <ul>
        {rows.map((r) => (
          <li
            key={r.catalogId}
            data-testid="asset-manifest-row"
            className="grid grid-cols-3 gap-x-3 text-xs px-2 py-1.5 border-b border-border/20 last:border-b-0"
          >
            <span className="text-text truncate">{r.label}</span>
            <span className="text-right font-mono text-text-muted">{r.entityCount}</span>
            <span className="text-right font-mono">
              {r.generatedCount > 0 ? (
                <span className="text-emerald-500">{r.generatedCount}</span>
              ) : (
                <span className="text-text-muted/50">0</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-2xs text-text-muted/60 italic">
        Phase 6b: match `entity.ueAssets[]` against the bridge manifest paths
        to surface defined-here-but-missing-in-UE per catalog.
      </p>
    </section>
  );
}
