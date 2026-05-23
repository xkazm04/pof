import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/texture-maps', () => ({
  deriveNormalFromAlbedo: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

import { POST } from '@/app/api/texture-maps/route';
import { deriveNormalFromAlbedo } from '@/lib/texture-maps';

function req(body: unknown): Request {
  return new Request('http://localhost/api/texture-maps', { method: 'POST', body: JSON.stringify(body) });
}

afterEach(() => vi.restoreAllMocks());

describe('POST /api/texture-maps', () => {
  it('returns normalBase64 for a valid albedo', async () => {
    const albedoBase64 = Buffer.from('fake-png').toString('base64');
    const res = await POST(req({ albedoBase64, strength: 3 }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.normalBase64).toBe(Buffer.from(new Uint8Array([1, 2, 3])).toString('base64'));
    expect(deriveNormalFromAlbedo).toHaveBeenCalledWith(expect.any(Uint8Array), { strength: 3 });
  });

  it('rejects a missing albedo with 400', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
