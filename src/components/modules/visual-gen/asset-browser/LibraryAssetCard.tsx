'use client';

import { useState } from 'react';
import { Star, Trash2, ExternalLink, FolderPlus, Check, Loader2 } from 'lucide-react';
import type { LibraryAsset, Collection } from '@/types/asset-library';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { useAssetBrowserStore } from '@/components/modules/visual-gen/asset-browser/useAssetBrowserStore';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';
import { VISUAL_GEN_FOCUS_RING } from '@/lib/visual-gen/ui';

interface LibraryAssetCardProps {
  asset: LibraryAsset;
  collections: Collection[];
}

export function LibraryAssetCard({ asset, collections }: LibraryAssetCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleFavorite = useAssetLibraryStore((s) => s.toggleFavorite);
  const removeAsset = useAssetLibraryStore((s) => s.removeAsset);
  const addToCollection = useAssetLibraryStore((s) => s.addToCollection);
  const removeFromCollection = useAssetLibraryStore((s) => s.removeFromCollection);

  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);
  const importToBlender = useAssetBrowserStore((s) => s.importToBlender);
  const isImporting = useAssetBrowserStore((s) => s.isImporting);
  const importing = isImporting === asset.assetId;

  const inCollection = (id: string) => asset.collectionIds.includes(id);

  return (
    <div className="rounded-lg border border-border bg-surface/50 overflow-hidden group hover:border-[var(--visual-gen)] focus-within:border-[var(--visual-gen)] transition-colors relative">
      {/* Thumbnail */}
      <div className="aspect-square bg-[var(--surface-deep)] relative overflow-hidden">
        {asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnailUrl} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">No preview</div>
        )}

        {/* Favorite star — always visible */}
        <button
          onClick={() => toggleFavorite(asset.id)}
          aria-label={asset.favorite ? `Unfavorite ${asset.name}` : `Favorite ${asset.name}`}
          aria-pressed={asset.favorite}
          className={`absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors ${VISUAL_GEN_FOCUS_RING}`}
        >
          <Star
            size={14}
            className={asset.favorite ? 'fill-amber-400 text-amber-400' : 'text-white'}
          />
        </button>

        {/* Hover action bar */}
        <div className="absolute inset-x-0 bottom-0 p-1.5 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
          {asset.downloadUrl && (
            <a
              href={asset.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-1.5 rounded-full bg-[var(--visual-gen)] text-white hover:brightness-110 ${VISUAL_GEN_FOCUS_RING}`}
              aria-label={`Open download for ${asset.name}`}
            >
              <ExternalLink size={14} />
            </a>
          )}
          {blenderConnected && (
            <button
              onClick={() => importToBlender(asset.source, asset.assetId)}
              disabled={importing}
              className={`p-1.5 rounded-full bg-surface-secondary text-text hover:brightness-110 disabled:opacity-50 ${VISUAL_GEN_FOCUS_RING}`}
              aria-label={`Import ${asset.name} to Blender`}
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            </button>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={`Add ${asset.name} to a collection`}
            aria-expanded={menuOpen}
            className={`p-1.5 rounded-full bg-surface-secondary text-text hover:brightness-110 ${VISUAL_GEN_FOCUS_RING}`}
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={() => removeAsset(asset.id)}
            aria-label={`Remove ${asset.name} from library`}
            className={`p-1.5 rounded-full bg-surface-secondary text-red-400 hover:brightness-110 ${VISUAL_GEN_FOCUS_RING}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Collection picker dropdown */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="absolute z-20 left-1.5 right-1.5 bottom-14 max-h-40 overflow-y-auto rounded-lg border border-border bg-surface shadow-xl p-1">
            {collections.length === 0 ? (
              <p className="text-xs text-text-muted px-2 py-1.5">No collections yet. Create one in the sidebar.</p>
            ) : (
              collections.map((c) => {
                const member = inCollection(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => (member ? removeFromCollection(c.id, asset.id) : addToCollection(c.id, asset.id))}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs text-left hover:bg-surface-hover ${VISUAL_GEN_FOCUS_RING}`}
                  >
                    <span className="truncate text-text">{c.name}</span>
                    {member && <Check size={13} className="text-[var(--visual-gen)] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-medium text-text truncate" title={asset.name}>{asset.name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {asset.license && (
            <span className="text-xs text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded">{asset.license}</span>
          )}
          <span className="text-xs text-text-muted capitalize">{asset.source}</span>
        </div>
      </div>
    </div>
  );
}
