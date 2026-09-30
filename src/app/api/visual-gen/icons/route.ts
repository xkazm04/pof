import { NextRequest } from 'next/server';
import { stat } from 'node:fs/promises';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { iconsFor, type GeneratedIcon } from '@/lib/visual-gen/generated-icons';
import { ICON_LISTING_CACHE_KEY, iconLibraryDir, readIconLibrary } from '@/lib/visual-gen/icon-library';
import { readListingCache, writeListingCache } from '@/lib/visual-gen/generated-assets';

/**
 * GET /api/visual-gen/icons — list the generated per-step 2D art in `generated/icons/`.
 *
 * Mirrors `/api/visual-gen/assets` (the proven 3D listing): dir absent → `{ icons: [] }`
 * (an empty gallery, not an error), so a step with no generated art falls back to the
 * honest deterministic swatch.
 *
 * Optional filter — `?catalogId=…&step=…[&entityId=…]` (or the pre-computed `?slug=…`)
 * returns only the art generated FOR that pipeline artifact, matched on the generator's own
 * filename id. With an `entityId` the entity's own art wins and the per-step icon is the
 * fallback; without one, only step-scoped art is returned (one entity's art must never
 * answer for the whole catalog). Every entry declares the `scope` it was matched at.
 *
 * The manifest is the library door's (`icon-library.ts` `readIconLibrary`) — the SAME
 * reader bind-icons and settle use. Every entry carries the `origin` of its CURRENT bytes
 * (contact-sheet cell / mesh render / `unrecorded`), accepted only while the writer's
 * sidecar is bound to the file's size + mtime; a mesh-render origin also surfaces as
 * `renderedFrom`. Sidecars are not images, so they never enter the manifest as art.
 *
 * Every gallery mount used to pay a `readdir` plus one `stat` PER FILE to filter down to
 * (typically) one match. The shaped list is now cached in-process against the directory's
 * own mtime and a short TTL (`LISTING_TTL_MS`) — see `readListingCache` for exactly how
 * that cache learns about the out-of-process gap-loop writers; an in-app commit through the
 * door drops the entry outright, so an in-place overwrite is not served stale. The `?slug=`
 * filter is applied AFTER the cache, so one mount warms the listing for every step and no
 * request can ever see another step's filter.
 */
export async function GET(req: NextRequest) {
  const dir = iconLibraryDir();
  const q = req.nextUrl.searchParams;
  const catalogId = q.get('catalogId');
  const step = q.get('step');
  const entityId = q.get('entityId');
  const slug = q.get('slug');
  try {
    const all = await listIcons(dir);
    if (all === null) return apiSuccess({ icons: [] }); // dir absent → empty gallery, not an error
    // An explicit `?slug=` is an exact lookup and stays exact. `(catalogId, step[, entityId])`
    // goes through the library's precedence: the entity's own art wins, the per-step icon is
    // the fallback, and each entry carries the `scope` that answered.
    if (slug) return apiSuccess({ icons: all.filter((i) => i.slug === slug) });
    if (catalogId && step) return apiSuccess({ icons: iconsFor(all, catalogId, step, entityId ?? undefined) });
    return apiSuccess({ icons: all });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to list icons', 500);
  }
}

/** The directory's own mtime — the stamp the listing cache revalidates against. */
async function dirStamp(dir: string): Promise<number | null> {
  try {
    return (await stat(dir)).mtimeMs;
  } catch {
    return null;
  }
}

/** The full shaped icon manifest, from cache when the dir is provably unchanged. `null` = no dir. */
async function listIcons(dir: string): Promise<GeneratedIcon[] | null> {
  const stamp = await dirStamp(dir);
  const cached = readListingCache<GeneratedIcon[]>(ICON_LISTING_CACHE_KEY, stamp);
  if (cached) return cached;
  // The door's reader keeps the isFile() filter (`_unaddressable/` is a real subdirectory)
  // upstream of the cache, so a warm read cannot reintroduce it.
  const all = readIconLibrary(dir);
  if (all === null) return null;
  writeListingCache(ICON_LISTING_CACHE_KEY, all, stamp);
  return all;
}
