/**
 * Biome → texture mapping. Gives the autonomous texture path a *themed* default
 * per biome so it stops picking industrial defaults (the PS-2 asphalt regression).
 * Prefers an ambientCG text search (PolyHaven's API has no text search), falling
 * back to a known-good PolyHaven asset id.
 */
import { searchAmbientCG, type AssetCategory, type AssetSearchResult } from './asset-sources';

export type Biome = 'dungeon' | 'cave' | 'forest' | 'desert' | 'snow' | 'industrial';

export interface BiomeTextureSpec {
  /** Themed text query for ambientCG (never a bare category). */
  searchQuery: string;
  category: AssetCategory;
  /** Known-good PolyHaven asset id used when the search returns nothing. */
  fallbackAssetId: string;
  /** Themed seamless-PBR prompt for the Leonardo tiling path. */
  leonardoPrompt: string;
}

export const BIOME_TEXTURES: Record<Biome, BiomeTextureSpec> = {
  dungeon: {
    searchQuery: 'stone floor dungeon medieval',
    category: 'materials',
    fallbackAssetId: 'cobblestone_floor_04',
    leonardoPrompt: 'dark fantasy dungeon stone floor, weathered cobblestone, seamless tileable PBR texture',
  },
  cave: {
    searchQuery: 'rock cave wall natural',
    category: 'materials',
    fallbackAssetId: 'rock_wall_10',
    leonardoPrompt: 'damp natural cave rock wall, seamless tileable PBR texture',
  },
  forest: {
    searchQuery: 'forest ground dirt leaves',
    category: 'materials',
    fallbackAssetId: 'forrest_ground_01',
    leonardoPrompt: 'forest floor with dirt, moss and fallen leaves, seamless tileable PBR texture',
  },
  desert: {
    searchQuery: 'sand desert dune fine',
    category: 'materials',
    fallbackAssetId: 'sand_dunes_02',
    leonardoPrompt: 'desert sand dunes, fine rippled grains, seamless tileable PBR texture',
  },
  snow: {
    searchQuery: 'snow ground frozen field',
    category: 'materials',
    fallbackAssetId: 'snow_field_01',
    leonardoPrompt: 'fresh snow ground, soft drifts, seamless tileable PBR texture',
  },
  industrial: {
    searchQuery: 'metal floor industrial plate',
    category: 'materials',
    fallbackAssetId: 'metal_plate_02',
    leonardoPrompt: 'industrial metal floor plate, scuffed steel, seamless tileable PBR texture',
  },
};

function polyHavenFallback(id: string, category: AssetCategory): AssetSearchResult {
  return {
    id,
    name: id,
    source: 'polyhaven',
    category,
    thumbnailUrl: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`,
    downloadUrl: `https://api.polyhaven.com/files/${id}`,
    license: 'CC0',
  };
}

/** Pick a themed CC0 texture for a biome: ambientCG text search first, PolyHaven id fallback. */
export async function pickBiomeTexture(biome: Biome): Promise<AssetSearchResult> {
  const spec = BIOME_TEXTURES[biome];
  try {
    const results = await searchAmbientCG(spec.searchQuery, 12);
    const usable = results.find((r) => r.downloadUrl);
    if (usable) return usable;
  } catch {
    // fall through to the PolyHaven fallback
  }
  return polyHavenFallback(spec.fallbackAssetId, spec.category);
}
