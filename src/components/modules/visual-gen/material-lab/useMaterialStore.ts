import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import { getAppOrigin } from '@/lib/constants';
import { createMaterialScript } from '@/lib/blender-mcp/scripts/create-material';
import { hexToLinearRgb, type MaterialChannel } from '@/lib/visual-gen/material-boundary';
import {
  bytesToBase64,
  derivedChannelSpec,
  type DerivedMapsResponse,
  type MapProvenance,
  type RefusedChannel,
} from '@/lib/visual-gen/derived-maps';
import { planMaterialTransfer, type MaterialTransferPlan } from './materialTransfer';
import { err, ok, type Result } from '@/types/result';

/** What one "Derive maps from albedo" click did — every slot accounted for. */
export interface DeriveMapsOutcome {
  filled: Array<{ channel: TextureChannel; provenance: MapProvenance; method: string }>;
  /** Slots that already held a map: a derivation never overwrites one. */
  skipped: Array<{ channel: TextureChannel; reason: string }>;
  /** Channels the albedo cannot honestly produce, with the reason. */
  refused: RefusedChannel[];
}

const TEXTURE_MAPS_ENDPOINT = '/api/texture-maps';

export interface SendToBlenderResult {
  name: string;
  plan: MaterialTransferPlan;
}

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

/** The lab's texture slots — the channel column of `MATERIAL_CHANNELS`. */
export type TextureChannel = MaterialChannel;

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
  /**
   * Where each slot's map came from. Set only by a derivation; any other
   * `setTexture` (upload, generation, clear) resets it, so a derived label can
   * never stick to a user's map.
   */
  textureProvenance: Partial<Record<TextureChannel, MapProvenance>>;

  setParam: <K extends keyof PBRParams>(key: K, value: PBRParams[K]) => void;
  setParams: (params: Partial<PBRParams>) => void;
  setPreviewMesh: (mesh: PreviewMesh) => void;
  setTexture: (channel: TextureChannel, url: string | null, provenance?: MapProvenance) => void;
  /**
   * Derive the missing maps from the loaded albedo through the free, local
   * `/api/texture-maps` (never a paid route). Sends the albedo's BYTES, fills only
   * EMPTY slots with the served files, and labels each. Runs only when called.
   */
  deriveMapsFromAlbedo: () => Promise<Result<DeriveMapsOutcome, string>>;
  /** Fetch the saved presets. Returns the failure so the caller can show it with a retry. */
  loadPresets: () => Promise<Result<MaterialPreset[], string>>;
  /** Persist the current params under `name`. Resolves to the new preset id. */
  addPreset: (name: string) => Promise<Result<string, string>>;
  loadPreset: (id: string) => void;
  /** Delete a saved preset server-side, then locally. A failure leaves the row visible. */
  removePreset: (id: string) => Promise<Result<true, string>>;
  reset: () => void;
  /**
   * Send the material to Blender. Resolves with the material name AND the
   * transfer plan — what actually travelled and what did not — so the UI cannot
   * report a bare success over dropped edits.
   */
  sendToBlender: (materialName?: string) => Promise<Result<SendToBlenderResult, string>>;
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
  textureProvenance: {},

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value }, activePresetId: null })),

  setParams: (partial) =>
    set((s) => ({ params: { ...s.params, ...partial }, activePresetId: null })),

  setPreviewMesh: (mesh) => set({ previewMesh: mesh }),

  setTexture: (channel, url, provenance) => {
    const key = `${channel}Texture` as keyof MaterialState;
    set((s) => ({
      [key]: url,
      textureHighlightTick: {
        ...s.textureHighlightTick,
        [channel]: s.textureHighlightTick[channel] + 1,
      },
      textureProvenance: { ...s.textureProvenance, [channel]: url ? provenance : undefined },
    } as Partial<MaterialState>));
  },

  deriveMapsFromAlbedo: async () => {
    const albedo = get().albedoTexture;
    if (!albedo) return err('Load an albedo map first: the maps are derived from its pixels.');

    // The server cannot open a blob: URL, so read the bytes here and send them.
    let albedoBase64: string;
    try {
      const res = await fetch(albedo);
      if (!res.ok) return err(`Could not read the albedo map (HTTP ${res.status}).`);
      albedoBase64 = bytesToBase64(new Uint8Array(await res.arrayBuffer()));
    } catch (e) {
      return err(`Could not read the albedo map: ${e instanceof Error ? e.message : String(e)}`);
    }

    const result = await tryApiFetch<DerivedMapsResponse>(TEXTURE_MAPS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albedoBase64, persist: true }),
    });
    if (!result.ok) return result;

    const outcome: DeriveMapsOutcome = { filled: [], skipped: [], refused: result.data.refused };
    for (const map of result.data.maps) {
      const slot = derivedChannelSpec(map.channel)?.slot;
      if (!slot) continue; // height: served, but the lab has no slot for it
      // Read the slot NOW, not before the round trip: a map the user loaded
      // meanwhile is theirs and is never overwritten.
      if (get()[`${slot}Texture`]) {
        outcome.skipped.push({ channel: slot, reason: `a ${slot} map is already loaded; derived maps fill only empty slots` });
        continue;
      }
      get().setTexture(slot, map.url, map.provenance);
      outcome.filled.push({ channel: slot, provenance: map.provenance, method: map.method });
    }
    return ok(outcome);
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
      textureProvenance: {},
    }),

  sendToBlender: async (materialName?: string) => {
    const state = get();
    const { params } = state;
    const name = materialName ?? `PoF_Material_${Date.now()}`;

    // Decide what can travel BEFORE sending, so the result can report both
    // halves. Nothing here is silently dropped: a slot that cannot be resolved
    // becomes a named `notSent` entry carrying its reason.
    const plan = planMaterialTransfer(
      params,
      {
        albedo: state.albedoTexture,
        normal: state.normalTexture,
        metallic: state.metallicTexture,
        roughness: state.roughnessTexture,
        ao: state.aoTexture,
      },
      getAppOrigin(),
    );

    const code = createMaterialScript({
      name,
      // Base Color is a scene-linear socket: decode the hex the same way the
      // preview's colour management does (material-boundary.ts).
      baseColor: hexToLinearRgb(params.baseColor),
      metallic: params.metallic,
      roughness: params.roughness,
      normalStrength: params.normalStrength,
      aoStrength: params.aoStrength,
      textures: plan.textures,
    });

    const result = await tryApiFetch<unknown>('/api/blender-mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!result.ok) return result;
    return ok({ name, plan });
  },
}));
