import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/leonardo', () => ({
  generateImage: vi.fn(),
  upscaleImage: vi.fn(),
  unzoomImage: vi.fn(),
  generateTextureOn3DModel: vi.fn(),
  MAX_PROMPT_LENGTH: 1500,
}));
vi.mock('@/lib/db', () => ({ getDb: vi.fn(() => ({})) }));

import { POST } from '@/app/api/leonardo/route';

const raw = (body: string) => new Request('http://localhost/api/leonardo', { method: 'POST', body });
const original = process.env.LEONARDO_API_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.LEONARDO_API_KEY;
  else process.env.LEONARDO_API_KEY = original;
});

describe('POST /api/leonardo body and mode', () => {
  it.each(['{nope', 'null', '[1]', '"s"'])('answers 400 for %s', async (body) => {
    process.env.LEONARDO_API_KEY = 'k';
    expect((await POST(raw(body))).status).toBe(400);
  });

  it('an unknown mode is a 400 even on a machine with no key', async () => {
    delete process.env.LEONARDO_API_KEY;
    expect((await POST(raw('{"mode":"video"}'))).status).toBe(400);
  });

  it('a valid request with no key still reports the missing key', async () => {
    delete process.env.LEONARDO_API_KEY;
    const res = await POST(raw('{"prompt":"a"}'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/LEONARDO_API_KEY/);
  });
});
