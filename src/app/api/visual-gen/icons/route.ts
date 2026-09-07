import { NextRequest } from 'next/server';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildIconList, iconsFor, type GeneratedIcon } from '@/lib/visual-gen/generated-icons';
import { iconSidecarName, parseIconSidecar } from '@/lib/visual-gen/icon-from-mesh';
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
 * An icon RENDERED from a mesh (`icon-from-mesh.ts`) carries a `<base>.render.json`
 * sidecar; where one is present and readable the entry declares `renderedFrom`, so a
 * gallery can tell art that depicts the shipped asset from art that merely illustrates
 * it. The sidecar is not an image, so it never enters the manifest as art of its own,
 * and an unreadable one leaves the field ABSENT rather than asserting an origin.
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
  const cached = readListingCache<GeneratedIcon[]>(CACHE_KEY, stamp);
  if (cached) return cached;
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return null;
  }
  // The sidecar names come out of the SAME readdir — no extra directory scan — and only
  // an icon that actually has one costs a read.
  const present = new Set(files);
  const stated = await Promise.all(
    files.map(async (name) => {
      try {
        const s = await stat(join(dir, name));
        // isFile() is load-bearing, not defensive: `generated/icons/_unaddressable/` is a
        // real subdirectory of art no registered step can address, and it must never
        // reach the manifest. Caching a shaped list keeps that filter upstream of the
        // cache, so a warm read cannot reintroduce it.
        if (!s.isFile()) return null;
        const sidecar = iconSidecarName(name);
        if (!present.has(sidecar)) return { name, mtimeMs: s.mtimeMs };
        const prov = parseIconSidecar(await readFile(join(dir, sidecar), 'utf-8').catch(() => ''));
        return prov ? { name, mtimeMs: s.mtimeMs, renderedFrom: prov.renderedFrom } : { name, mtimeMs: s.mtimeMs };
      } catch {
        return null;
      }
    }),
  );
  const all = buildIconList(
    stated.filter((f): f is { name: string; mtimeMs: number; renderedFrom?: string } => f != null),
  );
  writeListingCache(CACHE_KEY, all, stamp);
  return all;
}
