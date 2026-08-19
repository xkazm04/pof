import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

/**
 * Presets are server-backed (`/api/visual-gen/materials`), so the preset tests
 * drive a fake `fetch` that behaves like the real route: a POST returns the
 * created row, a GET returns the table. The real-SQLite half of the contract
 * lives in `src/__tests__/lib/visual-gen/material-db.test.ts`.
 */
type Row = { id: string; name: string; params: Record<string, unknown>; createdAt: string; updatedAt: string };

let table: Row[] = [];
let failWith: string | null = null;

function envelope(body: unknown) {
  return { json: async () => body } as Response;
}

beforeEach(() => {
  table = [];
  failWith = null;
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    if (failWith) return envelope({ success: false, error: failWith });
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (method === 'GET') return envelope({ success: true, data: table });
    if (method === 'POST') {
      const row: Row = {
        id: String(body.id),
        name: String(body.name),
        params: body.params as Record<string, unknown>,
        createdAt: '2026-08-19 10:00:00',
        updatedAt: '2026-08-19 10:00:00',
      };
      table = [row, ...table];
      return envelope({ success: true, data: row });
    }
    if (method === 'DELETE') {
      table = table.filter((r) => r.id !== body.id);
      return envelope({ success: true, data: { deleted: true } });
    }
    return envelope({ success: false, error: `unexpected ${method}` });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMaterialStore', () => {
  beforeEach(() => {
    useMaterialStore.setState({
      params: {
        baseColor: '#808080',
        metallic: 0,
        roughness: 0.5,
        normalStrength: 1,
        aoStrength: 1,
      },
      previewMesh: 'sphere',
      presets: [],
      activePresetId: null,
      presetsLoaded: false,
      presetsLoading: false,
      presetSeq: 0,
      albedoTexture: null,
      normalTexture: null,
      metallicTexture: null,
      roughnessTexture: null,
      aoTexture: null,
    });
  });

  it('starts with default PBR params', () => {
    const { params } = useMaterialStore.getState();
    expect(params.baseColor).toBe('#808080');
    expect(params.metallic).toBe(0);
    expect(params.roughness).toBe(0.5);
    expect(params.normalStrength).toBe(1);
    expect(params.aoStrength).toBe(1);
  });

  it('sets individual PBR param', () => {
    useMaterialStore.getState().setParam('metallic', 0.8);
    expect(useMaterialStore.getState().params.metallic).toBe(0.8);
  });

  it('sets multiple PBR params', () => {
    useMaterialStore.getState().setParams({ metallic: 1.0, roughness: 0.1 });
    const { params } = useMaterialStore.getState();
    expect(params.metallic).toBe(1.0);
    expect(params.roughness).toBe(0.1);
    expect(params.baseColor).toBe('#808080'); // unchanged
  });

  it('clears activePresetId when params change', async () => {
    // First add and load a preset
    const added = await useMaterialStore.getState().addPreset('Test');
    expect(added.ok).toBe(true);
    expect(useMaterialStore.getState().activePresetId).toBe(added.ok ? added.data : null);

    // Changing a param clears the active preset
    useMaterialStore.getState().setParam('roughness', 0.9);
    expect(useMaterialStore.getState().activePresetId).toBeNull();
  });

  it('sets preview mesh', () => {
    useMaterialStore.getState().setPreviewMesh('cube');
    expect(useMaterialStore.getState().previewMesh).toBe('cube');
  });

  it('sets and clears texture', () => {
    useMaterialStore.getState().setTexture('albedo', 'blob:test-texture');
    expect(useMaterialStore.getState().albedoTexture).toBe('blob:test-texture');

    useMaterialStore.getState().setTexture('albedo', null);
    expect(useMaterialStore.getState().albedoTexture).toBeNull();
  });

  it('adds a preset from current params', async () => {
    useMaterialStore.getState().setParams({ metallic: 1.0, roughness: 0.2 });
    const added = await useMaterialStore.getState().addPreset('Gold');

    expect(added.ok).toBe(true);
    const { presets, activePresetId } = useMaterialStore.getState();
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Gold');
    expect(presets[0].params.metallic).toBe(1.0);
    expect(presets[0].params.roughness).toBe(0.2);
    expect(activePresetId).toBe(added.ok ? added.data : null);
  });

  it('loads a preset', async () => {
    useMaterialStore.getState().setParams({ metallic: 1.0, roughness: 0.1 });
    const added = await useMaterialStore.getState().addPreset('Shiny Metal');
    const id = added.ok ? added.data : '';

    // Change params
    useMaterialStore.getState().setParams({ metallic: 0, roughness: 0.9 });

    // Load preset
    useMaterialStore.getState().loadPreset(id);
    const { params, activePresetId } = useMaterialStore.getState();
    expect(params.metallic).toBe(1.0);
    expect(params.roughness).toBe(0.1);
    expect(activePresetId).toBe(id);
  });

  it('removes a preset', async () => {
    const added = await useMaterialStore.getState().addPreset('Temp');
    await useMaterialStore.getState().removePreset(added.ok ? added.data : '');
    expect(useMaterialStore.getState().presets).toHaveLength(0);
    expect(useMaterialStore.getState().activePresetId).toBeNull();
  });

  it('resets all state', async () => {
    useMaterialStore.getState().setParams({ metallic: 1, roughness: 0 });
    useMaterialStore.getState().setTexture('albedo', 'blob:tex');
    await useMaterialStore.getState().addPreset('Test');

    useMaterialStore.getState().reset();
    const state = useMaterialStore.getState();
    expect(state.params.metallic).toBe(0);
    expect(state.params.roughness).toBe(0.5);
    expect(state.albedoTexture).toBeNull();
    expect(state.activePresetId).toBeNull();
    // Presets survive reset (they're saved data)
  });
});

