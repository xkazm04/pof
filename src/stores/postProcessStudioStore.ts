import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import { DEFAULT_EFFECTS } from '@/lib/post-process-studio/effects';
import { PRESETS } from '@/lib/post-process-studio/presets';
import { estimateGPUBudget } from '@/lib/post-process-studio/gpu-estimator';
import type {
  PPStudioEffect,
  PPPreset,
  PPResolution,
  GPUBudgetReport,
  PPStackSnapshot,
  ABSlot,
} from '@/types/post-process-studio';

// ── Stable empty constants ──────────────────────────────────────────────────

const EMPTY_EFFECTS: PPStudioEffect[] = [];
const EMPTY_PRESETS: PPPreset[] = [];

// ── Helpers ─────────────────────────────────────────────────────────────────

function cloneEffects(effects: PPStudioEffect[]): PPStudioEffect[] {
  return effects.map((e) => ({
    ...e,
    params: e.params.map((p) => ({ ...p })),
  }));
}

function applyPresetToEffects(
  effects: PPStudioEffect[],
  preset: PPPreset,
): PPStudioEffect[] {
  return effects.map((e) => {
    const enabled = preset.enabledEffects.includes(e.id);
    const overrides = preset.overrides[e.id];
    return {
      ...e,
      enabled,
      params: e.params.map((p) => ({
        ...p,
        value: overrides?.[p.name] ?? p.defaultValue,
      })),
    };
  });
}

// ── Store ───────────────────────────────────────────────────────────────────

interface PostProcessStudioState {
  effects: PPStudioEffect[];
  presets: PPPreset[];
  activePresetId: string | null;
  resolution: PPResolution;
  budget: GPUBudgetReport | null;

  // A/B comparison
  compareMode: boolean;
  snapshotA: PPStackSnapshot | null;
  snapshotB: PPStackSnapshot | null;
  activeSlot: ABSlot;

  // UI
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Actions
  init: () => void;
  setEffectEnabled: (effectId: string, enabled: boolean) => void;
  setEffectParam: (effectId: string, paramName: string, value: number) => void;
  moveEffect: (effectId: string, direction: 'up' | 'down') => void;
  applyPreset: (presetId: string) => void;
  resetToDefaults: () => void;
  setResolution: (resolution: PPResolution) => void;
  recalcBudget: () => void;

  // A/B
  toggleCompareMode: () => void;
  captureSnapshot: (slot: ABSlot) => void;
  setActiveSlot: (slot: ABSlot) => void;
  loadSnapshot: (slot: ABSlot) => void;

  // Code gen
  generateCode: () => Promise<string | null>;
}

export const usePostProcessStudioStore = create<PostProcessStudioState>((set, get) => ({
  effects: EMPTY_EFFECTS,
  presets: EMPTY_PRESETS,
  activePresetId: null,
  resolution: '1080p',
  budget: null,

  compareMode: false,
  snapshotA: null,
  snapshotB: null,
  activeSlot: 'A',

  isLoading: false,
  isGenerating: false,
  error: null,

  init: () => {
    const effects = cloneEffects(DEFAULT_EFFECTS);
    const budget = estimateGPUBudget(effects, '1080p');
    set({ effects, presets: PRESETS, budget, isLoading: false });
  },

  setEffectEnabled: (effectId, enabled) => {
    const effects = get().effects.map((e) =>
      e.id === effectId ? { ...e, enabled } : e,
    );
    const budget = estimateGPUBudget(effects, get().resolution);
    set({ effects, budget, activePresetId: null });
  },

  setEffectParam: (effectId, paramName, value) => {
    const effects = get().effects.map((e) =>
      e.id === effectId
        ? { ...e, params: e.params.map((p) => p.name === paramName ? { ...p, value } : p) }
        : e,
    );
    const budget = estimateGPUBudget(effects, get().resolution);
    set({ effects, budget, activePresetId: null });
  },

  moveEffect: (effectId, direction) => {
    const effects = [...get().effects].sort((a, b) => a.priority - b.priority);
    const idx = effects.findIndex((e) => e.id === effectId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= effects.length) return;

    const tempPriority = effects[idx].priority;
    effects[idx] = { ...effects[idx], priority: effects[swapIdx].priority };
    effects[swapIdx] = { ...effects[swapIdx], priority: tempPriority };
    set({ effects });
  },

  applyPreset: (presetId) => {
    const preset = get().presets.find((p) => p.id === presetId);
    if (!preset) return;
    const effects = applyPresetToEffects(cloneEffects(DEFAULT_EFFECTS), preset);
    const budget = estimateGPUBudget(effects, get().resolution);
    set({ effects, budget, activePresetId: presetId });
  },

  resetToDefaults: () => {
    const effects = cloneEffects(DEFAULT_EFFECTS);
    const budget = estimateGPUBudget(effects, get().resolution);
    set({ effects, budget, activePresetId: null });
  },

  setResolution: (resolution) => {
    const budget = estimateGPUBudget(get().effects, resolution);
    set({ resolution, budget });
  },

  recalcBudget: () => {
    const budget = estimateGPUBudget(get().effects, get().resolution);
    set({ budget });
  },

  toggleCompareMode: () => {
    const cm = !get().compareMode;
    if (cm && !get().snapshotA) {
      // Auto-capture current state as slot A
      const { effects, activePresetId, budget } = get();
      const snap: PPStackSnapshot = {
        effects: cloneEffects(effects),
        presetId: activePresetId,
        label: activePresetId
          ? get().presets.find((p) => p.id === activePresetId)?.name ?? 'Stack A'
          : 'Stack A',
        totalGpuMs: budget?.totalCostMs ?? 0,
      };
      set({ compareMode: cm, snapshotA: snap, activeSlot: 'B' });
    } else {
      set({ compareMode: cm });
    }
  },

  captureSnapshot: (slot) => {
    const { effects, activePresetId, budget, presets } = get();
    const snap: PPStackSnapshot = {
      effects: cloneEffects(effects),
      presetId: activePresetId,
      label: activePresetId
        ? presets.find((p) => p.id === activePresetId)?.name ?? `Stack ${slot}`
        : `Stack ${slot}`,
      totalGpuMs: budget?.totalCostMs ?? 0,
    };
    set(slot === 'A' ? { snapshotA: snap } : { snapshotB: snap });
  },

  setActiveSlot: (slot) => set({ activeSlot: slot }),

  loadSnapshot: (slot) => {
    const snap = slot === 'A' ? get().snapshotA : get().snapshotB;
    if (!snap) return;
    const effects = cloneEffects(snap.effects);
    const budget = estimateGPUBudget(effects, get().resolution);
    set({ effects, budget, activePresetId: snap.presetId });
  },

  generateCode: async () => {
    const { effects, activePresetId } = get();
    const enabled = effects.filter((e) => e.enabled);
    if (enabled.length === 0) return null;

    set({ isGenerating: true, error: null });
    try {
      const data = await apiFetch<{ prompt: string }>(
        '/api/post-process-studio',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate',
            effects: enabled,
            presetName: activePresetId
              ? get().presets.find((p) => p.id === activePresetId)?.name ?? null
              : null,
          }),
        },
      );
      set({ isGenerating: false });
      return data.prompt;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isGenerating: false });
      return null;
    }
  },
}));
