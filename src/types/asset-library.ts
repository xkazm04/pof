/**
 * Local Asset Library — types shared between the SQLite layer
 * (`@/lib/visual-gen/asset-library-db`), the API routes, the Zustand store, and
 * the Library UI. Every asset a user downloads through the browser is recorded
 * here so it can be searched, favorited, and grouped into collections (à la
 * Quixel Bridge / Eagle), instead of vanishing into a one-shot `window.open`.
 */

import type { AssetSource, AssetCategory } from '@/lib/visual-gen/asset-sources';

export type { AssetSource, AssetCategory };

/** A downloaded asset tracked in the local library. */
export interface LibraryAsset {
  /** Internal library id (uuid). Stable across re-downloads. */
  id: string;
  /** The source provider's own asset id. Unique per (source, assetId). */
  assetId: string;
  name: string;
  source: AssetSource;
  category: AssetCategory;
  /** License string as reported by the source (e.g. "CC0"). */
  license: string;
  thumbnailUrl: string;
  downloadUrl: string;
  tags: string[];
  favorite: boolean;
  /** Ids of the collections this asset belongs to (populated on read). */
  collectionIds: string[];
  createdAt: number;
}

/** A user-defined grouping of library assets. */
export interface Collection {
  id: string;
  name: string;
  /** Number of assets currently in the collection. */
  assetCount: number;
  createdAt: number;
}

/** Filters applied when listing the library. `'all'`/undefined means no filter. */
export interface LibraryFilter {
  query?: string;
  source?: AssetSource | 'all';
  category?: AssetCategory | 'all';
  favoritesOnly?: boolean;
  collectionId?: string | null;
}
