import { create } from 'zustand';
import { DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD } from './data-binding';
import { initialTunerState, tunerReducer, type TunerAction, type TunerState } from './bindingTuner';

/**
 * The loot module's ONE tuned roster + gold table. Module-level (not component
 * state) because LootTabPanels mounts each tab under AnimatePresence keyed by the
 * tab, so tab-local tuning would die on every tab switch. In-memory by design: a
 * tune is a what-if, never persisted and never written to the catalog or UE.
 */
export interface LootTuningStore extends TunerState {
  dispatch: (action: TunerAction) => void;
}

export const useLootTuningStore = create<LootTuningStore>()((set) => ({
  ...initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD),
  dispatch: (action) => set((s) => {
    const next = tunerReducer(s, action);
    return next === s ? s : next;
  }),
}));

/** Back to the shipped roster with an empty history (tests + a hard reset). */
export function resetLootTuning(): void {
  useLootTuningStore.setState(initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD));
}
