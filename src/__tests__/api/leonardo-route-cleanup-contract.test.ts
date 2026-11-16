import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Leonardo itself is stubbed: no network, no credits. The route is what is under test.
const generateImage = vi.fn<(...args: unknown[]) => Promise<unknown>>()
  .mockResolvedValue({ imageUrl: 'u', generationId: 'g', imageBase64: 'AA' });
vi.mock('@/lib/leonardo', () => ({
  MAX_PROMPT_LENGTH: 1500,
  generateImage: (...args: unknown[]) => generateImage(...args),
  upscaleImage: vi.fn(),
  unzoomImage: vi.fn(),
  generateTextureOn3DModel: vi.fn(),
}));

import { POST } from '@/app/api/leonardo/route';

const post = (body: unknown) =>
  POST(new Request('http://localhost/api/leonardo', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/leonardo — the download-then-delete cleanup is not a request option', () => {
  const saved = process.env.LEONARDO_API_KEY;
  beforeEach(() => { process.env.LEONARDO_API_KEY = 'test'; generateImage.mockClear(); });
  afterEach(() => { process.env.LEONARDO_API_KEY = saved; });

  it('drops a caller-sent cleanup:false, so the generation is still deleted after download', async () => {
    const res = await post({ mode: 'image', prompt: 'a shield', opts: { cleanup: false, width: 768 } });
    expect(res.status).toBe(200);
    const opts = generateImage.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.cleanup).not.toBe(false);
    expect(opts.width).toBe(768); // real generation options still pass through
  });

  it('drops a caller-sent pollIntervalMs (a test seam, not a request knob)', async () => {
    await post({ mode: 'image', prompt: 'a shield', opts: { pollIntervalMs: 0 } });
    const opts = generateImage.mock.calls[0][1] as Record<string, unknown>;
    expect('pollIntervalMs' in opts).toBe(false);
  });

  it('a non-object opts is treated as no options', async () => {
    await post({ mode: 'image', prompt: 'a shield', opts: 'cleanup=false' });
    expect(generateImage.mock.calls[0][1]).toEqual({});
  });
});
