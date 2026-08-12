import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/texture-maps', () => ({
  deriveNormalFromAlbedo: vi.fn(async () => new Uint8Array([1, 2, 3])),
  deriveHeightFromAlbedo: vi.fn(async () => new Uint8Array([4, 5])),
  deriveRoughnessFromAlbedo: vi.fn(async () => new Uint8Array([6, 7])),
}));

import { POST } from '@/app/api/texture-maps/route';
import { deriveNormalFromAlbedo, deriveRoughnessFromAlbedo } from '@/lib/texture-maps';

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

  it('returns the full derivable map set (height + roughness beside normal)', async () => {
    const albedoBase64 = Buffer.from('fake-png').toString('base64');
    const res = await POST(req({ albedoBase64 }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.heightBase64).toBe(Buffer.from(new Uint8Array([4, 5])).toString('base64'));
    expect(json.data.roughnessBase64).toBe(Buffer.from(new Uint8Array([6, 7])).toString('base64'));
  });

  it('forwards roughnessInvert:false to the roughness derivation', async () => {
    const albedoBase64 = Buffer.from('fake-png').toString('base64');
    await POST(req({ albedoBase64, roughnessInvert: false }));
    expect(deriveRoughnessFromAlbedo).toHaveBeenCalledWith(expect.any(Uint8Array), { invert: false });
  });

  it('rejects a missing albedo with 400', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
