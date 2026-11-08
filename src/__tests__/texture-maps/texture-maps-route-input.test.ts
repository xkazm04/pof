import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ derive: vi.fn(async () => new Uint8Array([1])) }));
vi.mock('@/lib/texture-maps', () => ({
  deriveNormalFromAlbedo: h.derive,
  deriveHeightFromAlbedo: h.derive,
  deriveRoughnessFromAlbedo: h.derive,
}));

import { POST } from '@/app/api/texture-maps/route';

const raw = (body: string) => new Request('http://localhost/api/texture-maps', { method: 'POST', body });
const ALBEDO = Buffer.from('fake-png').toString('base64');

beforeEach(() => h.derive.mockClear());

describe('POST /api/texture-maps input', () => {
  it.each(['{nope', 'null', '[1]'])('answers 400 for %s', async (body) => {
    expect((await POST(raw(body))).status).toBe(400);
  });

  it.each([
    ['a string', '"3"'],
    ['a negative', '-1'],
    ['an overflowed literal', '1e999'],
  ])('refuses strength as %s', async (_l, literal) => {
    const res = await POST(raw(`{"albedoBase64":"${ALBEDO}","strength":${literal}}`));
    expect(res.status).toBe(400);
    expect(h.derive).not.toHaveBeenCalled();
  });

  it('refuses an albedo that decodes to no bytes', async () => {
    expect((await POST(raw('{"albedoBase64":"!!!"}'))).status).toBe(400);
    expect(h.derive).not.toHaveBeenCalled();
  });

  it('accepts zero and an absent strength', async () => {
    expect((await POST(raw(`{"albedoBase64":"${ALBEDO}","strength":0}`))).status).toBe(200);
    expect((await POST(raw(`{"albedoBase64":"${ALBEDO}"}`))).status).toBe(200);
  });
});
