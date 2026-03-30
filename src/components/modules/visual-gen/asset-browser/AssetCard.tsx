'use client';

import { Download, ExternalLink, Loader2 } from 'lucide-react';
import type { AssetSearchResult } from '@/lib/visual-gen/asset-sources';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { useAssetBrowserStore } from '@/components/modules/visual-gen/asset-browser/useAssetBrowserStore';

interface AssetCardProps {
  asset: AssetSearchResult;
  onDownload: (asset: AssetSearchResult) => void;
}

export function AssetCard({ asset, onDownload }: AssetCardProps) {
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);
  const importToBlender = useAssetBrowserStore((s) => s.importToBlender);
  const isImporting = useAssetBrowserStore((s) => s.isImporting);
  const importing = isImporting === asset.id;

  return (
    <div className="rounded-lg border border-border bg-surface/50 overflow-hidden group hover:border-[var(--visual-gen)] transition-colors">
      {/* Thumbnail */}
      <div className="aspect-square bg-[var(--surface-deep)] relative overflow-hidden">
        {asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
            No preview
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onDownload(asset)}
            className="p-2 rounded-full bg-[var(--visual-gen)] text-white hover:brightness-110"
            title="Download"
          >
            <Download size={16} />
          </button>
          {blenderConnected && (
            <button
              onClick={() => importToBlender(asset.source, asset.id)}
              disabled={importing}
              className="p-2 rounded-full bg-surface-secondary text-text hover:brightness-110 disabled:opacity-50"
              title="Import to Blender"
            >
              {importing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ExternalLink size={16} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-medium text-text truncate" title={asset.name}>
          {asset.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded">
            CC0
          </span>
          <span className="text-[10px] text-text-muted capitalize">{asset.source}</span>
        </div>
      </div>
    </div>
  );
}
