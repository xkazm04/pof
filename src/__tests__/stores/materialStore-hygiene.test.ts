/* eslint-disable no-restricted-syntax -- the hex literals below are PBR base
   COLOURS under test (material data), not UI theme colours. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  revoke = vi.fn();
  vi.stubGlobal('URL', Object.assign(Object.create(URL), URL, { revokeObjectURL: revoke }));
  useMaterialStore.setState({ albedoTexture: null, normalTexture: null, metallicTexture: null, roughnessTexture: null, aoTexture: null });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('useMaterialStore — uploaded blob URLs are released', () => {
  it('replacing an uploaded map revokes the superseded blob URL', () => {
    const { setTexture } = useMaterialStore.getState();
    setTexture('albedo', 'blob:http://x/one');
    setTexture('albedo', 'blob:http://x/two');
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:http://x/one');
  });

  it('clearing a slot revokes its blob URL', () => {
    const { setTexture } = useMaterialStore.getState();
    setTexture('normal', 'blob:http://x/n');
    setTexture('normal', null);
    expect(revoke).toHaveBeenCalledWith('blob:http://x/n');
  });

  it('reset revokes every uploaded blob URL', () => {
    const { setTexture } = useMaterialStore.getState();
    setTexture('albedo', 'blob:http://x/a');
    setTexture('ao', 'blob:http://x/ao');
    useMaterialStore.getState().reset();
    expect(revoke.mock.calls.map((c) => c[0]).sort()).toEqual(['blob:http://x/a', 'blob:http://x/ao']);
  });

  it('never revokes a served URL, nor a blob that is set again unchanged', () => {
    const { setTexture } = useMaterialStore.getState();
    setTexture('roughness', '/api/texture-maps/files/r.png');
    setTexture('roughness', null);
    setTexture('metallic', 'blob:http://x/m');
    setTexture('metallic', 'blob:http://x/m');
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe('useMaterialStore — a stored preset row is coerced into the sliders\' ranges', () => {
  it('clamps out-of-range numbers, drops non-finite ones and refuses a non-hex colour', async () => {
    vi.stubGlobal('fetch', async () => ({
      json: async () => ({
        success: true,
        data: [{
          id: 'p1', name: 'Bad row', createdAt: '2026-11-08 00:00:00',
          params: { baseColor: 'red', metallic: 7, roughness: -0.5, normalStrength: Number.NaN, aoStrength: 1e9 },
        }],
      }),
    }));
    const result = await useMaterialStore.getState().loadPresets();
    expect(result.ok).toBe(true);
    expect(useMaterialStore.getState().presets[0].params).toEqual({
      baseColor: '#808080', // default: 'red' is not what <input type="color"> or hexToLinearRgb accept
      metallic: 1,
      roughness: 0,
      normalStrength: 1, // NaN falls back to the default
      aoStrength: 1,
    });
  });

  it('keeps a well-formed row exactly as stored', async () => {
    const params = { baseColor: '#c0c0c0', metallic: 0.25, roughness: 0.75, normalStrength: 1.5, aoStrength: 0.5 };
    vi.stubGlobal('fetch', async () => ({
      json: async () => ({ success: true, data: [{ id: 'p2', name: 'Good', createdAt: '2026-11-08 00:00:00', params }] }),
    }));
    await useMaterialStore.getState().loadPresets();
    expect(useMaterialStore.getState().presets[0].params).toEqual(params);
  });
});
