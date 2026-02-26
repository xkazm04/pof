import { create } from 'zustand';

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
  createdAt: number;
}

export type PreviewMesh = 'sphere' | 'cube' | 'plane' | 'cylinder';

interface MaterialState {
  params: PBRParams;
  previewMesh: PreviewMesh;
  presets: MaterialPreset[];
  activePresetId: string | null;

  // Texture URLs (blob URLs from file uploads)
  albedoTexture: string | null;
  normalTexture: string | null;
  metallicTexture: string | null;
  roughnessTexture: string | null;
  aoTexture: string | null;

  setParam: <K extends keyof PBRParams>(key: K, value: PBRParams[K]) => void;
  setParams: (params: Partial<PBRParams>) => void;
  setPreviewMesh: (mesh: PreviewMesh) => void;
  setTexture: (channel: 'albedo' | 'normal' | 'metallic' | 'roughness' | 'ao', url: string | null) => void;
  addPreset: (name: string) => string;
  loadPreset: (id: string) => void;
  removePreset: (id: string) => void;
  reset: () => void;
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

let presetCounter = 0;

export const useMaterialStore = create<MaterialState>((set, get) => ({
  params: { ...DEFAULT_PARAMS },
  previewMesh: 'sphere',
  presets: [],
  activePresetId: null,

  albedoTexture: null,
  normalTexture: null,
  metallicTexture: null,
  roughnessTexture: null,
  aoTexture: null,

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value }, activePresetId: null })),

  setParams: (partial) =>
    set((s) => ({ params: { ...s.params, ...partial }, activePresetId: null })),

  setPreviewMesh: (mesh) => set({ previewMesh: mesh }),

  setTexture: (channel, url) => {
    const key = `${channel}Texture` as keyof MaterialState;
    set({ [key]: url } as Partial<MaterialState>);
  },

  addPreset: (name) => {
    const id = `preset-${Date.now()}-${++presetCounter}`;
    const preset: MaterialPreset = {
      id,
      name,
      params: { ...get().params },
      createdAt: Date.now(),
    };
    set((s) => ({ presets: [...s.presets, preset], activePresetId: id }));
    return id;
  },

  loadPreset: (id) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset) return;
    set({ params: { ...preset.params }, activePresetId: id });
  },

  removePreset: (id) =>
    set((s) => ({
      presets: s.presets.filter((p) => p.id !== id),
      activePresetId: s.activePresetId === id ? null : s.activePresetId,
    })),

  reset: () =>
    set({
      params: { ...DEFAULT_PARAMS },
      activePresetId: null,
      albedoTexture: null,
      normalTexture: null,
      metallicTexture: null,
      roughnessTexture: null,
      aoTexture: null,
    }),
}));
