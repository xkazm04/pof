import { NextRequest } from 'next/server';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildIconList, iconSlug, type GeneratedIcon } from '@/lib/visual-gen/generated-icons';
import { readListingCache, writeListingCache } from '@/lib/visual-gen/generated-assets';

/**
 * GET /api/visual-gen/icons — list the generated per-step 2D art in `generated/icons/`.
 *
 * Mirrors `/api/visual-gen/assets` (the proven 3D listing): dir absent → `{ icons: [] }`
 * (an empty gallery, not an error), so a step with no generated art falls back to the
 * honest deterministic swatch.
 *
 * Optional filter — `?catalogId=…&step=…` (or the pre-computed `?slug=…`) returns only
 * the art generated FOR that pipeline step, matched on the generator's own filename id.
 *
 * Every gallery mount used to pay a `readdir` plus one `stat` PER FILE to filter down to
 * (typically) one match. The shaped list is now cached in-process against the directory's
 * own mtime and a short TTL (`LISTING_TTL_MS`) — see `readListingCache` for exactly how
 * that cache learns about the out-of-process gap-loop writers. The per-request `?slug=`
 * filter is applied AFTER the cache, so one mount warms the listing for every step and no
 * request can ever see another step's filter.
 */
const CACHE_KEY = 'icons';

export async function GET(req: NextRequest) {
  const dir = join(process.cwd(), 'generated', 'icons');
  const q = req.nextUrl.searchParams;
  const catalogId = q.get('catalogId');
  const step = q.get('step');
  const want = q.get('slug') ?? (catalogId && step ? iconSlug(catalogId, step) : null);
  try {
    const all = await listIcons(dir);
    if (all === null) return apiSuccess({ icons: [] }); // dir absent → empty gallery, not an error
    return apiSuccess({ icons: want ? all.filter((i) => i.slug === want) : all });
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
  const cached = readListingCache<GeneratedIcon[]>(CACHE_KEY, stamp);
  if (cached) return cached;
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return null;
  }
  const stated = await Promise.all(
    files.map(async (name) => {
      try {
        const s = await stat(join(dir, name));
        // isFile() is load-bearing, not defensive: `generated/icons/_unaddressable/` is a
        // real subdirectory of art no registered step can address, and it must never
        // reach the manifest. Caching a shaped list keeps that filter upstream of the
        // cache, so a warm read cannot reintroduce it.
        return s.isFile() ? { name, mtimeMs: s.mtimeMs } : null;
      } catch {
        return null;
      }
    }),
  );
  const all = buildIconList(stated.filter((f): f is { name: string; mtimeMs: number } => f != null));
  writeListingCache(CACHE_KEY, all, stamp);
  return all;
}
