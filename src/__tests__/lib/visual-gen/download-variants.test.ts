import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ambientCgVariants,
  polyHavenVariants,
  flattenGltfUris,
  isListingUrl,
  type DownloadVariant,
  type PolyHavenFiles,
} from '@/lib/visual-gen/download-variants';
import { searchAmbientCG } from '@/lib/visual-gen/asset-sources';

/**
 * Download used to hand over whatever `downloadUrl` the search row carried: for Poly Haven
 * that is `api.polyhaven.com/files/<id>` — a 20 KB JSON listing — and for ambientCG the first
 * of 8 zips with its size thrown away. These cases pin the real file trees, captured from the
 * live APIs 2026-09-29 and trimmed into `src/__tests__/fixtures/asset-sources/`.
 */

const FIX = join(process.cwd(), 'src/__tests__/fixtures/asset-sources');
const fixture = <T>(name: string): T => JSON.parse(readFileSync(join(FIX, name), 'utf8')) as T;

const armchair = fixture<PolyHavenFiles>('ph-files-ArmChair_01.json');
const hdri = fixture<PolyHavenFiles>('ph-files-aarfontein_dawn_2.json');
const asphalt = fixture<PolyHavenFiles>('ph-files-aerial_asphalt_01.json');
const ground = fixture<{ foundAssets: Parameters<typeof ambientCgVariants>[0][] }>('acg-search-Ground112.json');
const gltf1k = fixture<Record<string, unknown>>('ArmChair_01_1k.gltf.json');

const sum = (v: DownloadVariant) => v.files.reduce((s, f) => s + f.bytes, 0);

afterEach(() => vi.restoreAllMocks());

describe('case 1 — ambientCG: every package with its size, not downloads[0]', () => {
  const variants = ambientCgVariants(ground.foundAssets[0]);

  it('yields the 8 packages in API order with their real byte sizes', () => {
    expect(variants.map((v) => v.label)).toEqual([
      '1K-JPG', '2K-JPG', '4K-JPG', '8K-JPG', '1K-PNG', '2K-PNG', '4K-PNG', '8K-PNG',
    ]);
    expect(variants[0].totalBytes).toBe(9_765_076);
    expect(variants[7].totalBytes).toBe(1_091_386_141);
    for (const v of variants) {
      expect(v.files).toHaveLength(1);
      expect(v.files[0].url).toBe(`https://ambientcg.com/get?file=Ground112_${v.label}.zip`);
      expect(v.mainUrl).toBe(v.files[0].url);
      expect(v.totalBytes).toBe(sum(v));
    }
  });

  it('searchAmbientCG carries the variants on the search row', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(ground), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const [row] = await searchAmbientCG('Ground112', 1, 0);
    expect(row.variants?.map((v) => v.label)).toEqual(variants.map((v) => v.label));
    expect(row.variants?.[7].totalBytes).toBe(1_091_386_141);
  });
});

describe('case 2 — Poly Haven models: glTF per resolution, every include counted', () => {
  const variants = polyHavenVariants(armchair, 'models');

  it('1k / 2k / 4k glTF with the bundle totals', () => {
    expect(variants.map((v) => v.label)).toEqual(['1K glTF', '2K glTF', '4K glTF']);
    expect(variants.map((v) => v.totalBytes)).toEqual([769_144, 2_805_307, 10_845_355]);
  });

  it('files[] holds the .gltf, the .bin and each texture, and sums to totalBytes', () => {
    for (const v of variants) {
      expect(v.format).toBe('gltf');
      expect(v.files).toHaveLength(5);
      expect(v.files[0].path).toBe(`ArmChair_01_${v.resolution}.gltf`);
      expect(v.mainUrl).toBe(v.files[0].url);
      expect(v.files.map((f) => f.path)).toContain('ArmChair_01.bin');
      expect(v.files.filter((f) => f.path.endsWith('.jpg'))).toHaveLength(3);
      expect(v.totalBytes).toBe(sum(v));
    }
  });
});

