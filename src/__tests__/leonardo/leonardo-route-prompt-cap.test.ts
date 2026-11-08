import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  unzoom: vi.fn(async () => ({ imageUrl: 'u', variationId: 'v', imageBase64: 'QQ==', variationDeleted: true })),
  texture: vi.fn(async () => ({ modelAssetId: 'm' })),
}));
vi.mock('@/lib/leonardo', () => ({
  generateImage: vi.fn(),
  upscaleImage: vi.fn(),
  unzoomImage: h.unzoom,
  generateTextureOn3DModel: h.texture,
  MAX_PROMPT_LENGTH: 10,
}));
vi.mock('@/lib/db', () => ({ getDb: vi.fn(() => ({})) }));

import { POST } from '@/app/api/leonardo/route';

const post = (body: unknown) => POST(new Request('http://localhost/api/leonardo', { method: 'POST', body: JSON.stringify(body) }));
const OBJ = Buffer.from('v 0 0 0').toString('base64');

beforeEach(() => {
  process.env.LEONARDO_API_KEY = 'k';
  h.unzoom.mockClear();
  h.texture.mockClear();
});

describe('POST /api/leonardo caps every prompt it forwards', () => {
  it('refuses an over-long unzoom prompt before the provider call', async () => {
    expect((await post({ mode: 'unzoom', imageId: 'i', prompt: 'x'.repeat(11) })).status).toBe(400);
    expect(h.unzoom).not.toHaveBeenCalled();
  });

  it('refuses an over-long texture3d prompt before the upload', async () => {
    expect((await post({ mode: 'texture3d', objBase64: OBJ, prompt: 'x'.repeat(11) })).status).toBe(400);
    expect(h.texture).not.toHaveBeenCalled();
  });

  it('forwards prompts at the cap', async () => {
    expect((await post({ mode: 'unzoom', imageId: 'i', prompt: 'x'.repeat(10) })).status).toBe(200);
    expect((await post({ mode: 'texture3d', objBase64: OBJ, prompt: 'x'.repeat(10) })).status).toBe(200);
  });
});
