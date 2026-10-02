// @vitest-environment node
/**
 * POST /api/texture-maps `persist:true` — the free, local derivation writes its
 * maps as SERVED files (so they travel to Blender, where a data: URL is refused),
 * labels each one with what it epistemically is, names the channel it refuses,
 * and re-runs the seam check on the DERIVED bytes. Real sharp; fs writes mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, writeFile: vi.fn(async () => undefined), mkdir: vi.fn(async () => undefined) };
});

import { writeFile } from 'node:fs/promises';
import { POST } from '@/app/api/texture-maps/route';
import { safeGeneratedImageName } from '@/lib/visual-gen/image-providers';
import { detectSeams } from '@/lib/visual-gen/seam-check';

function req(body: unknown): Request {
  return new Request('http://localhost/api/texture-maps', { method: 'POST', body: JSON.stringify(body) });
}

/** An 8x8 greyscale PNG from a per-pixel luminance function. */
async function png8(lum: (x: number, y: number) => number): Promise<string> {
  const buf = Buffer.alloc(8 * 8 * 3);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v = Math.round(lum(x, y));
      buf.fill(v, (y * 8 + x) * 3, (y * 8 + x) * 3 + 3);
    }
  }
  const out = await sharp(buf, { raw: { width: 8, height: 8, channels: 3 } }).png().toBuffer();
  return out.toString('base64');
}

/** Translation-periodic, low-amplitude: tileable in, and its wrap-around normal is tileable too. */
const tileable = () => png8((x, y) => 128 + 10 * Math.sin((2 * Math.PI * x) / 8) + 6 * Math.cos((2 * Math.PI * y) / 8));

/**
 * Mirror-symmetric ramp: column 0 equals column 7 (the source wraps clean), but the
 * gradients there point opposite ways, so the DERIVED normal has a seam. Only a
 * check run on the derived bytes can see it.
 */
const mirrored = () => png8((x) => 70 + 30 * Math.min(x, 7 - x));

type MapEntry = { channel: string; url: string; name: string; provenance: string; method: string; seam: { hasSeam: boolean } | null };

beforeEach(() => vi.mocked(writeFile).mockClear());

describe('POST /api/texture-maps persist:true', () => {
  it('case 1: writes normal/roughness/height as served files, each labelled', async () => {
    const res = await POST(req({ albedoBase64: await tileable(), persist: true }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const maps = data.maps as MapEntry[];
    expect(maps.map((m) => m.channel).sort()).toEqual(['height', 'normal', 'roughness']);
    const by = Object.fromEntries(maps.map((m) => [m.channel, m]));
    expect(by.normal.provenance).toBe('derived');
    expect(by.normal.method).toMatch(/sobel.*wrap/i);
    expect(by.roughness.provenance).toBe('heuristic');
    expect(by.roughness.method).toMatch(/inverted luminance/i);
    expect(by.height.provenance).toBe('derived');
    for (const m of maps) {
      expect(m.url).toMatch(/^\/api\/visual-gen\/image\/[^/]+\.png$/);
      expect(safeGeneratedImageName(m.name)).toBe(m.name);
      expect(m.url.endsWith(`/${m.name}`)).toBe(true);
    }
    expect(writeFile).toHaveBeenCalledTimes(3);
    for (const [path] of vi.mocked(writeFile).mock.calls) {
      expect(String(path)).toMatch(/generated[\\/]images[\\/][^\\/]+\.png$/);
    }
  });

  it('case 2: metallic is refused by name, never emitted as a map', async () => {
    const res = await POST(req({ albedoBase64: await tileable(), persist: true }));
    const { data } = await res.json();
    expect(data.refused).toHaveLength(1);
    expect(data.refused[0].channel).toBe('metallic');
    expect(data.refused[0].reason).toMatch(/no metalness signal/);
    expect((data.maps as MapEntry[]).some((m) => m.channel === 'metallic')).toBe(false);
  });

  it('case 3: every derived map carries a seam re-check; a tileable input yields a seam-free normal', async () => {
    const res = await POST(req({ albedoBase64: await tileable(), persist: true }));
    const { data } = await res.json();
    for (const m of data.maps as MapEntry[]) expect(m.seam).not.toBeNull();
    const normal = (data.maps as MapEntry[]).find((m) => m.channel === 'normal')!;
    expect(normal.seam!.hasSeam).toBe(false);
  });

  it('case 3b: the re-check runs on the DERIVED bytes — a seam-free source whose normal seams is flagged', async () => {
    const albedoBase64 = await mirrored();
    const source = await detectSeams(new Uint8Array(Buffer.from(albedoBase64, 'base64')));
    expect(source.hasSeam).toBe(false);
    const res = await POST(req({ albedoBase64, persist: true }));
    const { data } = await res.json();
    const normal = (data.maps as MapEntry[]).find((m) => m.channel === 'normal')!;
    expect(normal.seam!.hasSeam).toBe(true);
  });

  it('case 4 [guard]: without persist the legacy base64 body is unchanged and nothing is written', async () => {
    const res = await POST(req({ albedoBase64: await tileable() }));
    const { data } = await res.json();
    expect(Object.keys(data).sort()).toEqual(['heightBase64', 'normalBase64', 'roughnessBase64']);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
