/* eslint-disable no-restricted-syntax -- the hex literal below is a PBR base
   COLOUR under test (material data), not a UI theme colour. */
/**
 * "Derive maps from albedo" — the lab's first client of /api/texture-maps.
 *
 * The store reads the albedo's BYTES (a blob: URL means nothing to the server),
 * POSTs them to the free local route with persist:true, and fills only the EMPTY
 * slots with the served files, each carrying its provenance label. It never
 * reaches a paid route, and a derived label never sticks to a later user map.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';
import { planMaterialTransfer } from '@/components/modules/visual-gen/material-lab/materialTransfer';

const NORMAL_URL = '/api/visual-gen/image/derived_abc_normal.png';
const ROUGH_URL = '/api/visual-gen/image/derived_abc_roughness.png';
const HEIGHT_URL = '/api/visual-gen/image/derived_abc_height.png';

const ROUTE_DATA = {
  maps: [
    { channel: 'normal', name: 'derived_abc_normal.png', url: NORMAL_URL, provenance: 'derived', method: 'luminance Sobel, wrap-around', colourSpace: 'linear', seam: null },
    { channel: 'roughness', name: 'derived_abc_roughness.png', url: ROUGH_URL, provenance: 'heuristic', method: 'inverted luminance', colourSpace: 'linear', seam: null },
    { channel: 'height', name: 'derived_abc_height.png', url: HEIGHT_URL, provenance: 'derived', method: 'luminance heightfield', colourSpace: 'linear', seam: null },
  ],
  refused: [{ channel: 'metallic', reason: 'albedo carries no metalness signal' }],
};

const ALBEDO_BYTES = new Uint8Array([1, 2, 3]);
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url === 'blob:alb') {
      return { ok: true, status: 200, arrayBuffer: async () => ALBEDO_BYTES.slice().buffer } as unknown as Response;
    }
    if (url === '/api/texture-maps') {
      return { ok: true, status: 200, json: async () => ({ success: true, data: ROUTE_DATA }) } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({ success: false, error: `unexpected ${url}` }) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  useMaterialStore.getState().reset();
});

afterEach(() => vi.unstubAllGlobals());

describe('useMaterialStore.deriveMapsFromAlbedo', () => {
  it('case 5: sends bytes, fills empty slots with labelled served maps, touches no paid route; a later user map drops the label', async () => {
    useMaterialStore.setState({ albedoTexture: 'blob:alb' });
    const before = useMaterialStore.getState().textureHighlightTick;

    const result = await useMaterialStore.getState().deriveMapsFromAlbedo();
    expect(result.ok).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('blob:alb');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/texture-maps');
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ albedoBase64: Buffer.from(ALBEDO_BYTES).toString('base64'), persist: true });
    expect(String(init.body)).not.toContain('blob:');

    const s = useMaterialStore.getState();
    expect(s.normalTexture).toBe(NORMAL_URL);
    expect(s.roughnessTexture).toBe(ROUGH_URL);
    expect(s.textureHighlightTick.normal).toBe(before.normal + 1);
    expect(s.textureHighlightTick.roughness).toBe(before.roughness + 1);
    expect(s.textureProvenance.normal).toBe('derived');
    expect(s.textureProvenance.roughness).toBe('heuristic');

    s.setTexture('normal', 'blob:user');
    const label = useMaterialStore.getState().textureProvenance.normal;
    expect(label === undefined || label === 'authored').toBe(true);
  });

  it('case 6: an already-loaded normal is left alone and reported skipped; roughness still fills', async () => {
    useMaterialStore.setState({ albedoTexture: 'blob:alb', normalTexture: 'blob:user-normal' });
    const result = await useMaterialStore.getState().deriveMapsFromAlbedo();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = useMaterialStore.getState();
    expect(s.normalTexture).toBe('blob:user-normal');
    expect(s.textureProvenance.normal).not.toBe('derived');
    expect(result.data.skipped).toEqual([{ channel: 'normal', reason: expect.stringMatching(/already loaded/) }]);
    expect(s.roughnessTexture).toBe(ROUGH_URL);
    expect(result.data.refused.map((r) => r.channel)).toEqual(['metallic']);
  });

  it('case 7: no albedo -> err naming the albedo, and fetch is never called', async () => {
    const result = await useMaterialStore.getState().deriveMapsFromAlbedo();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/albedo/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('a served derived map travels to Blender', () => {
  it('case 8 [guard]: planMaterialTransfer resolves the served normal and carries Normal Strength', () => {
    const plan = planMaterialTransfer(
      { baseColor: '#808080', metallic: 0, roughness: 0.5, normalStrength: 1.4, aoStrength: 1 },
      { albedo: null, normal: '/api/visual-gen/image/derived_1_normal.png', metallic: null, roughness: null, ao: null },
      'http://h',
    );
    expect(plan.textures.normal).toBe('http://h/api/visual-gen/image/derived_1_normal.png');
    expect(plan.sent).toContain('Normal map');
    expect(plan.sent).toContain('Normal Strength');
  });
});
