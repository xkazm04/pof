import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import {
  moveLayer,
  sanitizeLayers,
  type AdjustmentLayer,
  type LayerModifier,
} from '@/lib/feel-adjustment-layers';
import {
  setInspectorOverride as upsertInspectorOverride,
  clearInspectorOverrides as dropInspectorOverrides,
  findBasePreset,
} from '@/lib/character/inspector-fields';
import {
  applyCurveEdit,
  clearPlaygroundCurves as dropPlaygroundCurves,
  type CurveId,
  type CurvePoint,
} from '@/lib/character/feel-curve-codec';
import {
  rebindAction,
  resolveBindings,
  sanitizeBindingOverrides,
  type BindingOverrides,
  type ResolvedBindings,
} from '@/lib/character/input-bindings';
import { INPUT_BINDINGS } from '@/components/modules/core-engine/sub_character/_shared/data';

/* ── Sub-tab → UE file mapping ─────────────────────────────────────────────── */

export const SUB_TAB_UE_FILES: Record<string, string> = {
  class: 'ARPGCharacterBase.h/.cpp, ARPGPlayerCharacter.h/.cpp',
  input: 'ARPGPlayerController.h/.cpp, ARPGAbilityUnlockComponent.h/.cpp',
  visuals: 'GA_Dodge.h/.cpp, CombatFeedbackComponent.h/.cpp, Animation/*',
  data: 'ARPGAttributeSet.h/.cpp, ARPGEnemyCharacter.h/.cpp',
  genome: 'ARPGAttributeSet.h/.cpp, ARPGAttributeInitData.h',
};

const DEFAULT_BASE_PRESET_ID = FEEL_PRESETS[0].id;
const PRESET_IDS = new Set(FEEL_PRESETS.map((p) => p.id));

/* ── Store ──────────────────────────────────────────────────────────────────── */

interface CharacterBlueprintState {
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;

  /* ── Feel adjustment-layer stack ──────────────────────────────────────────
   * A base preset stays authoritative while named modifier layers stack on top
   * (Boss Encounter, Frenzy buff, Low Health…). Persisted so a designer's
   * situational stack survives reloads. The resolved profile is derived in the
   * UI via `resolveStack(basePreset.profile, feelLayers)`. */
  baseFeelPresetId: string;
  feelLayers: AdjustmentLayer[];

  setBaseFeelPreset: (id: string) => void;
  addFeelLayer: (layer: AdjustmentLayer) => void;
  removeFeelLayer: (id: string) => void;
  toggleFeelLayer: (id: string) => void;
  renameFeelLayer: (id: string, name: string) => void;
  moveFeelLayer: (id: string, dir: 'up' | 'down') => void;
  setLayerModifiers: (id: string, modifiers: LayerModifier[]) => void;
  clearFeelLayers: () => void;

  /** Property Inspector edit → `set` modifier in the reserved 'Inspector overrides'
   *  layer of `feelLayers` (see `@/lib/character/inspector-fields`). */
  setInspectorOverride: (name: string, value: number) => void;
  clearInspectorOverrides: () => void;

  /** Feel Playground drag → `set` modifiers in the reserved 'Playground curves'
   *  layer of `feelLayers` (see `@/lib/character/feel-curve-codec`). */
  applyPlaygroundCurve: (curve: CurveId, points: CurvePoint[]) => void;
  clearPlaygroundCurves: () => void;

  /** Input tab key rebinds: sparse action -> key over INPUT_BINDINGS, persisted.
   *  Every input surface reads `useResolvedBindings()`. */
  bindingOverrides: BindingOverrides;
  /** Rebind with the swap rule of `rebindAction` (key groups never swap). */
  setBindingOverride: (action: string, key: string) => void;
  resetBindings: () => void;
}

export const useCharacterBlueprintStore = create<CharacterBlueprintState>()(
  persist(
    (set) => ({
      activeSubTab: 'class',
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),

      baseFeelPresetId: DEFAULT_BASE_PRESET_ID,
      feelLayers: [],

      setBaseFeelPreset: (id) => set({ baseFeelPresetId: id }),

      addFeelLayer: (layer) =>
        set((state) => ({ feelLayers: [...state.feelLayers, layer] })),

      removeFeelLayer: (id) =>
        set((state) => ({ feelLayers: state.feelLayers.filter((l) => l.id !== id) })),

      toggleFeelLayer: (id) =>
        set((state) => ({
          feelLayers: state.feelLayers.map((l) =>
            l.id === id ? { ...l, enabled: !l.enabled } : l,
          ),
        })),

      renameFeelLayer: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          feelLayers: state.feelLayers.map((l) =>
            l.id === id ? { ...l, name: trimmed } : l,
          ),
        }));
      },

      moveFeelLayer: (id, dir) =>
        set((state) => ({ feelLayers: moveLayer(state.feelLayers, id, dir) })),

      setLayerModifiers: (id, modifiers) =>
        set((state) => ({
          feelLayers: state.feelLayers.map((l) =>
            l.id === id ? { ...l, modifiers } : l,
          ),
        })),

      clearFeelLayers: () => set({ feelLayers: [] }),

      setInspectorOverride: (name, value) =>
        set((state) => ({
          feelLayers: upsertInspectorOverride(
            state.feelLayers, name, value, findBasePreset(state.baseFeelPresetId).profile,
          ),
        })),

      clearInspectorOverrides: () =>
        set((state) => ({ feelLayers: dropInspectorOverrides(state.feelLayers) })),

      applyPlaygroundCurve: (curve, points) =>
        set((state) => {
          const feelLayers = applyCurveEdit(
            state.feelLayers, findBasePreset(state.baseFeelPresetId).profile, curve, points,
          );
          return feelLayers === state.feelLayers ? state : { feelLayers };
        }),

      clearPlaygroundCurves: () =>
        set((state) => ({ feelLayers: dropPlaygroundCurves(state.feelLayers) })),

      bindingOverrides: {},

      setBindingOverride: (action, key) =>
        set((state) => ({
          bindingOverrides: rebindAction(INPUT_BINDINGS, state.bindingOverrides, action, key),
        })),

      resetBindings: () => set({ bindingOverrides: {} }),
    }),
    {
      name: 'pof-character-feel-stack',
      storage: createJSONStorage(() => localStorage),
      // activeSubTab is transient navigation state — only the stack and rebinds persist.
      partialize: (state) => ({
        baseFeelPresetId: state.baseFeelPresetId,
        feelLayers: state.feelLayers,
        bindingOverrides: state.bindingOverrides,
      }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<CharacterBlueprintState> | undefined;
        const baseFeelPresetId =
          typeof raw?.baseFeelPresetId === 'string' && PRESET_IDS.has(raw.baseFeelPresetId)
            ? raw.baseFeelPresetId
            : DEFAULT_BASE_PRESET_ID;
        return {
          ...current,
          baseFeelPresetId,
          feelLayers: sanitizeLayers(raw?.feelLayers),
          bindingOverrides: sanitizeBindingOverrides(raw?.bindingOverrides, INPUT_BINDINGS),
        };
      },
    },
  ),
);

/** The one resolved binding state every Input surface (and KeyboardMetric) reads. */
export function useResolvedBindings(): ResolvedBindings {
  const overrides = useCharacterBlueprintStore((s) => s.bindingOverrides);
  return useMemo(() => resolveBindings(INPUT_BINDINGS, overrides), [overrides]);
}
