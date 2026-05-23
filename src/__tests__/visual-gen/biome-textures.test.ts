import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/visual-gen/asset-sources', () => ({ searchAmbientCG: vi.fn() }));

import { BIOME_TEXTURES, pickBiomeTexture, type Biome } from '@/lib/visual-gen/biome-textures';
import { searchAmbientCG } from '@/lib/visual-gen/asset-sources';

const BIOMES = Object.keys(BIOME_TEXTURES) as Biome[];
const CATEGORIES = ['hdris', 'textures', 'models', 'materials'];

afterEach(() => vi.restoreAllMocks());

describe('BIOME_TEXTURES', () => {
  it('every biome has a themed query, prompt, valid category, and fallback id', () => {
    for (const b of BIOMES) {
      const s = BIOME_TEXTURES[b];
      expect(s.searchQuery.trim().length).toBeGreaterThan(0);
      expect(s.leonardoPrompt.trim().length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(s.category);
      expect(s.fallbackAssetId.trim().length).toBeGreaterThan(0);
    }
  });

  it('no biome query is a bare category name (anti-asphalt guard)', () => {
    for (const b of BIOMES) {
      const q = BIOME_TEXTURES[b].searchQuery.trim().toLowerCase();
      expect(CATEGORIES).not.toContain(q);
      expect(q.split(/\s+/).length).toBeGreaterThan(1); // multi-word themed query
    }
  });
});

describe('pickBiomeTexture', () => {
  it('returns the first usable ambientCG result', async () => {
    vi.mocked(searchAmbientCG).mockResolvedValue([
      { id: 'X', name: 'X', source: 'ambientcg', category: 'materials', thumbnailUrl: 't', downloadUrl: 'd', license: 'CC0' },
    ]);
    const r = await pickBiomeTexture('dungeon');
    expect(r.id).toBe('X');
    expect(r.source).toBe('ambientcg');
  });

  it('falls back to the PolyHaven id when ambientCG returns nothing', async () => {
    vi.mocked(searchAmbientCG).mockResolvedValue([]);
    const r = await pickBiomeTexture('dungeon');
    expect(r.source).toBe('polyhaven');
    expect(r.id).toBe(BIOME_TEXTURES.dungeon.fallbackAssetId);
  });

  it('falls back when the ambientCG search throws', async () => {
    vi.mocked(searchAmbientCG).mockRejectedValue(new Error('network'));
    const r = await pickBiomeTexture('forest');
    expect(r.source).toBe('polyhaven');
    expect(r.id).toBe(BIOME_TEXTURES.forest.fallbackAssetId);
  });
});
