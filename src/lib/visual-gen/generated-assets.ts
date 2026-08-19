/** Pure helpers for the /3d studio's generated-asset gallery + serving route. */

export interface GeneratedAsset {
  name: string;
  sizeBytes: number;
  mtimeMs: number;
  url: string;
  previewUrl: string | null;
  /** Which generated/ dir the file came from — 'triposr', 'tripo3d', 'mesh-finish', … */
  provider: string;
  /** Human label for that source, for a gallery tag. */
  providerLabel: string;
  /**
   * Retry index parsed from the `_aN` suffix the cloud job store writes (`attemptPath`).
   * Present ⇒ this file is attempt N of a gate-driven re-roll. It is deliberately NOT
   * called "rejected": attempt 2 is the DELIVERED mesh whenever attempt 1 failed the gate
   * and 2 passed, and nothing on disk records which one the job handed over.
   */
  attempt?: number;
}

/** One whitelisted source dir under `generated/`. */
export interface AssetDirSpec {
  /** Directory name under `generated/` — also the `dir` query value and the `provider` tag. */
  dir: string;
  label: string;
}

/**
 * Every dir under `generated/` a mesh may legitimately be served from.
 *
 * The list + serve routes used to hardcode `generated/triposr` while the generate route
 * writes `generated/<providerId>/` and mesh-finish writes `generated/mesh-finish/`. So
 * the /3d gallery and the lab's 3D-Generation step could not see a single Tripo cloud
 * mesh, Hunyuan mesh or finished low-poly — measured 2026-08-19: 24 `.glb` in tripo3d and
 * 9 in meshes were unreachable, and the lab fell back to its swatch as though none
 * existed. This is an explicit allow-list, not a scan: a new dir becomes servable only by
 * being named here.
 */
export const ASSET_DIRS: readonly AssetDirSpec[] = [
  { dir: 'triposr', label: 'TripoSR (local)' },
  { dir: 'tripo3d', label: 'Tripo3D (cloud)' },
  { dir: 'hunyuan3d', label: 'Hunyuan3D (local)' },
  { dir: 'mesh-finish', label: 'Mesh finish (retopo/decimate)' },
  { dir: 'meshes', label: 'Pipeline meshes' },
];

/**
 * The dir a request means when it names none. Kept at `triposr` so every URL already
 * stored in a pipeline artifact (`/api/visual-gen/asset/<name>` with no query) resolves
 * to exactly the file it resolved to before.
 */
export const DEFAULT_ASSET_DIR = 'triposr';

/** The list endpoint, shared by every manifest consumer so they cannot drift apart. */
export const GENERATED_ASSETS_ENDPOINT = '/api/visual-gen/assets';

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(glb|gltf|png)$/;

/** A safe basename to read from the whitelisted generated dir, or null. Pure. */
export function safeAssetName(name: string): string | null {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  return NAME_RE.test(name) ? name : null;
}

/**
 * Resolve a requested `dir` to a whitelisted spec, or null. Pure.
 *
 * Same shape of guard as `safeAssetName` and applied to the same request: a dir is only
 * ever an exact member of {@link ASSET_DIRS}, so `..`, absolute paths and separators are
 * refused by never matching rather than by being sanitised.
 */
export function safeAssetDir(dir: string | null | undefined): AssetDirSpec | null {
  if (dir === null || dir === undefined || dir === '') {
    return ASSET_DIRS.find((d) => d.dir === DEFAULT_ASSET_DIR) ?? null;
  }
  return ASSET_DIRS.find((d) => d.dir === dir) ?? null;
}

/** The serving URL for one file in one dir. The default dir keeps its bare, legacy URL. Pure. */
export function assetUrl(name: string, dir: string = DEFAULT_ASSET_DIR): string {
  const base = `/api/visual-gen/asset/${encodeURIComponent(name)}`;
  return dir === DEFAULT_ASSET_DIR ? base : `${base}?dir=${encodeURIComponent(dir)}`;
}

