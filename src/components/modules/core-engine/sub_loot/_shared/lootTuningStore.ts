import { create } from 'zustand';
import { DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD } from './data-binding';
import { initialTunerState, tunerReducer, type TunerAction, type TunerState } from './bindingTuner';

/** The shipped pity threshold: the Pity tab's slider and the Feature Map read it here. */
export const DEFAULT_PITY_THRESHOLD = 20;

/**
 * The loot module's ONE what-if: the tuned roster + gold table, and the pity
 * threshold. Module-level (not component state) because LootTabPanels mounts each
 * tab under AnimatePresence keyed by the tab, so tab-local tuning would die on
 * every tab switch, and the Feature Map glyphs (metrics/lootMetricsView.ts) read
 * the same values the Core and Pity tabs edit. In-memory by design: a tune is a
 * what-if, never persisted and never written to the catalog or UE.
 */
export interface LootTuningStore extends TunerState {
  dispatch: (action: TunerAction) => void;
  pityThreshold: number;
  setPityThreshold: (n: number) => void;
}

export const useLootTuningStore = create<LootTuningStore>()((set) => ({
  ...initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD),
  dispatch: (action) => set((s) => {
    const next = tunerReducer(s, action);
    return next === s ? s : next;
  }),
  pityThreshold: DEFAULT_PITY_THRESHOLD,
  setPityThreshold: (n) => set((s) => {
    if (!Number.isFinite(n)) return s;
    const v = Math.max(1, Math.round(n));
    return v === s.pityThreshold ? s : { pityThreshold: v };
  }),
}));

/** Back to the shipped roster and pity with an empty history (tests + a hard reset). */
export function resetLootTuning(): void {
  useLootTuningStore.setState({
    ...initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD),
    pityThreshold: DEFAULT_PITY_THRESHOLD,
  });
}
