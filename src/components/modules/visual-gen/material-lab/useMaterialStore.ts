import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import { createMaterialScript } from '@/lib/blender-mcp/scripts/create-material';
import { ok, type Result } from '@/types/result';

export interface PBRParams {
  baseColor: string;     // hex color
  metallic: number;      // 0-1
  roughness: number;     // 0-1
  normalStrength: number;// 0-2
  aoStrength: number;    // 0-1
}

export interface MaterialPreset {
  id: string;
  name: string;
  params: PBRParams;
  /** SQLite `created_at` (UTC "YYYY-MM-DD HH:MM:SS") — the server is the single source. */
  createdAt: string;
}

/** Shape returned by `/api/visual-gen/materials` (see `material-db.ts`). */
interface MaterialRecordDto {
  id: string;
  name: string;
  params: Record<string, unknown>;
  createdAt: string;
}

const MATERIALS_ENDPOINT = '/api/visual-gen/materials';

/**
 * Coerce a stored params blob back into `PBRParams`, filling any field an older
 * row is missing from the defaults rather than letting `undefined` reach a
 * slider. Named fields only — an unknown key in the row is not silently adopted.
 */
function toPbrParams(raw: Record<string, unknown>): PBRParams {
  const num = (key: keyof PBRParams, fallback: number) =>
    typeof raw[key] === 'number' ? (raw[key] as number) : fallback;
  return {
    baseColor: typeof raw.baseColor === 'string' ? raw.baseColor : DEFAULT_PARAMS.baseColor,
    metallic: num('metallic', DEFAULT_PARAMS.metallic),
    roughness: num('roughness', DEFAULT_PARAMS.roughness),
    normalStrength: num('normalStrength', DEFAULT_PARAMS.normalStrength),
    aoStrength: num('aoStrength', DEFAULT_PARAMS.aoStrength),
  };
}

function toPreset(record: MaterialRecordDto): MaterialPreset {
  return { id: record.id, name: record.name, params: toPbrParams(record.params), createdAt: record.createdAt };
}

export type PreviewMesh = 'sphere' | 'cube' | 'plane' | 'cylinder';

export type TextureChannel = 'albedo' | 'normal' | 'metallic' | 'roughness' | 'ao';

/** Convert a hex color string like "#c0c0c0" to [r, g, b] in 0-1 range. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b];
}

interface MaterialState {
  params: PBRParams;
  previewMesh: PreviewMesh;
  /**
   * User presets, mirroring the `materials` table. These are the SAVED ones —
   * {@link BUILT_IN_PRESETS} are compiled-in starting points that are never
   * persisted and have no delete affordance, so a built-in can neither be lost
   * nor removed by the user.
   */
  presets: MaterialPreset[];
  activePresetId: string | null;
  /** True once a `loadPresets` has SUCCEEDED — a failed load must not look loaded. */
  presetsLoaded: boolean;
  presetsLoading: boolean;
  /** Monotonic per-session suffix so two presets saved in the same millisecond differ. */
  presetSeq: number;

  // Texture URLs (blob URLs from file uploads)
  albedoTexture: string | null;
  normalTexture: string | null;
  metallicTexture: string | null;
  roughnessTexture: string | null;
  aoTexture: string | null;

  // Per-channel "just updated" tick — increments whenever setTexture is called.
  // TextureSlot subscribes to its channel's tick to trigger a Framer Motion
  // highlight when a value is piped in from another panel (e.g. Advanced).
  textureHighlightTick: Record<TextureChannel, number>;

  setParam: <K extends keyof PBRParams>(key: K, value: PBRParams[K]) => void;
  setParams: (params: Partial<PBRParams>) => void;
  setPreviewMesh: (mesh: PreviewMesh) => void;
  setTexture: (channel: TextureChannel, url: string | null) => void;
  /** Fetch the saved presets. Returns the failure so the caller can show it with a retry. */
  loadPresets: () => Promise<Result<MaterialPreset[], string>>;
  /** Persist the current params under `name`. Resolves to the new preset id. */
  addPreset: (name: string) => Promise<Result<string, string>>;
  loadPreset: (id: string) => void;
  /** Delete a saved preset server-side, then locally. A failure leaves the row visible. */
  removePreset: (id: string) => Promise<Result<true, string>>;
  reset: () => void;
  sendToBlender: (materialName?: string) => Promise<Result<unknown, string>>;
}

