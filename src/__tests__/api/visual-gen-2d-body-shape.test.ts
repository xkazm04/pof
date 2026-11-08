/**
 * POST /api/visual-gen/generate-2d refuses a malformed body before the provider. A non-string
 * `providerId` used to become "no provider chosen", so the request spent on the DEFAULT
 * provider, and any width or height was forwarded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { generateTwoDImage } = vi.hoisted(() => ({ generateTwoDImage: vi.fn() }));
vi.mock('@/lib/visual-gen/image-providers', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/image-providers')>()),
  generateTwoDImage,
}));
vi.mock('@/lib/db', () => ({ getDb: () => { throw new Error('the DB must not open'); } }));

const { POST } = await import('@/app/api/visual-gen/generate-2d/route');

const raw = (body: string) =>
  POST(new NextRequest('http://localhost/api/visual-gen/generate-2d', { method: 'POST', body }));
const post = (body: unknown) => raw(JSON.stringify(body));

beforeEach(() => {
  generateTwoDImage.mockReset();
  generateTwoDImage.mockResolvedValue({ ok: true, name: 'a.png', url: '/x', providerId: 'p', providerName: 'P', durationMs: 1 });
});

describe('POST /api/visual-gen/generate-2d — body shape', () => {
  it.each(['{not json', 'null', '[]'])('refuses the body %s with a 400', async (body) => {
    expect((await raw(body)).status).toBe(400);
    expect(generateTwoDImage).not.toHaveBeenCalled();
  });

  it.each([
    ['prompt', 5],
    ['providerId', 42],
    ['size', 1024],
    ['width', -1],
    ['width', 1.5],
    ['height', 100000],
    ['height', '512'],
  ])('refuses %s=%j before the provider', async (field, value) => {
    const res = await post({ prompt: 'a lantern', [field]: value });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain(field);
    expect(generateTwoDImage).not.toHaveBeenCalled();
  });

  it('[guard] a well-formed request reaches the provider with its dimensions', async () => {
    const res = await post({ prompt: 'a lantern', width: 768, height: 512, providerId: null });
    expect(res.status).toBe(200);
    expect(generateTwoDImage.mock.calls[0][0]).toMatchObject({ width: 768, height: 512, providerId: undefined });
  });
});
