'use client';

import { useState } from 'react';
import { Loader2, Download, Check, Box, ImageOff } from 'lucide-react';
import type { AssetResult, AssetSource } from '@/lib/blender-mcp/types';
import { assetKey } from '@/lib/blender-mcp/assetBrowser';

/** Per-source badge label + Tailwind palette classes (no raw hex). */
const SOURCE_BADGE: Record<AssetSource, { label: string; cls: string }> = {
  polyhaven: {
    label: 'PolyHaven',
    cls: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  },
  sketchfab: {
    label: 'Sketchfab',
    cls: 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30',
  },
};

interface AssetCardProps {
  asset: AssetResult;
  isImporting: boolean;
  isImported: boolean;
  /** Import is blocked (e.g. Blender not connected, or another import running). */
  disabled: boolean;
  onImport: (asset: AssetResult) => void;
}

export function AssetCard({
  asset,
  isImporting,
  isImported,
  disabled,
  onImport,
}: AssetCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const badge = SOURCE_BADGE[asset.source];
  const key = assetKey(asset);

  return (
    <div
      data-testid={`asset-card-${key}`}
      className="group relative flex flex-col rounded-lg border border-border bg-surface-secondary overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-black/40 flex items-center justify-center overflow-hidden">
        {asset.thumbnailUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbs
          <img
            src={asset.thumbnailUrl}
            alt={asset.name || asset.id}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-text-muted">
            {asset.thumbnailUrl ? (
              <ImageOff className="w-6 h-6" aria-hidden="true" />
            ) : (
              <Box className="w-6 h-6" aria-hidden="true" />
            )}
            <span className="text-2xs">No preview</span>
          </div>
        )}

        {/* Source badge */}
        <span
          className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-2xs font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Meta + action */}
      <div className="flex flex-col gap-1.5 p-2">
        <p
          className="text-xs font-medium text-text truncate"
          title={asset.name || asset.id}
        >
          {asset.name || asset.id}
        </p>
        {asset.category && (
          <p className="text-2xs text-text-muted truncate capitalize">
            {asset.category}
          </p>
        )}

        <button
          type="button"
          data-testid={`asset-import-${key}`}
          onClick={() => onImport(asset)}
          disabled={disabled || isImporting || isImported}
          aria-label={
            isImported
              ? `${asset.name || asset.id} imported to Blender`
              : `Import ${asset.name || asset.id} to Blender`
          }
          className={`focus-ring inline-flex items-center justify-center gap-1.5 h-7 rounded-md text-2xs font-semibold transition-colors disabled:cursor-not-allowed ${
            isImported
              ? 'bg-status-green-subtle text-green-400'
              : 'bg-[var(--visual-gen)] text-white hover:brightness-110 disabled:opacity-50'
          }`}
        >
          {isImported ? (
            <>
              <Check className="w-3.5 h-3.5" aria-hidden="true" /> In scene
            </>
          ) : isImporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />{' '}
              Importing…
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> Import
            </>
          )}
        </button>
      </div>
    </div>
  );
}