const DEFAULT_PARAMS: PBRParams = {
  baseColor: '#808080',
  metallic: 0,
  roughness: 0.5,
  normalStrength: 1,
  aoStrength: 1,
};

export const BUILT_IN_PRESETS: Array<{ name: string; params: PBRParams }> = [
  { name: 'Polished Metal', params: { baseColor: '#c0c0c0', metallic: 1.0, roughness: 0.1, normalStrength: 1, aoStrength: 1 } },
  { name: 'Rough Stone', params: { baseColor: '#7a7a6e', metallic: 0, roughness: 0.8, normalStrength: 1.2, aoStrength: 1 } },
  { name: 'Wood', params: { baseColor: '#8b6914', metallic: 0, roughness: 0.5, normalStrength: 0.8, aoStrength: 1 } },
  { name: 'Plastic', params: { baseColor: '#cc3333', metallic: 0, roughness: 0.4, normalStrength: 0.5, aoStrength: 1 } },
  { name: 'Gold', params: { baseColor: '#ffd700', metallic: 1.0, roughness: 0.2, normalStrength: 0.5, aoStrength: 1 } },
  { name: 'Rubber', params: { baseColor: '#2a2a2a', metallic: 0, roughness: 0.9, normalStrength: 0.3, aoStrength: 1 } },
];

export const useMaterialStore = create<MaterialState>((set, get) => ({
  params: { ...DEFAULT_PARAMS },
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

  textureHighlightTick: { albedo: 0, normal: 0, metallic: 0, roughness: 0, ao: 0 },

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value }, activePresetId: null })),

  setParams: (partial) =>
    set((s) => ({ params: { ...s.params, ...partial }, activePresetId: null })),

  setPreviewMesh: (mesh) => set({ previewMesh: mesh }),

  setTexture: (channel, url) => {
    const key = `${channel}Texture` as keyof MaterialState;
    set((s) => ({
      [key]: url,
      textureHighlightTick: {
        ...s.textureHighlightTick,
        [channel]: s.textureHighlightTick[channel] + 1,
      },
    } as Partial<MaterialState>));
  },

  loadPresets: async () => {
    set({ presetsLoading: true });
    const result = await tryApiFetch<MaterialRecordDto[]>(MATERIALS_ENDPOINT);
    if (!result.ok) {
      // Deliberately do NOT set presetsLoaded: an empty list after a failed load
      // reads as "you have no presets", which is a lie. The caller renders the
      // error with a retry instead.
      set({ presetsLoading: false });
      return result;
    }
    const presets = result.data.map(toPreset);
    set({ presets, presetsLoaded: true, presetsLoading: false });
    return ok(presets);
  },

  addPreset: async (name) => {
    const { params, presetSeq } = get();
    const seq = presetSeq + 1;
    const id = `preset-${Date.now()}-${seq}`;
    const snapshot = { ...params };
    set({ presetSeq: seq });

    const result = await tryApiFetch<MaterialRecordDto>(MATERIALS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, params: snapshot }),
    });
    // The preset joins the list only once the row exists — an optimistic entry
    // that vanished on the next reload would be exactly the bug being fixed.
    if (!result.ok) return result;

    const preset = toPreset(result.data);
    set((s) => ({ presets: [preset, ...s.presets], activePresetId: preset.id }));
    return ok(preset.id);
  },

  loadPreset: (id) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset) return;
    set({ params: { ...preset.params }, activePresetId: id });
  },

  removePreset: async (id) => {
    const result = await tryApiFetch<{ deleted: boolean }>(MATERIALS_ENDPOINT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!result.ok) return result;

    set((s) => ({
      presets: s.presets.filter((p) => p.id !== id),
      activePresetId: s.activePresetId === id ? null : s.activePresetId,
    }));
    return ok(true as const);
  },

  reset: () =>
    set({
      params: { ...DEFAULT_PARAMS },
      activePresetId: null,
      albedoTexture: null,
      normalTexture: null,
      metallicTexture: null,
      roughnessTexture: null,
      aoTexture: null,
      textureHighlightTick: { albedo: 0, normal: 0, metallic: 0, roughness: 0, ao: 0 },
    }),

  sendToBlender: async (materialName?: string) => {
    const { params } = get();
    const name = materialName ?? `PoF_Material_${Date.now()}`;
    const code = createMaterialScript({
      name,
      baseColor: hexToRgb(params.baseColor),
      metallic: params.metallic,
      roughness: params.roughness,
    });

    return tryApiFetch<unknown>('/api/blender-mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  },
}));
