import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/leonardo', () => ({
  generateImage: vi.fn(async () => ({ imageUrl: 'u', generationId: 'g', imageBase64: 'YQ==' })),
  upscaleImage: vi.fn(async () => ({ upscaleJobId: 'up-1' })),
  unzoomImage: vi.fn(async () => ({ unzoomJobId: 'uz-1' })),
  generateTextureOn3DModel: vi.fn(async () => ({ modelAssetId: 'm', albedoUrl: 'a', normalUrl: 'n', roughnessUrl: 'r' })),
  MAX_PROMPT_LENGTH: 1500,
}));

vi.mock('@/lib/visual-gen/seam-check', () => ({
  detectSeamsSafe: vi.fn(async () => ({
    horizontal: { axis: 'left', delta: 0.3, seam: true },
    vertical: { axis: 'top', delta: 0.01, seam: false },
    hasSeam: true,
    threshold: 0.08,
    worstEdge: 'left edge',
  })),
}));

import { POST } from '@/app/api/leonardo/route';
import * as leo from '@/lib/leonardo';
import { detectSeamsSafe } from '@/lib/visual-gen/seam-check';

function req(body: unknown): Request {
  return new Request('http://localhost/api/leonardo', { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => { process.env.LEONARDO_API_KEY = 'k'; vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/leonardo', () => {
  it('back-compat: prompt-only routes to image mode', async () => {
    const res = await POST(req({ prompt: 'a sword' }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.imageUrl).toBe('u');
    expect(leo.generateImage).toHaveBeenCalledWith('a sword', {});
  });

  it('mode=image forwards opts', async () => {
    await POST(req({ mode: 'image', prompt: 'rock', opts: { tiling: true } }));
    expect(leo.generateImage).toHaveBeenCalledWith('rock', { tiling: true });
  });

  it('runs a seam check and attaches it when tiling is requested', async () => {
    const res = await POST(req({ mode: 'image', prompt: 'rock', opts: { tiling: true } }));
    const json = await res.json();
    expect(detectSeamsSafe).toHaveBeenCalled();
    expect(json.data.seam).toMatchObject({ hasSeam: true, worstEdge: 'left edge' });
  });

  it('skips the seam check for non-tiling image generation', async () => {
    const res = await POST(req({ mode: 'image', prompt: 'a sword' }));
    const json = await res.json();
    expect(detectSeamsSafe).not.toHaveBeenCalled();
    expect(json.data.seam ?? null).toBeNull();
  });

  it('mode=image forwards controlnets + inpaint opts', async () => {
    const opts = {
      controlnets: [{ initImageId: 'i1', preprocessorId: 67 }],
      inpaint: { initImageId: 'b1', maskImageId: 'm1' },
    };
    await POST(req({ mode: 'image', prompt: 'icon', opts }));
    expect(leo.generateImage).toHaveBeenCalledWith('icon', opts);
  });

  it('mode=unzoom routes to unzoomImage', async () => {
    const res = await POST(req({ mode: 'unzoom', imageId: 'img-3', prompt: 'more floor' }));
    const json = await res.json();
    expect(json.data.unzoomJobId).toBe('uz-1');
    expect(leo.unzoomImage).toHaveBeenCalledWith('img-3', { prompt: 'more floor' });
  });

  it('rejects missing imageId in unzoom mode', async () => {
    const res = await POST(req({ mode: 'unzoom' }));
    expect(res.status).toBe(400);
  });

  it('mode=upscale routes to upscaleImage', async () => {
    const res = await POST(req({ mode: 'upscale', imageId: 'img-1', style: 'GENERAL' }));
    const json = await res.json();
    expect(json.data.upscaleJobId).toBe('up-1');
    expect(leo.upscaleImage).toHaveBeenCalledWith('img-1', 'GENERAL');
  });

  it('mode=texture3d routes to generateTextureOn3DModel', async () => {
    const objBase64 = Buffer.from('obj-bytes').toString('base64');
    const res = await POST(req({ mode: 'texture3d', objBase64, prompt: 'stone' }));
    const json = await res.json();
    expect(json.data.albedoUrl).toBe('a');
    expect(leo.generateTextureOn3DModel).toHaveBeenCalled();
  });

  it('rejects missing prompt in image mode', async () => {
    const res = await POST(req({ mode: 'image' }));
    expect(res.status).toBe(400);
  });
});
