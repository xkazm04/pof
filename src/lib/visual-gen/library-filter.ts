/**
 * Pure client-side filtering for the Asset Library. The store loads the full
 * tracked set once and filters in memory so search/filter is instant (a user's
 * downloaded-asset count is small). Mirrors the SQL filter in
 * `asset-library-db.listLibraryAssets`.
 */

import type { LibraryAsset, LibraryFilter } from '@/types/asset-library';

export function filterLibraryAssets(assets: LibraryAsset[], filter: LibraryFilter): LibraryAsset[] {
  const q = filter.query?.trim().toLowerCase();

  return assets.filter((a) => {
    if (filter.source && filter.source !== 'all' && a.source !== filter.source) return false;
    if (filter.category && filter.category !== 'all' && a.category !== filter.category) return false;
    if (filter.favoritesOnly && !a.favorite) return false;
    if (filter.collectionId && !a.collectionIds.includes(filter.collectionId)) return false;
    if (q) {
      const haystack = `${a.name} ${a.tags.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