/** Retry index from the job store's `_aN` suffix, or undefined for a first attempt. Pure. */
export function attemptOf(name: string): number | undefined {
  const m = name.match(/_a(\d+)\.(?:glb|gltf)$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 1 ? n : undefined;
}

export interface AssetDirListing {
  dir: string;
  label?: string;
  glb: { name: string; sizeBytes: number; mtimeMs: number }[];
  previewNames: Set<string>;
}

/** Shape one dir's listing. Pure. */
function listOne(listing: AssetDirListing): GeneratedAsset[] {
  const label = listing.label ?? ASSET_DIRS.find((d) => d.dir === listing.dir)?.label ?? listing.dir;
  return listing.glb.map((g) => {
    const previewName = g.name.replace(/\.glb$/i, '.preview.png');
    const attempt = attemptOf(g.name);
    return {
      name: g.name,
      sizeBytes: g.sizeBytes,
      mtimeMs: g.mtimeMs,
      url: assetUrl(g.name, listing.dir),
      previewUrl: listing.previewNames.has(previewName) ? assetUrl(previewName, listing.dir) : null,
      provider: listing.dir,
      providerLabel: label,
      ...(attempt !== undefined ? { attempt } : {}),
    };
  });
}

/** Shape the gallery list: each .glb → its serving url + sibling preview (if present), newest first. Pure. */
export function buildAssetList(
  glb: { name: string; sizeBytes: number; mtimeMs: number }[],
  previewNames: Set<string>,
  dir: string = DEFAULT_ASSET_DIR,
): GeneratedAsset[] {
  return listOne({ dir, glb, previewNames }).sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * Shape the gallery list across every whitelisted dir, newest first overall. Pure.
 *
 * Basenames can repeat across dirs (both stores name by timestamp), so each entry carries
 * its own `provider` and a URL that names the dir — the name alone is not an identity.
 */
export function buildMultiDirAssetList(listings: AssetDirListing[]): GeneratedAsset[] {
  return listings.flatMap(listOne).sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/* ── Serving ONE generated file over HTTP ─────────────────────────────────── */

/**
 * Cache policy for a single served generated file (`/api/visual-gen/asset/:name` and
 * `/api/visual-gen/icon/:name`), which used to be a flat `no-store`.
 *
 * `private, no-cache` — deliberately NOT `immutable` / a long `max-age`. Generated
 * filenames are not content-addressed, and at least two writers reuse one
 * DETERMINISTICALLY: `scripts/gap-loop/power-icon.mjs` names every icon from
 * `iconSlug(catalogId, step)`, so re-generating a step's art OVERWRITES that exact path
 * in place, and `tripo-skins.ts` writes `<slug>.glb` into a caller-named dir. Those are
 * mutable paths; a long max-age would pin a stale image behind a URL whose bytes had
 * genuinely changed, and no cache-busting query exists to rescue it.
 *
 * `no-cache` is not "don't cache" — it lets the client STORE the bytes and requires
 * revalidation before reuse. Paired with the `ETag` below, a repeat mount costs one
 * conditional request and ZERO body bytes while the file is unchanged (the win `no-store`
 * forbade outright), and an in-place overwrite changes the etag so the very next request
 * is served in full. A re-roll that writes a NEW filename is a new URL entirely, so no
 * cached entry can mask it.
 */
export const GENERATED_FILE_CACHE_CONTROL = 'private, no-cache';

/**
 * Validator for a served generated file: its size + mtime, which move the instant the
 * bytes do — an in-place overwrite of the same filename included. Pure.
 *
 * `mtimeMs` is embedded at FULL precision (it is sub-millisecond on NTFS/ext4), not
 * rounded: rounding would widen the window in which a same-size rewrite could reuse a
 * validator, and a same-size rewrite of a deterministically-named icon is precisely the
 * case this policy has to get right.
 */
export function fileEtag(sizeBytes: number, mtimeMs: number): string {
  return `"${sizeBytes.toString(16)}-${mtimeMs}"`;
}

/** Does an `If-None-Match` header list this etag (or `*`)? RFC 9110 §13.1.2. Pure. */
export function etagMatches(ifNoneMatch: string | null | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const bare = (t: string) => t.trim().replace(/^W\//, '');
  const want = bare(etag);
  return ifNoneMatch.split(',').some((t) => {
    const v = bare(t);
    return v === '*' || v === want;
  });
}

/* ── In-process directory-listing cache ───────────────────────────────────── */

/**
 * How long a shaped directory listing may be reused without re-reading the directory.
 *
 * Deliberately SHORT, because these libraries are written OUT OF PROCESS —
 * `scripts/gap-loop/*.mjs` write straight into `generated/icons/`, mesh jobs into
 * `generated/<provider>/` — so no in-process invalidation could ever be complete, and a
 * long TTL would be a freshness claim this process cannot back. The cache learns about an
 * out-of-process write two ways:
 *
 *  1. **Directory-stamp revalidation.** Every read compares the DIRECTORY's own `mtimeMs`
 *     against the stamp the entry was built with (one `stat`, replacing one `stat` per
 *     file). A file added, removed or renamed out of process bumps that stamp, so the
 *     entry is dropped immediately — and that is the case that changes which URLs exist.
 *  2. **The TTL** bounds the one remaining case: a file overwritten IN PLACE, which
 *     leaves the directory mtime alone. That changes no URL at all — only the cached
 *     `mtimeMs` used for sort order — and the file's own bytes are revalidated per
 *     request by `ETag`, never by this cache.
 *
 * There is no filesystem watcher. {@link invalidateListingCache} exists for tests and for
 * a future in-process writer; nothing is wired to it today.
 */
export const LISTING_TTL_MS = 5_000;

interface ListingEntry {
  value: unknown;
  at: number;
  /** The directory's `mtimeMs` when this listing was built. */
  stamp: number;
}

const listingCache = new Map<string, ListingEntry>();

/** The cached listing for `key`, iff within TTL AND the directory stamp is unchanged. */
export function readListingCache<T>(key: string, stamp: number | null, now: number = Date.now()): T | undefined {
  if (stamp === null) return undefined; // could not stat the dir ⇒ cannot claim freshness
  const hit = listingCache.get(key);
  if (!hit || hit.stamp !== stamp || now - hit.at >= LISTING_TTL_MS) return undefined;
  return hit.value as T;
}

/** Remember a shaped listing against the directory stamp it came from. A null stamp is never cached. */
export function writeListingCache<T>(key: string, value: T, stamp: number | null, now: number = Date.now()): void {
  if (stamp === null) return;
  listingCache.set(key, { value, at: now, stamp });
}

/** Drop one key, or the whole cache when called with no key. */
export function invalidateListingCache(key?: string): void {
  if (key === undefined) listingCache.clear();
  else listingCache.delete(key);
}
