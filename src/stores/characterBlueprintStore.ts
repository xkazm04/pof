import { create } from 'zustand';

/* ── Sub-tab → UE file mapping ─────────────────────────────────────────────── */

export const SUB_TAB_UE_FILES: Record<string, string> = {
  class: 'ARPGCharacterBase.h/.cpp, ARPGPlayerCharacter.h/.cpp',
  input: 'ARPGPlayerController.h/.cpp, ARPGAbilityUnlockComponent.h/.cpp',
  visuals: 'GA_Dodge.h/.cpp, CombatFeedbackComponent.h/.cpp, Animation/*',
  data: 'ARPGAttributeSet.h/.cpp, ARPGEnemyCharacter.h/.cpp',
  genome: 'ARPGAttributeSet.h/.cpp, ARPGAttributeInitData.h',
};

/* ── Store ──────────────────────────────────────────────────────────────────── */

interface CharacterBlueprintState {
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
}

export const useCharacterBlueprintStore = create<CharacterBlueprintState>((set) => ({
  activeSubTab: 'class',
  setActiveSubTab: (tab) => set({ activeSubTab: tab }),
}));