describe('preset persistence', () => {
  beforeEach(() => {
    useMaterialStore.setState({ presets: [], presetsLoaded: false, presetsLoading: false, presetSeq: 0, activePresetId: null });
  });

  it('a saved preset survives a reload — a fresh load returns it', async () => {
    useMaterialStore.getState().setParams({ metallic: 1, roughness: 0.15, baseColor: '#ffd700' });
    const added = await useMaterialStore.getState().addPreset('Gold');
    expect(added.ok).toBe(true);

    // Simulate a reload: the store starts empty, then loads from the server.
    useMaterialStore.setState({ presets: [], presetsLoaded: false });
    const loaded = await useMaterialStore.getState().loadPresets();
    expect(loaded.ok).toBe(true);
    expect(useMaterialStore.getState().presets.map((p) => p.name)).toEqual(['Gold']);
    expect(useMaterialStore.getState().presets[0].params).toEqual({
      baseColor: '#ffd700',
      metallic: 1,
      roughness: 0.15,
      normalStrength: 1,
      aoStrength: 1,
    });
  });

  it('a failed load surfaces the reason and does NOT report an empty list as loaded', async () => {
    failWith = 'database is locked';
    const result = await useMaterialStore.getState().loadPresets();
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toBe('database is locked');
    // presetsLoaded stays false: "no presets" must never be a swallowed error.
    expect(useMaterialStore.getState().presetsLoaded).toBe(false);
    expect(useMaterialStore.getState().presetsLoading).toBe(false);
  });

  it('a failed save adds nothing locally — no phantom preset that vanishes on reload', async () => {
    failWith = 'UNIQUE constraint failed: materials.id';
    const result = await useMaterialStore.getState().addPreset('Doomed');
    expect(result.ok).toBe(false);
    expect(useMaterialStore.getState().presets).toHaveLength(0);
  });

  it('a failed delete leaves the row visible', async () => {
    const added = await useMaterialStore.getState().addPreset('Keep');
    failWith = 'Material not found';
    const result = await useMaterialStore.getState().removePreset(added.ok ? added.data : '');
    expect(result.ok).toBe(false);
    expect(useMaterialStore.getState().presets).toHaveLength(1);
  });

  it('preset ids stay unique within a millisecond (the counter lives in the store)', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const a = await useMaterialStore.getState().addPreset('A');
    const b = await useMaterialStore.getState().addPreset('B');
    now.mockRestore();
    expect(a.ok && b.ok && a.data !== b.data).toBe(true);
    expect(useMaterialStore.getState().presetSeq).toBe(2);
  });
});
