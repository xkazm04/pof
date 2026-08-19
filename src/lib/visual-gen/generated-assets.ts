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
