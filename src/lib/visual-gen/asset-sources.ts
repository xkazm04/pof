/**
 * API clients for free CC0 asset sources.
 * All sources are Creative Commons Zero — free for commercial use.
 */

export type AssetSource = 'polyhaven' | 'ambientcg' | 'sketchfab';
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

export async function searchPolyHaven(
  category: 'hdris' | 'textures' | 'models' = 'textures',
): Promise<AssetSearchResult[]> {
  const res = await fetch(`${POLYHAVEN_API}/assets?t=${category}`);
  if (!res.ok) throw new Error(`Poly Haven API error: ${res.status}`);

  const data = await res.json() as Record<string, PolyHavenAsset>;

  return Object.entries(data).map(([id, asset]) => ({
    id,
    name: asset.name || id,
    source: 'polyhaven' as AssetSource,
    category: category === 'models' ? 'models' : category === 'hdris' ? 'hdris' : 'textures',
    thumbnailUrl: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`,
    downloadUrl: `${POLYHAVEN_API}/files/${id}`,
    license: 'CC0' as const,
    tags: asset.tags ?? [],
  }));
}

// ── ambientCG ───────────────────────────────────────────────────────────────

const AMBIENTCG_API = 'https://ambientcg.com/api/v2/full_json';

interface AmbientCGAsset {
  assetId: string;
  displayName: string;
  previewImage: { uri256: string };
  downloadFolders: Record<string, { downloadFiletypeCategories: Record<string, { downloads: Array<{ downloadLink: string; attribute: string }> }> }>;
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
    // Find the first available download link
    let downloadUrl = '';
    const folders = Object.values(asset.downloadFolders ?? {});
    for (const folder of folders) {
      const cats = Object.values(folder.downloadFiletypeCategories ?? {});
      for (const cat of cats) {
        if (cat.downloads?.[0]?.downloadLink) {
          downloadUrl = cat.downloads[0].downloadLink;
          break;
        }
      }
      if (downloadUrl) break;
    }

    return {
      id: asset.assetId,
      name: asset.displayName || asset.assetId,
      source: 'ambientcg' as AssetSource,
      category: 'materials' as AssetCategory,
      thumbnailUrl: asset.previewImage?.uri256 ?? '',
      downloadUrl,
      license: 'CC0' as const,
      tags: asset.tags ?? [],
    };
  });
}
