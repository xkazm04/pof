'use client';

import { useState } from 'react';
import { Layers, Star, FolderPlus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Collection } from '@/types/asset-library';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';
import { VISUAL_GEN_FOCUS_RING } from '@/lib/visual-gen/ui';

interface CollectionSidebarProps {
  collections: Collection[];
  totalCount: number;
  favoriteCount: number;
}

export function CollectionSidebar({ collections, totalCount, favoriteCount }: CollectionSidebarProps) {
  const filter = useAssetLibraryStore((s) => s.filter);
  const setFilter = useAssetLibraryStore((s) => s.setFilter);
  const createCollection = useAssetLibraryStore((s) => s.createCollection);
  const renameCollection = useAssetLibraryStore((s) => s.renameCollection);
  const deleteCollection = useAssetLibraryStore((s) => s.deleteCollection);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const isAll = !filter.collectionId && !filter.favoritesOnly;
  const isFavorites = !!filter.favoritesOnly;

  const submitNew = async () => {
    const name = newName.trim();
    if (name) await createCollection(name);
    setNewName('');
    setCreating(false);
  };

  const submitRename = async (id: string) => {
    const name = editName.trim();
    if (name) await renameCollection(id, name);
    setEditingId(null);
  };

  const rowClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${VISUAL_GEN_FOCUS_RING} ${
      active ? 'bg-[var(--visual-gen)]/10 text-[var(--visual-gen)]' : 'text-text-muted hover:text-text hover:bg-surface-hover'
    }`;

  return (
    <aside className="w-48 shrink-0 space-y-1">
      <button onClick={() => setFilter({ collectionId: null, favoritesOnly: false })} className={rowClass(isAll)} aria-pressed={isAll}>
        <span className="flex items-center gap-1.5"><Layers size={13} /> All assets</span>
        <span className="text-text-muted">{totalCount}</span>
      </button>

      <button onClick={() => setFilter({ collectionId: null, favoritesOnly: true })} className={rowClass(isFavorites)} aria-pressed={isFavorites}>
        <span className="flex items-center gap-1.5"><Star size={13} /> Favorites</span>
        <span className="text-text-muted">{favoriteCount}</span>
      </button>

      <div className="flex items-center justify-between pt-3 pb-1 px-1">
        <span className="text-2xs uppercase tracking-wide text-text-muted">Collections</span>
        <button
          onClick={() => { setCreating(true); setNewName(''); }}
          aria-label="New collection"
          className={`p-1 rounded text-text-muted hover:text-text ${VISUAL_GEN_FOCUS_RING}`}
        >
          <FolderPlus size={14} />
        </button>
      </div>

      {creating && (
        <div className="flex items-center gap-1 px-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="Collection name"
            className="flex-1 min-w-0 bg-surface border border-border rounded px-2 py-1 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-[var(--visual-gen)]"
          />
          <button onClick={submitNew} aria-label="Create collection" className={`p-1 rounded text-emerald-400 ${VISUAL_GEN_FOCUS_RING}`}><Check size={14} /></button>
          <button onClick={() => setCreating(false)} aria-label="Cancel" className={`p-1 rounded text-text-muted ${VISUAL_GEN_FOCUS_RING}`}><X size={14} /></button>
        </div>
      )}

      {collections.map((c) => {
        const active = filter.collectionId === c.id;
        if (editingId === c.id) {
          return (
            <div key={c.id} className="flex items-center gap-1 px-1">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitRename(c.id); if (e.key === 'Escape') setEditingId(null); }}
                className="flex-1 min-w-0 bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-[var(--visual-gen)]"
              />
              <button onClick={() => submitRename(c.id)} aria-label="Save name" className={`p-1 rounded text-emerald-400 ${VISUAL_GEN_FOCUS_RING}`}><Check size={14} /></button>
              <button onClick={() => setEditingId(null)} aria-label="Cancel rename" className={`p-1 rounded text-text-muted ${VISUAL_GEN_FOCUS_RING}`}><X size={14} /></button>
            </div>
          );
        }
        return (
          <div key={c.id} className="group/col flex items-center">
            <button
              onClick={() => setFilter({ collectionId: c.id, favoritesOnly: false })}
              className={rowClass(active) + ' flex-1 min-w-0'}
              aria-pressed={active}
            >
              <span className="truncate">{c.name}</span>
              <span className="text-text-muted shrink-0">{c.assetCount}</span>
            </button>
            <div className="flex items-center opacity-0 group-hover/col:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                aria-label={`Rename ${c.name}`}
                className={`p-1 rounded text-text-muted hover:text-text ${VISUAL_GEN_FOCUS_RING}`}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => deleteCollection(c.id)}
                aria-label={`Delete ${c.name}`}
                className={`p-1 rounded text-text-muted hover:text-red-400 ${VISUAL_GEN_FOCUS_RING}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        );
      })}

      {collections.length === 0 && !creating && (
        <p className="text-2xs text-text-muted px-2 py-1">No collections yet.</p>
      )}
    </aside>
  );
}
