import type { MaterialCatalogEntry } from './types';

/**
 * Phase 8 substrate proof: the materials catalog is registered but seeded
 * empty. Phase 8b lifts real data from `material-db.ts` / `MaterialRecord`
 * (existing visual-gen substrate) into this catalog. Audio + animation-assets
 * follow the same template.
 */
export function seedMaterialEntries(): MaterialCatalogEntry[] {
  return [];
}
