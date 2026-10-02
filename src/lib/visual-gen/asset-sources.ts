/**
 * API clients for free CC0 asset sources.
 * All sources are Creative Commons Zero — free for commercial use.
 */

import {
  ambientCgVariants,
  isValidPolyHavenId,
  type AmbientCgDownloadRow,
  type DownloadVariant,
  type PolyHavenFiles,
} from '@/lib/visual-gen/download-variants';

/**
 * `sketchfab` used to be a third member of this union with no `searchSketchfab` beside it:
 * `/api/visual-gen/browse` answered `400 Unknown source`, and the panel only avoided that by
 * routing the chip to the Blender MCP bridge, whose `{ assets }` envelope the store then
 * assigned straight into an array-typed field — so the chip silently rendered nothing. It is
 * REMOVED rather than implemented for two reasons: `AssetSearchResult.license` below is the
 * literal `'CC0'`, which Sketchfab models are not, and the bridge-backed Sketchfab search
 * already exists as its own surface (`visual-gen/blender-pipeline/AssetBrowser.tsx` over
 * `/api/blender-mcp/assets`, whose separate union in `@/lib/blender-mcp/types` keeps it).
 */
export type AssetSource = 'polyhaven' | 'ambientcg';
export type AssetCategory = 'hdris' | 'textures' | 'models' | 'materials';

export interface AssetSearchResult {
  id: string;
  name: string;
  source: AssetSource;
  category: AssetCategory;
  thumbnailUrl: string;
  downloadUrl: string;
  license: 'CC0';
  resolutions?: string[];
  tags?: string[];
  /**
   * The files the source offers, as format x resolution choices with sizes — present when the
   * search response already carries them (ambientCG). Poly Haven's come from
   * `/api/visual-gen/browse/files`. `downloadUrl` alone is NOT the file to acquire: for Poly Haven
   * it is the JSON listing (`isListingUrl`).
   */
  variants?: DownloadVariant[];
}

export interface AssetSearchParams {
  query?: string;
  source: AssetSource;
  category?: AssetCategory;
  limit?: number;
  offset?: number;
}

// ── Poly Haven ──────────────────────────────────────────────────────────────

const POLYHAVEN_API = 'https://api.polyhaven.com';

interface PolyHavenAsset {
  name: string;
  tags: string[];
  categories: string[];
}

// The Poly Haven catalog is a CC0 list that changes rarely and is effectively
// static within a session. Cache the mapped full catalog per category so that
// repeated searches (e.g. per keystroke) filter the cached list instead of
// re-downloading and re-parsing hundreds of entries on every call.
const POLYHAVEN_CATALOG_TTL_MS = 60 * 60 * 1000; // 1 hour
const polyHavenCatalogCache = new Map<
  string,
  { fetchedAt: number; results: AssetSearchResult[] }
>();

export async function searchPolyHaven(
  category: 'hdris' | 'textures' | 'models' = 'textures',
): Promise<AssetSearchResult[]> {
  const cached = polyHavenCatalogCache.get(category);
  if (cached && Date.now() - cached.fetchedAt < POLYHAVEN_CATALOG_TTL_MS) {
    return cached.results;
  }

  const res = await fetch(`${POLYHAVEN_API}/assets?t=${category}`);
  if (!res.ok) throw new Error(`Poly Haven API error: ${res.status}`);

  const data = await res.json() as Record<string, PolyHavenAsset>;

  const results = Object.entries(data).map(([id, asset]) => ({
    id,
    name: asset.name || id,
    source: 'polyhaven' as AssetSource,
    category: (category === 'models' ? 'models' : category === 'hdris' ? 'hdris' : 'textures') as AssetCategory,
    thumbnailUrl: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`,
    downloadUrl: `${POLYHAVEN_API}/files/${id}`,
    license: 'CC0' as const,
    tags: asset.tags ?? [],
  }));

  polyHavenCatalogCache.set(category, { fetchedAt: Date.now(), results });
  return results;
}

// The per-asset file tree behind the picker. Cached per id for the same reason as the
// catalog: a re-opened picker must not re-download the listing. Failures are never cached.
const polyHavenFilesCache = new Map<string, { fetchedAt: number; files: PolyHavenFiles }>();

/** `GET api.polyhaven.com/files/<id>` — the listing of every file the asset offers. */
export async function fetchPolyHavenFiles(id: string): Promise<PolyHavenFiles> {
  if (!isValidPolyHavenId(id)) throw new Error(`Invalid Poly Haven asset id: ${id}`);
  const cached = polyHavenFilesCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < POLYHAVEN_CATALOG_TTL_MS) return cached.files;

  const res = await fetch(`${POLYHAVEN_API}/files/${id}`);
  if (!res.ok) throw new Error(`Poly Haven files API error: ${res.status}`);
  const files = await res.json() as PolyHavenFiles;
  polyHavenFilesCache.set(id, { fetchedAt: Date.now(), files });
  return files;
}

/** Test seam: forget every cached Poly Haven file listing. */
export function clearPolyHavenFilesCache(): void {
  polyHavenFilesCache.clear();
}

// ── ambientCG ───────────────────────────────────────────────────────────────

const AMBIENTCG_API = 'https://ambientcg.com/api/v2/full_json';

interface AmbientCGAsset extends AmbientCgDownloadRow {
  assetId: string;
  displayName: string;
  previewImage: { uri256: string };
  tags: string[];
}

interface AmbientCGResponse {
  foundAssets: AmbientCGAsset[];
}

export async function searchAmbientCG(
  query = '',
  limit = 20,
  offset = 0,
): Promise<AssetSearchResult[]> {
  const params = new URLSearchParams({
    type: 'Material',
    limit: String(limit),
    offset: String(offset),
    sort: 'Popular',
    include: 'displayData,previewData,downloadData,tagData',
  });
  if (query) params.set('q', query);

  const res = await fetch(`${AMBIENTCG_API}?${params}`);
  if (!res.ok) throw new Error(`ambientCG API error: ${res.status}`);

  const data = await res.json() as AmbientCGResponse;

  return (data.foundAssets ?? []).map((asset) => {
    // Every package with its size (1K-JPG .. 8K-PNG) — the picker offers them all. The row's
    // `downloadUrl` stays the first package, as before, for callers that want one link.
    const variants = ambientCgVariants(asset);
    const downloadUrl = variants[0]?.mainUrl ?? '';

    return {
      id: asset.assetId,
      name: asset.displayName || asset.assetId,
      source: 'ambientcg' as AssetSource,
      category: 'materials' as AssetCategory,
      thumbnailUrl: asset.previewImage?.uri256 ?? '',
      downloadUrl,
      license: 'CC0' as const,
      tags: asset.tags ?? [],
      variants,
    };
  });
}
