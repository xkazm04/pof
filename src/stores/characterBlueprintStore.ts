import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import {
  moveLayer,
  sanitizeLayers,
  type AdjustmentLayer,
  type LayerModifier,
} from '@/lib/feel-adjustment-layers';

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
    }),
    {
      name: 'pof-character-feel-stack',
      storage: createJSONStorage(() => localStorage),
      // activeSubTab is transient navigation state — only the stack is persisted.
      partialize: (state) => ({
        baseFeelPresetId: state.baseFeelPresetId,
        feelLayers: state.feelLayers,
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
        };
      },
    },
  ),
);