describe('case 3 — Poly Haven HDRIs and texture map sets', () => {
  it('HDRI: hdr and exr per resolution; 1k hdr is one 1,486,826-byte file on dl.polyhaven.org', () => {
    const variants = polyHavenVariants(hdri, 'hdris');
    const oneK = variants.filter((v) => v.resolution === '1k');
    expect(oneK.map((v) => v.format).sort()).toEqual(['exr', 'hdr']);
    const hdr = oneK.find((v) => v.format === 'hdr')!;
    expect(hdr.files).toHaveLength(1);
    expect(hdr.totalBytes).toBe(1_486_826);
    expect(new URL(hdr.files[0].url).host).toBe('dl.polyhaven.org');
    expect(oneK.find((v) => v.format === 'exr')!.totalBytes).toBe(5_737_577);
    // Every resolution Poly Haven lists is offered, smallest first.
    expect([...new Set(variants.map((v) => v.resolution))]).toEqual(['1k', '2k', '4k', '8k', '16k', '24k']);
  });

  it('textures: a per-resolution jpg maps variant of the flat map files', () => {
    const variants = polyHavenVariants(asphalt, 'textures');
    const jpg1k = variants.find((v) => v.resolution === '1k' && v.format === 'jpg')!;
    expect(jpg1k).toBeTruthy();
    const paths = jpg1k.files.map((f) => f.path);
    expect(paths).toContain('aerial_asphalt_01_diff_1k.jpg');
    expect(paths).toContain('aerial_asphalt_01_nor_gl_1k.jpg');
    expect(paths).toContain('aerial_asphalt_01_rough_1k.jpg');
    expect(jpg1k.files.every((f) => f.url.endsWith('.jpg'))).toBe(true);
    expect(jpg1k.files.find((f) => f.path === 'aerial_asphalt_01_diff_1k.jpg')!.bytes).toBe(635_143);
    expect(jpg1k.totalBytes).toBe(sum(jpg1k));
    // Bundle formats (blend / gltf / mtlx) are not map files.
    expect(variants.some((v) => ['blend', 'gltf', 'mtlx'].includes(v.format))).toBe(false);
  });
});

describe('case 4 — a listing is never a file', () => {
  it('isListingUrl recognises the Poly Haven files listing, not the CDN files', () => {
    expect(isListingUrl('https://api.polyhaven.com/files/ArmChair_01')).toBe(true);
    expect(isListingUrl('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aarfontein_dawn_2_1k.hdr')).toBe(false);
    expect(isListingUrl('https://ambientcg.com/get?file=Ground112_1K-JPG.zip')).toBe(false);
  });

  it('no variant from the four fixtures points at a listing', () => {
    const all = [
      ...polyHavenVariants(armchair, 'models'),
      ...polyHavenVariants(hdri, 'hdris'),
      ...polyHavenVariants(asphalt, 'textures'),
      ...ambientCgVariants(ground.foundAssets[0]),
    ];
    expect(all.length).toBeGreaterThan(20);
    for (const v of all) {
      expect(isListingUrl(v.mainUrl)).toBe(false);
      for (const f of v.files) expect(isListingUrl(f.url)).toBe(false);
    }
  });
});

describe('case 6 — a flat-saved glTF still finds its textures and buffer', () => {
  const include = (armchair.gltf as Record<string, { gltf: { include: Record<string, { url: string }> } }>)['1k'].gltf.include;
  const variant = polyHavenVariants(armchair, 'models')[0];

  it('rewrites images[].uri and buffers[].uri to the saved filenames', () => {
    const out = flattenGltfUris(gltf1k, include) as { images: { uri: string }[]; buffers: { uri: string }[] };
    const uris = out.images.map((i) => i.uri);
    expect(uris).toContain('Armchair_01_diff_1k.jpg');
    expect(uris.some((u) => u.includes('/'))).toBe(false);
    const saved = variant.files.map((f) => f.path);
    for (const u of uris) expect(saved).toContain(u);
    expect(saved).toContain(out.buffers[0].uri);
  });

  it('leaves data: URIs and unknown URIs untouched, and does not mutate its input', () => {
    const input = {
      images: [{ uri: 'data:image/png;base64,AAAA' }, { uri: 'elsewhere/unknown.png' }, { uri: 'textures/Armchair_01_arm_1k.jpg' }],
      buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }],
    };
    const before = JSON.stringify(input);
    const out = flattenGltfUris(input, include) as typeof input;
    expect(out.images.map((i) => i.uri)).toEqual([
      'data:image/png;base64,AAAA', 'elsewhere/unknown.png', 'Armchair_01_arm_1k.jpg',
    ]);
    expect(out.buffers[0].uri).toBe('data:application/octet-stream;base64,AAAA');
    expect(JSON.stringify(input)).toBe(before);
  });
});
